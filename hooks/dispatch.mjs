#!/usr/bin/env node
// punchlist dispatch discipline — mechanism, not memory.
//
// PreToolUse (Task|Agent)  — blocks a dispatch whose `model` is unset when the
//                            agent type is generic (no frontmatter model to
//                            inherit). Enforces the spawn-tier matrix's
//                            rule that the model is always explicit.
// PostToolUse (Task|Agent) — appends the ledger row automatically: model,
//                            agent type, prompt size, punchlist reference,
//                            actual subagent tokens. The ledger writes itself.
// Stop                     — round auditor: source edits without a punchlist,
//                            oversized dispatch prompts that don't reference
//                            the punchlist, dispatches missing from the ledger,
//                            opus dispatches with no COMPLEX reason, architect
//                            reads over 20 KB, learnings triage overdue.
//                            Also back-fills actualTokens:
//                            background agents return before they finish, so
//                            PostToolUse never sees usage; the task-notification
//                            in the transcript carries it (2026-09-02).
//
// Named limitations: the guard cannot see the SESSION model, so it enforces
// explicitness, not the tier cap itself — under-tiering is the weekly audit's
// job. Workflow-tool agents and Bash-spawned processes are out of scope.
//
// Exit contract: 0 = allow, 2 + stderr = deny (PreToolUse only).

import { appendFileSync, existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { notesDir } from './notes.mjs';

const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'agents');
/**
 * The model a dispatch will run on. Explicit wins; else a typed worker's own
 * default from its definition's frontmatter; else the session's (inherited).
 * An unreadable definition is "inherited" — never throws.
 */
export function effectiveModel(input, agentsDir = AGENTS_DIR) {
  const explicit = String(input?.model ?? '').trim();
  if (explicit) return { model: explicit, source: 'explicit' };
  const type = String(input?.subagent_type ?? '').replace(/^.*:/, '');
  if (/^[\w-]+$/.test(type) && !GENERIC_TYPES.has(type)) {
    try {
      const fm = readFileSync(join(agentsDir, `${type}.md`), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const m = fm?.[1].match(/^model:\s*(\S+)/m);
      if (m) return { model: m[1], source: 'default' };
    } catch {
      /* no definition */
    }
  }
  return { model: 'inherited', source: 'inherited' };
}

const DISPATCH_TOOLS = new Set(['Task', 'Agent']);
// An opus dispatch states why the work is silently-wrong-if-wrong, in the
// prompt, as `COMPLEX: <reason>`. Without it the Stop auditor flags the row.
const REASON_RE = /^[ \t]*COMPLEX:\s*([^\n]+)/m;
const reasonFrom = (prompt) => {
  const m = String(prompt).match(REASON_RE);
  return m ? m[1].trim().slice(0, 160) : null;
};
// Architect reads above this land in the architect's own context; the
// delegation floor (shared/architect.md) says they should be dispatched.
export const BIG_READ_BYTES = 20 * 1024;
const READ_EXEMPT_RE = /punchlist|contract|spec|CLAUDE\.md|LEARNINGS|\.(png|jpe?g|webp)$/i;
// Generic types inherit the session model when `model` is unset — exactly the
// silent tier-cap violation the matrix forbids. Custom agent types may pin a
// model in their own frontmatter, so they pass without one. Forks always
// inherit by design and are exempt.
const GENERIC_TYPES = new Set(['', 'general-purpose', 'claude', 'Explore', 'Plan']);
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|sql|css|html|vue|svelte)$/i;
const SOURCE_SKIP_RE = /([/\\]|^)(docs|scratchpad|\.claude|node_modules)([/\\]|$)|\.test\./i;
const PROMPT_SPEC_CHARS = 3000; // above this, a prompt with no punchlist ref smells like a restated spec
// 2026-10-16: the inline/dispatch route is recorded per ask before building,
// so the decision is checkable.
const BUILD_LINE_RE = /^\s*Build:\s*(inline|dispatch)\b/im;
// A dispatch that builds motion names where the mechanism came from (the
// reference's source file) or says "SOURCE: none — <why hand-built>". Layout
// words alone (section, hero, band, head) do not make a prompt motion work.
const MOTION_RE = /\b(animat\w*|motion|reveal|transition|scrub|parallax|pinn?ed|sticky|sheet|marquee)\b/i;
const SOURCED_RE = /\bSOURCE:/;
// 2026-09-21: a read-only audit that walked a file section by section owed a SOURCE
// line for a mechanism it never built. Read-only and review dispatches build
// nothing, so they are not motion work.
const READ_ONLY_RE = /^\s*READ-ONLY\b/m;
// The type may name review anywhere; the description must open with it, so
// a builder described as implementing review feedback stays a builder.
const REVIEW_TYPE_RE = /review|audit|critique|adversar|second-opinion/i;
const REVIEW_DESC_RE = /^\s*(review|audit|critique|adversar|second-opinion)/i;
const isReview = (i) => REVIEW_TYPE_RE.test(String(i?.subagent_type ?? '')) || REVIEW_DESC_RE.test(String(i?.description ?? ''));
const isOpus = (m) => /opus/i.test(String(m));
// Miss ledger (design rules 1, 2, 6).
const MISS_CAUSES = new Set(['ambiguous-ask', 'missing-context', 'under-tiered', 'no-check', 'rule-ignored', 'rule-not-loaded', 'environment', 'taste']);
const MISS_CAUGHT = new Set(['test', 'hook', 'sweep', 'reviewer', 'architect', 'owner']);
const MISS_CHANGED = new Set(['tier', 'spec', 'mechanism', 'brief', 'none']);
const askFrom =(prompt) => String(prompt).match(/^\s*ASK:\s*(\S+)/m)?.[1] ?? null;
const isMotion = (prompt, review) => !review && !READ_ONLY_RE.test(prompt) && MOTION_RE.test(prompt);

