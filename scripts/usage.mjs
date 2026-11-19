#!/usr/bin/env node
// punchlist `usage` — deterministic numbers for the
// efficiency report. This script only counts; the grading rubric lives in
// references/usage.md and is applied by the model reading this output.
//
//   node scripts/usage.mjs [--days N] [--dir <transcript-dir>] [--html] [--record]
//
// A run only reads. --record appends one snapshot to ~/.claude/usage-history.jsonl;
// the trend draws only across snapshots taken with the same --days.
//
// Data sources: session transcript JSONLs (~/.claude/projects/<slug>/*.jsonl,
// real per-message token usage), CODE-LEARNINGS.md / DESIGN-LEARNINGS.md
// (gate + loop stats), and <cwd>/docs/superpowers/plans (dispatch ledger +
// punchlists → cost per verified item).

import { appendFileSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { notesDir } from '../hooks/notes.mjs';
import { join } from 'node:path';

export function parseUsage(lines) {
  const models = {};
  const total = { msgs: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  const seen = new Set(); // multi-block turns repeat one usage object per line
  for (const raw of lines) {
    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      continue;
    }
    const u = j?.message?.usage;
    if (j?.type !== 'assistant' || !u) continue;
    const id = j.message.id ?? j.requestId;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    const m = j.message.model ?? 'unknown';
    models[m] ??= { msgs: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
    const add = (t) => {
      t.msgs += 1;
      t.in += u.input_tokens ?? 0;
      t.out += u.output_tokens ?? 0;
      t.cacheRead += u.cache_read_input_tokens ?? 0;
      t.cacheWrite += u.cache_creation_input_tokens ?? 0;
    };
    add(models[m]);
    add(total);
  }
  return { models, total };
}

const ESCAPE_RE = new RegExp('Caught by:\\s*(owner|' + 'kee' + 'gan)\\b', 'i');

export function countLearnings(md) {
  const c = {
    blocked: 0, override: 0, advisory: 0,
    escaped: 0, panel: 0,
    lines: md.split('\n').length,
  };
  for (const l of md.split('\n')) {
    if (/^- \d{4}-\d{2}-\d{2} · BLOCKED ·/.test(l)) c.blocked += 1;
    else if (/^- \d{4}-\d{2}-\d{2} · override ·/.test(l)) c.override += 1;
    else if (/^- \d{4}-\d{2}-\d{2} · advisory ·/.test(l)) c.advisory += 1;
    // Escapes: mistakes that shipped past every gate and reached the owner (legacy tag: the owner's first name).
    if (ESCAPE_RE.test(l)) c.escaped += 1;
    else if (/Caught by:\s*panel/i.test(l)) c.panel += 1;
  }
  return c;
}

// Items the architect verified in one punchlist. Three shapes in the wild:
// `- [x] Architect …` checklist boxes, `- [V]` (the "architect
// browser-verified" state), and tables whose header has an Architect column
// (☑ / ✅ / [x] in that cell).
export function countVerified(md) {
  let n = 0;
  let col = null; // null = not inside a table
  for (const l of md.split('\n')) {
    if (/^\s*- \[x\]\s*architect\b/i.test(l) || /^\s*- \[V\]/.test(l)) n += 1;
    if (!l.trim().startsWith('|')) {
      col = null;
      continue;
    }
    const cells = l.split('|').slice(1, -1).map((c) => c.trim());
    if (col === null) col = cells.findIndex((c) => /^architect\b/i.test(c));
    else if (col >= 0 && /[☑✅]|\[x\]/i.test(cells[col] ?? '')) n += 1;
  }
  return n;
}

// Dispatched-agent tokens from a dispatch-hook ledger, rows inside the window.
export function ledgerTokens(lines, cutoff) {
  const r = { tokens: 0, rows: 0, missing: 0 };
  for (const raw of lines) {
    let j;
    try {
      j = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!(Date.parse(j.ts) >= cutoff)) continue;
    r.rows += 1;
    if (typeof j.actualTokens === 'number') r.tokens += j.actualTokens;
    else r.missing += 1;
  }
  return r;
}

/** Flags by name. A flag that needs a value and has none (or a bad one) throws; nothing is guessed. */
export function parseArgs(args) {
  const value = (flag) => {
    const i = args.indexOf(flag);
    if (i < 0) return null;
    const v = args[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${flag} needs a value`);
    return v;
  };
  const d = value('--days');
  const days = d === null ? 7 : Number(d);
  if (!(days > 0)) throw new Error(`--days needs a positive number, got "${d}"`);
  return { days, dir: value('--dir'), html: args.includes('--html'), record: args.includes('--record') };
}

/** Snapshots taken over the same window as this run — 7-day and 60-day totals never share a line. */
export const sameWindow = (history, days) => history.filter((h) => h.days === days);

function projectSlug(cwd) {
  return cwd.replace(/[:\\/]/g, '-');
}

const fmt = (n) => n.toLocaleString('en-US');

/** Self-contained dark report page. Chart rules:
 *  bars zero-based by construction (width = out/max), values labeled — never
 *  hue alone, tabular figures, trend only when real history exists, and the
 *  data source stated in the footer. */
export function renderHtml(data, gate, history, meta) {
  const models = Object.entries(data.models)
    .filter(([m]) => m !== '<synthetic>')
    .sort((a, b) => b[1].out - a[1].out);
  const max = Math.max(1, ...models.map(([, t]) => t.out));
  const hitPct = data.total.cacheRead + data.total.in > 0
    ? Math.round((100 * data.total.cacheRead) / (data.total.cacheRead + data.total.in + data.total.cacheWrite))
    : 0;

  const bars = models
    .map(([m, t]) => {
      const pct = Math.round((1000 * t.out) / max) / 10;
      return `<div class="row"><span class="lbl">${m}</span>
      <div class="track"><div class="bar" style="width: ${pct}%"></div></div>
      <span class="val">${fmt(t.out)}</span></div>`;
    })
    .join('\n');

  let trend;
  if (history.length >= 2) {
    const W = 640, H = 120, P = 8;
    const mx = Math.max(...history.map((h) => h.out));
    const pts = history
      .map((h, i) => `${P + (i * (W - 2 * P)) / (history.length - 1)},${H - P - ((H - 2 * P) * h.out) / mx}`)
      .join(' ');
    trend = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="8" opacity=".35" filter="blur(8px)"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    </svg>
    <p class="cap">output tokens per snapshot · ${history[0].date} → ${history[history.length - 1].date} · y-axis 0–${fmt(mx)}</p>`;
  } else {
    trend = `<p class="cap">collecting — ${history.length} snapshot${history.length === 1 ? '' : 's'} so far; the trend draws at 2. Run \`usage --record\` after the next round.</p>`;
  }

  const kpi = (label, value, sub) =>
    `<div class="kpi"><span class="n">${value}</span><span class="l">${label}</span>${sub ? `<span class="s">${sub}</span>` : ''}</div>`;

  return `<!doctype html><meta charset="utf-8"><title>punchlist usage</title><style>
:root{--bg:#0e1116;--panel:#161b23;--ink:#e8ecf3;--dim:#8a94a6;--accent:#5eead4;--accent2:#2dd4bf}
*{box-sizing:border-box;margin:0}body{background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui;padding:clamp(16px,5vw,48px);max-width:900px;margin:auto}
h1{font-size:28px;margin-bottom:4px}h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin:36px 0 14px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-top:24px}
.kpi{background:var(--panel);border-radius:10px;padding:16px}.kpi .n{display:block;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
.kpi .l{color:var(--dim);font-size:12px}.kpi .s{display:block;color:var(--dim);font-size:11px;margin-top:2px}
.row{display:grid;grid-template-columns:minmax(80px,200px) 1fr max-content;gap:12px;align-items:center;margin:8px 0}
.lbl{font-size:13px;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track{background:var(--panel);border-radius:3px;height:22px}
.bar{height:100%;border-radius:3px 3px 0 0;background:linear-gradient(180deg,color-mix(in oklch,var(--accent) 95%,white),color-mix(in oklch,var(--accent2) 55%,black));border-top:1px solid var(--accent)}
.val{font-variant-numeric:tabular-nums;text-align:right;font-size:13px}
svg{width:100%;height:120px;background:var(--panel);border-radius:10px}
.cap{color:var(--dim);font-size:12px;margin-top:8px}
footer{margin-top:40px;color:var(--dim);font-size:12px;border-top:1px solid var(--panel);padding-top:12px}
</style>
<h1>Agent usage — last ${meta.days}d</h1>
<p class="cap">punchlist · self-reporting from real session transcripts</p>
<div class="kpis">
${kpi('output tokens', fmt(data.total.out))}
${kpi('messages', fmt(data.total.msgs))}
${kpi('cache hit', `${hitPct}%`, 'of all input tokens served from cache')}
${kpi('gate blocks', fmt(gate.blocked), 'secrets / RLS / SQL denied at write time')}
${kpi('overrides', fmt(gate.override), 'reasoned + logged')}
${kpi('escapes', fmt(gate.escaped ?? 0), 'mistakes that reached the owner — the number every gate exists to shrink')}
</div>
<h2>Output tokens by model — full domain, zero-based</h2>
${bars || '<p class="cap">no assistant messages in range</p>'}
<h2>Trend</h2>
${trend}
<footer>Source: per-message usage from ${meta.sessions} session transcript${meta.sessions === 1 ? '' : 's'} in ${meta.dir}; gate counts from ${meta.notes}/CODE-LEARNINGS.md. Generated by punchlist scripts/usage.mjs.</footer>`;
}

if (process.argv[1]?.endsWith('usage.mjs')) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`usage: ${e.message}`);
    process.exit(2);
  }
  const { days, dir: dirArg, html, record } = opts;
  const notes = notesDir();
  const dir = dirArg ?? join(homedir(), '.claude', 'projects', projectSlug(process.cwd()));
  const cutoff = Date.now() - days * 86400_000;

  let lines = [];
  let sessions = 0;
  try {
    for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
      const p = join(dir, f);
      if (statSync(p).mtimeMs < cutoff) continue;
      sessions += 1;
      lines.push(...readFileSync(p, 'utf8').split('\n'));
    }
  } catch {
    console.log(`no transcripts at ${dir}`);
  }

  const { models, total } = parseUsage(lines);
  console.log(`# usage — last ${days}d — ${dir}`);
  console.log(`total: ${total.msgs} msgs · in ${total.in} · out ${total.out} · cacheWrite ${total.cacheWrite} · cacheRead ${total.cacheRead}`);
  for (const [m, t] of Object.entries(models).sort((a, b) => b[1].out - a[1].out)) {
    console.log(`  ${m}: ${t.msgs} msgs · out ${t.out} · in ${t.in} · cacheWrite ${t.cacheWrite} · cacheRead ${t.cacheRead}`);
  }

  let gate = { blocked: 0, override: 0, advisory: 0 };
  for (const name of ['CODE-LEARNINGS.md', 'DESIGN-LEARNINGS.md']) {
    try {
      const md = readFileSync(join(notes, name), 'utf8');
      const c = countLearnings(md);
      if (name === 'CODE-LEARNINGS.md') gate = c;
      console.log(`${name}: ${c.lines} lines · blocked ${c.blocked} · overrides ${c.override} · advisories ${c.advisory}`);
    } catch {
      /* absent is fine */
    }
  }

  // Cost per verified item: dispatched tokens ÷ items the architect verified,
  // from the project's docs/superpowers/plans (ledger + punchlists in window).
  const plans = join(process.cwd(), 'docs', 'superpowers', 'plans');
  let perVerified = null;
  try {
    const led = { tokens: 0, rows: 0, missing: 0 };
    let verified = 0;
    for (const f of readdirSync(plans)) {
      const p = join(plans, f);
      if (statSync(p).mtimeMs < cutoff) continue;
      if (f.endsWith('-ledger.jsonl')) {
        const r = ledgerTokens(readFileSync(p, 'utf8').split('\n'), cutoff);
        for (const k in led) led[k] += r[k];
      } else if (f.endsWith('.md')) verified += countVerified(readFileSync(p, 'utf8'));
    }
    perVerified = verified ? Math.round(led.tokens / verified) : null;
    console.log(`cost per verified item: ${perVerified ?? 'n/a'} tokens (${led.tokens} dispatched ÷ ${verified} architect-verified · ${led.missing} of ${led.rows} ledger rows unreported)`);
  } catch {
    console.log(`cost per verified item: n/a (no ${plans})`);
  }

  // Only --record persists a snapshot; a report command does not write.
  const histPath = join(notes, 'usage-history.jsonl');
  const snap = {
    date: new Date().toISOString().slice(0, 10),
    ts: Date.now(),
    days,
    out: total.out,
    in: total.in,
    cacheRead: total.cacheRead,
    cacheWrite: total.cacheWrite,
    msgs: total.msgs,
    blocked: gate.blocked,
    override: gate.override,
    escaped: gate.escaped ?? 0,
    perVerified,
  };
  let history = [];
  try {
    history = readFileSync(histPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  } catch {
    /* first run */
  }
  history = sameWindow(history, days);
  if (record) {
    appendFileSync(histPath, `${JSON.stringify(snap)}\n`, 'utf8');
    history.push(snap);
    console.log(`recorded snapshot to ${histPath}`);
  }

  if (html) {
    const out = join(notes, 'usage-report.html');
    writeFileSync(out, renderHtml({ models, total }, gate, history, { days, dir, sessions, notes }), 'utf8');
    console.log(`report: ${out}`);
  }
}