/** Local date, not UTC — an audit trail stamped "tomorrow" reads as forged. */
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ledgerPath(cwd, date = localDate()) {
  return join(cwd, 'docs', 'superpowers', 'plans', `${date}-ledger.jsonl`);
}

// ---- PreToolUse: the guard ----
export function guard(payload) {
  if (payload.hook_event_name !== 'PreToolUse' || !DISPATCH_TOOLS.has(payload.tool_name)) {
    return { deny: false, report: '' };
  }
  const i = payload.tool_input ?? {};
  const type = String(i.subagent_type ?? '');
  if (type === 'fork') return { deny: false, report: '' };
  const model = String(i.model ?? '').trim();
  // Most opus dispatches once carried no reason. A Stop finding arrives after
  // the tokens are spent, so the reason is owed up front. Only an explicit
  // opus owes one; a worker whose own default is opus does not.
  if (isOpus(model) && !reasonFrom(i.prompt ?? '')) {
    return {
      deny: true,
      report:
        'punchlist BLOCKED this dispatch: `model: opus` with no "COMPLEX: <reason>" line in the prompt.\n' +
        'Opus is for work that is silently wrong if wrong (shared/architect.md). ' +
        'State the reason in the prompt, or re-dispatch on sonnet.',
    };
  }
  if (model || !GENERIC_TYPES.has(type)) return { deny: false, report: '' };
  return {
    deny: true,
    report:
      'punchlist BLOCKED this dispatch: no `model` set on a generic agent type.\n' +
      'Unset inherits the architect’s tier and silently violates the spawn-tier ' +
      'matrix (shared/architect.md). Route by silent-failure risk ' +
      'and re-dispatch with an explicit model: haiku | sonnet | opus.',
  };
}

// ---- PostToolUse: the auto-ledger ----
export function ledgerRow(payload) {
  if (payload.hook_event_name !== 'PostToolUse' || !DISPATCH_TOOLS.has(payload.tool_name)) return null;
  const i = payload.tool_input ?? {};
  const prompt = String(i.prompt ?? '');
  const blob = JSON.stringify(payload.tool_response ?? '');
  const tokens = blob.match(/subagent_tokens[^\d]{0,4}(\d+)/);
  const eff = effectiveModel(i);
  return {
    ts: new Date().toISOString(),
    step: String(i.description ?? '').slice(0, 80),
    model: eff.model,
    modelSource: eff.source,
    // 2026-10-08: effort is the second routing axis; the worker definitions
    // carry a default, the Agent tool's `effort` param overrides per dispatch.
    effort: String(i.effort ?? '').trim() || null,
    agentType: String(i.subagent_type ?? 'general-purpose'),
    promptChars: prompt.length,
    referencesPunchlist: /punchlist/i.test(prompt),
    motionWork: isMotion(prompt, isReview(i)),
    sourced: SOURCED_RE.test(prompt),
    complexReason: reasonFrom(prompt),
    ask: askFrom(prompt),
    // Joins this row to the task-notification that carries the real usage.
    toolUseId: payload.tool_use_id ? String(payload.tool_use_id) : null,
    actualTokens: tokens ? Number(tokens[1]) : null,
  };
}

/** Fill actualTokens on rows whose notification has since arrived. Returns rows changed. */
export function backfillRows(rows, notifications) {
  let changed = 0;
  for (const r of rows) {
    if (r.actualTokens == null && r.toolUseId && notifications[r.toolUseId] != null) {
      r.actualTokens = notifications[r.toolUseId];
      changed += 1;
    }
  }
  return changed;
}

function readLedger(p) {
  return readFileSync(p, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

function backfillLedger(cwd, date, notifications) {
  if (Object.keys(notifications).length === 0) return;
  try {
    const p = ledgerPath(cwd, date);
    const rows = readLedger(p);
    if (backfillRows(rows, notifications) > 0) {
      writeFileSync(p, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
    }
  } catch {
    // Bookkeeping must never block a stop.
  }
}

/** Writes only where the project already keeps plans; never creates the folder. */
export function appendLedger(row, cwd) {
  try {
    const p = ledgerPath(cwd);
    if (!existsSync(dirname(p))) return;
    appendFileSync(p, `${JSON.stringify(row)}\n`, 'utf8');
  } catch {
    // Bookkeeping must never break a dispatch.
  }
}

// ---- learnings triage: the files' own thresholds, checked mechanically ----
// CODE-LEARNINGS says triage when `## Hook catches` passes ~20 entries;
// DESIGN-LEARNINGS says triage when any section passes ~15. Both were
// silently overdue on 2026-09-10. A trigger nobody checks is prose, not a trigger.
export const TRIAGE = { hookCatches: 20, designSection: 15, fileBytes: 40 * 1024, totalEntries: 60 };
export function learningsTriage({ code = '', design = '' }, caps = TRIAGE) {
  const out = [];
  const sections = (md) => {
    const res = [];
    let name = null, n = 0;
    for (const l of md.split('\n')) {
      if (l.startsWith('## ')) {
        if (name) res.push([name, n]);
        name = l.slice(3).trim();
        n = 0;
      } else if (/^- /.test(l)) n += 1;
    }
    if (name) res.push([name, n]);
    return res;
  };
  const catches = sections(code).find(([h]) => /^Hook catches/i.test(h));
  if (catches && catches[1] > caps.hookCatches)
    out.push(`CODE-LEARNINGS "## Hook catches" holds ${catches[1]} entries (triage at ${caps.hookCatches}) — promote, narrow, or delete.`);
  const fat = sections(design).filter(([, n]) => n > caps.designSection);
  for (const [h, n] of fat)
    out.push(`DESIGN-LEARNINGS "## ${h}" holds ${n} entries (triage at ${caps.designSection}) — promote what recurred, cut what a rule now covers.`);
  // Every round opens a new dated heading, so per-section counts stay small;
  // size and total entries catch the file that grows across sections.
  for (const [name, md] of [['CODE-LEARNINGS', code], ['DESIGN-LEARNINGS', design]]) {
    const bytes = Buffer.byteLength(md);
    if (bytes > caps.fileBytes)
      out.push(`${name} is ${Math.round(bytes / 1024)} KB (triage at ${caps.fileBytes / 1024} KB) — promote what recurred, delete the rest.`);
    const total = sections(md).reduce((s, [, n]) => s + n, 0);
    if (total > caps.totalEntries)
      out.push(`${name} holds ${total} entries across all sections (triage at ${caps.totalEntries}) — promote what recurred, delete the rest.`);
  }
  return out;
}

// ---- Stop: the round window ----
/** The lines added since the last audit, and the new mark. The session transcript grows; each round audits only its own part. */
export function sinceMark(raw, mark) {
  const lines = raw.split('\n');
  return { slice: lines.slice(mark).join('\n'), mark: lines.length };
}

// ---- Miss ledger: punchlist `Miss:` lines -> misses.jsonl rows ----
const MISS_LINE_RE = /^\s*(?:[-*]\s*)?(Miss:.+)$/;
/**
 * Pure. `known` holds `${date}|${ask}|${key}` of rows already written, so a rerun adds nothing.
 * Findings fire only for misses new this pass (escalation) or malformed ones (until fixed).
 */
export function syncMisses({ punchlist, date, ledger, known }) {
  const rows = [];
  const findings = [];
  const perAsk = new Map(); // ask -> { total, fresh: row[] }
  const seen = new Map(); // ask|line -> occurrences so far
  let ask = null;
  for (const l of punchlist.split('\n')) {
    const h = l.match(/^##\s+Ask\s+(\S+)/);
    if (h) {
      ask = h[1];
      continue;
    }
    if (/^##\s/.test(l)) ask = null;
    const key = ask && l.match(MISS_LINE_RE)?.[1].trim();
    if (!key) continue;
    const parts = key.slice(5).split(' · ').map((s) => s.trim());
    const [cause, rule, caught, changed, ...note] = parts;
    if (parts.length < 5 || !/^rule /.test(rule) || !/^caught by /.test(caught) || !/^changed /.test(changed)) {
      findings.push(`Ask ${ask}: unparseable Miss line — "${key.slice(0, 60)}". Format: Miss: <cause> · rule <id|none> · caught by <who> · changed <what> · <note>.`);
      continue;
    }
    const who = caught.slice(10);
    const what = changed.slice(8);
    const bad = !MISS_CAUSES.has(cause) ? ['cause', cause, MISS_CAUSES]
      : !MISS_CAUGHT.has(who) ? ['caught by', who, MISS_CAUGHT]
      : !MISS_CHANGED.has(what) ? ['changed', what, MISS_CHANGED]
      : null;
    if (bad) {
      findings.push(`Ask ${ask}: unknown ${bad[0]} "${bad[1]}" — use one of ${[...bad[2]].join(', ')}.`);
      continue;
    }
    const a = perAsk.get(ask) ?? { total: 0, fresh: [] };
    a.total += 1;
    perAsk.set(ask, a);
    // The nth identical line on an ask is its own miss: key#2, key#3.
    const occ = (seen.get(`${ask}|${key}`) ?? 0) + 1;
    seen.set(`${ask}|${key}`, occ);
    const rowKey = occ > 1 ? `${key}#${occ}` : key;
    if (known.has(`${date}|${ask}|${rowKey}`)) continue;
    const mine = ledger.filter((r) => String(r.ask) === ask);
    const last = mine.at(-1) ?? {};
    const row = {
      date, ask, cause, rule: rule.slice(5), caughtBy: who, changed: what,
      note: note.join(' · ').split(/\s+/).slice(0, 12).join(' '),
      model: last.model ?? null, effort: last.effort ?? null, agentType: last.agentType ?? null,
      round: a.total, dispatches: mine.length, assignedBy: 'architect', key: rowKey,
    };
    rows.push(row);
    a.fresh.push({ row, nth: a.total });
  }
  for (const [id, { total, fresh }] of perAsk) {
    if (fresh.length === 0) continue;
    if (total >= 3) {
      findings.push(`Ask ${id}: third miss — stop; take the record to the owner before another round.`);
    } else if (fresh.some((f) => f.nth >= 2 && f.row.changed === 'none')) {
      findings.push(`Ask ${id}: second miss with changed none — the same ask failed twice and nothing changed; change the tier, spec, mechanism or brief.`);
    }
  }
  return { rows, findings };
}

// ---- Stop: the round auditor ----
export function parseTranscript(raw) {
  const dispatches = [];
  const editedPaths = [];
  const reads = []; // whole-file reads the architect pulled into its own context
  const notifications = {}; // Agent tool_use id -> subagent tokens, from task-notifications
  for (const line of raw.split('\n')) {
    if (line.includes('task-notification')) {
      const id = line.match(/<tool-use-id>(toolu_[A-Za-z0-9]+)<\/tool-use-id>/);
      const tok = line.match(/<subagent_tokens>(\d+)<\/subagent_tokens>/);
      if (id && tok) notifications[id[1]] = Number(tok[1]);
    }
    if (!line.includes('"tool_use"')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const blocks = obj?.message?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (b?.type !== 'tool_use') continue;
      if (DISPATCH_TOOLS.has(b.name)) {
        const prompt = String(b.input?.prompt ?? '');
        dispatches.push({
          id: b.id ?? null,
          model: effectiveModel(b.input).model,
          modelSource: effectiveModel(b.input).source,
          promptChars: prompt.length,
          referencesPunchlist: /punchlist/i.test(prompt),
          review: isReview(b.input),
          motionWork: isMotion(prompt, isReview(b.input)),
          sourced: SOURCED_RE.test(prompt),
          complexReason: reasonFrom(prompt),
        });
      } else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(b.name)) {
        const p = b.input?.file_path ?? b.input?.notebook_path;
        if (p) editedPaths.push(String(p));
      } else if (b.name === 'Read') {
        // A ranged read is a deliberate excerpt; only whole-file reads count.
        if (b.input?.file_path && b.input.offset == null && b.input.limit == null) reads.push(String(b.input.file_path));
      } else if (b.name === 'Bash' || b.name === 'PowerShell') {
        for (const m of String(b.input?.command ?? '').matchAll(/\b(?:cat|Get-Content)\s+"?([^\s"|;&<>]+)"?/g)) {
          reads.push(m[1]);
        }
      }
    }
  }
  return { dispatches, editedPaths, reads, notifications };
}

// ---- worker sweep check (2026-09-21) ----
// Transcripts showed a worker ran verify-sweep when told to and never
// unprompted. The worker agent definitions now carry the instruction; this checks the OUTPUT — did
// a worker that edited UI files actually run it — not whether a skill was read.
const UI_RE = /\.(tsx|jsx|css|scss)$/i;
const SWEEP_RE = /verify-sweep|verify:sweep/;
export function parseWorker(raw) {
  let uiEdits = 0;
  let sourceEdits = 0;
  let ranSweep = false;
  let lastContext = 0; // what the worker was carrying on its final turn
  for (const line of raw.split('\n')) {
    if (!line.includes('"tool_use"') && !line.includes('"usage"')) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const u = obj?.message?.usage;
    if (obj?.type === 'assistant' && u) {
      lastContext = (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    }
    const blocks = obj?.message?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      if (b?.type !== 'tool_use') continue;
      if (['Edit', 'Write', 'MultiEdit'].includes(b.name)) {
        const p = String(b.input?.file_path ?? '');
        if (SOURCE_SKIP_RE.test(p)) continue;
        if (SOURCE_RE.test(p)) sourceEdits += 1;
        if (UI_RE.test(p)) uiEdits += 1;
      } else if (b.name === 'Bash' || b.name === 'PowerShell') {
        if (SWEEP_RE.test(String(b.input?.command ?? ''))) ranSweep = true;
      }
    }
  }
  return { uiEdits, ranSweep, sourceEdits, lastContext };
}

// A lower flag fired on most workers and taught nothing; this one marks the
// top tenth of observed workers by final-turn context.
export const BIG_WORKER_CTX = 300000;
/** Builders nobody reviewed, and workers whose fence was too big to finish lean. */
export function roundGaps(workers, dispatches) {
  const out = [];
  const builders = workers.filter((w) => w.sourceEdits > 0);
  if (builders.length > 0 && !dispatches.some((d) => d.review)) {
    out.push(
      `${builders.length} worker(s) edited source and no independent reviewer ran — a builder grading its own work ` +
        `is the weak spot. Dispatch \`reviewer\` (read-only) on the diff, or state why this round needs none.`,
    );
  }
  const big = workers.filter((w) => w.lastContext > BIG_WORKER_CTX);
  if (big.length > 0) {
    out.push(
      `${big.length} worker(s) ended above ${BIG_WORKER_CTX / 1000}k tokens of context — the fence was too large; ` +
        `late-context workers drop early instructions, including their verify steps. Split the task next time.`,
    );
  }
  return out;
}

const SWEEP_CONFIG = 'verify-sweep.config.json';
/** The session cwd is often the repo root while the app (and its config) sits one folder down. */
export function hasSweepConfig(cwd, exists = existsSync, list = readdirSync) {
  if (exists(join(cwd, SWEEP_CONFIG))) return true;
  try {
    return list(cwd).some((d) => d !== 'node_modules' && exists(join(cwd, d, SWEEP_CONFIG)));
  } catch {
    return false;
  }
}

export function workerSweepGaps(workers, configured) {
  const ui = workers.filter((w) => w.uiEdits > 0);
  if (ui.length === 0) return [];
  if (!configured) {
    return [
      `${ui.length} worker(s) edited UI files but this project has no verify-sweep.config.json — ` +
        `nothing mechanical checked their output (skills/design/references/verify.md, the mechanical floor).`,
    ];
  }
  const skipped = ui.filter((w) => !w.ranSweep);
  if (skipped.length === 0) return [];
  return [
    `${skipped.length} of ${ui.length} UI worker(s) never ran verify-sweep — dispatch UI work to ` +
      `ui-implementer / motion-implementer (the run is in their definition), or run the sweep yourself and paste it.`,
  ];
}

/** Paths over the limit, minus the files an architect is supposed to hold. */
export function bigReads(paths, sizeOf, limit = BIG_READ_BYTES) {
  const out = new Set();
  for (const p of paths) {
    if (READ_EXEMPT_RE.test(p)) continue;
    let size = 0;
    try {
      size = sizeOf(p);
    } catch {
      continue;
    }
    if (size > limit) out.add(p);
  }
  return [...out];
}

export const RISKY_PATH_RE = /auth|login|session|password|payment|billing|stripe|checkout|invoice|migration|\.sql$|(^|[\\/])(api|routes)[\\/]|middleware/i;

export function audit({ dispatches, editedPaths, bigReads: big = [] }, { punchlistExists, punchlistHasBuild, plansDir = false, ledgerRows, triage = [], workers = [] }) {
  const findings = [];
  const sourceEdits = editedPaths.filter((p) => SOURCE_RE.test(p) && !SOURCE_SKIP_RE.test(p));
  const touchedPunchlist = editedPaths.some((p) => /punchlist/i.test(p));

  // Paperwork findings only where the project keeps plans, or the edit is risky.
  const paperwork = plansDir || punchlistExists || sourceEdits.some((p) => RISKY_PATH_RE.test(p));

  if (sourceEdits.length > 0 && paperwork && !punchlistExists && !touchedPunchlist) {
    findings.push(
      `${sourceEdits.length} source file(s) edited with no punchlist for today ` +
        `(docs/superpowers/plans/<date>-punchlist.md) — the round has no verification contract.`,
    );
  } else if (sourceEdits.length > 0 && punchlistHasBuild === false) {
    findings.push(
      `${sourceEdits.length} source file(s) edited but today's punchlist has no "Build:" line — record the ` +
        `inline/dispatch route per ask (trigger, fences, interface, est lines, review) before building ` +
        `(shared/dispatch.md).`,
    );
  }
  const fat = dispatches.filter((d) => d.promptChars > PROMPT_SPEC_CHARS && !d.referencesPunchlist);
  if (fat.length > 0) {
    findings.push(
      `${fat.length} dispatch prompt(s) over ${PROMPT_SPEC_CHARS} chars with no punchlist reference — ` +
        `specs belong in the punchlist file, prompts carry the pointer plus deltas (shared/dispatch.md).`,
    );
  }
  if (dispatches.length > ledgerRows) {
    findings.push(
      `${dispatches.length} dispatch(es) but only ${ledgerRows} ledger row(s) today — ` +
        `the auto-ledger hook is not wired or failed silently.`,
    );
  }
  const unsourced = dispatches.filter((d) => d.motionWork && !d.sourced);
  if (unsourced.length > 0) {
    findings.push(
      `${unsourced.length} motion/section dispatch(es) with no "SOURCE:" line — name the reference's source file ` +
        `the mechanism comes from, or "SOURCE: none — <why hand-built>".`,
    );
  }
  const opusBlind = dispatches.filter((d) => isOpus(d.model) && d.modelSource !== 'default' && !d.complexReason);
  if (opusBlind.length > 0) {
    findings.push(
      `${opusBlind.length} opus dispatch(es) with no "COMPLEX: <reason>" line in the prompt — ` +
        `opus is for silently-wrong work only; state the reason or route to sonnet (shared/architect.md).`,
    );
  }
  if (big.length > 0) {
    findings.push(
      `architect read ${big.length} file(s) over ${BIG_READ_BYTES / 1024} KB into its own context ` +
        `(${big.slice(0, 4).join(', ')}${big.length > 4 ? ', …' : ''}) — large reads are a delegation ` +
        `trigger (shared/architect.md, delegation floor); dispatch the read, keep the summary.`,
    );
  }
  findings.push(...workers, ...triage);
  return findings;
}

/** Append new Miss rows to misses.jsonl (the folder already exists: the punchlist is in it). Returns findings; never throws. */
function recordMisses(file, punchlist, date, ledger) {
  try {
    let existing = [];
    try {
      existing = readLedger(file);
    } catch {
      /* first sync */
    }
    const known = new Set(existing.map((r) => `${r.date}|${r.ask}|${r.key}`));
    const { rows, findings } = syncMisses({ punchlist, date, ledger, known });
    if (rows.length > 0) appendFileSync(file, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8');
    return findings;
  } catch {
    return [];
  }
}

function runStop(payload) {
  if (payload.stop_hook_active) return;
  const cwd = payload.cwd ?? process.cwd();
  const date = localDate();
  // One audit per round: the marker holds how many transcript lines earlier
  // rounds already audited, so each Stop reads only its own round. The token
  // back-fill needs the whole transcript (a notification can land a round late).
  const marker = join(tmpdir(), `kc-dispatch-audit-${payload.session_id ?? 'unknown'}`);
  let waiting = false;
  try {
    waiting = readLedger(ledgerPath(cwd, date)).some((r) => r.actualTokens == null && r.toolUseId);
  } catch {
    /* no ledger today */
  }

  let raw = '';
  try {
    raw = readFileSync(payload.transcript_path, 'utf8');
  } catch {
    return; // No transcript, nothing to audit.
  }
  if (waiting) backfillLedger(cwd, date, parseTranscript(raw).notifications);
  let mark = 0;
  try {
    mark = Number(readFileSync(marker, 'utf8')) || 0;
  } catch {
    /* first round */
  }
  const round = sinceMark(raw, mark);
  try {
    writeFileSync(marker, String(round.mark), 'utf8');
  } catch {
    /* marker is best-effort */
  }
  const parsed = parseTranscript(round.slice);

  parsed.bigReads = bigReads(parsed.reads, (p) => statSync(isAbsolute(p) ? p : join(cwd, p)).size);
  let punchlistExists = false;
  let punchlistHasBuild;
  const plansDir = existsSync(join(cwd, 'docs', 'superpowers', 'plans'));
  let missFindings = [];
  let ledger = [];
  try {
    ledger = readLedger(ledgerPath(cwd, date));
  } catch {
    /* no ledger today */
  }
  const ledgerRows = ledger.length;
  try {
    const dir = join(cwd, 'docs', 'superpowers', 'plans');
    const lists = readdirSync(dir).filter((f) => f.startsWith(date) && /punchlist/i.test(f));
    punchlistExists = lists.length > 0;
    if (punchlistExists) {
      const texts = lists.map((f) => readFileSync(join(dir, f), 'utf8'));
      punchlistHasBuild = texts.some((t) => BUILD_LINE_RE.test(t));
      missFindings = recordMisses(join(dir, 'misses.jsonl'), texts.join('\n'), date, ledger);
    }
  } catch {
    /* no plans dir */
  }
  if (parsed.dispatches.length === 0 && parsed.editedPaths.length === 0 && missFindings.length === 0) return;

  const learn = (name) => {
    try {
      return readFileSync(join(notesDir(), name), 'utf8');
    } catch {
      return '';
    }
  };
  const triage = learningsTriage({ code: learn('CODE-LEARNINGS.md'), design: learn('DESIGN-LEARNINGS.md') });
  // Worker transcripts sit beside the session's own: <session>/subagents/agent-*.jsonl
  let workers = [];
  if (parsed.dispatches.length > 0) try {
    const dir = join(payload.transcript_path.replace(/\.jsonl$/, ''), 'subagents');
    const parsedWorkers = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => parseWorker(readFileSync(join(dir, f), 'utf8')));
    workers = [...workerSweepGaps(parsedWorkers, hasSweepConfig(cwd)), ...roundGaps(parsedWorkers, parsed.dispatches)];
  } catch {
    /* no workers this session */
  }
  const findings = [...audit(parsed, { punchlistExists, punchlistHasBuild, plansDir, ledgerRows, triage, workers }), ...missFindings];
  if (findings.length === 0) return;

  process.stdout.write(
    `${JSON.stringify({
      decision: 'block',
      reason:
        `[punchlist dispatch audit] Round-discipline findings to triage before stopping ` +
        `(fix, or state in one line why each stands):\n- ${findings.join('\n- ')}`,
    })}\n`,
  );
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => {
    raw += c;
  });
  process.stdin.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      process.exit(0); // Unparseable input must never block the user.
    }
    if (payload.hook_event_name === 'Stop') {
      runStop(payload);
      process.exit(0);
    }
    const { deny, report } = guard(payload);
    if (deny) {
      process.stderr.write(`${report}\n`);
      process.exit(2);
    }
    const row = ledgerRow(payload);
    if (row) appendLedger(row, payload.cwd ?? process.cwd());
    process.exit(0);
  });
}
