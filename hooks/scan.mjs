#!/usr/bin/env node
// punchlist mechanical critic.
//
// PreToolUse  — hard-denies secrets, missing RLS, and interpolated SQL on the
//               Edit/Write/MultiEdit/NotebookEdit path, before the write lands.
// PostToolUse — advisory only; also appends every finding to CODE-LEARNINGS.md
//               so the learnings loop closes without a human in it.
//
// Threat model — stated plainly: this guards against an honest model's
// carelessness on the edit path. It does NOT cover Bash redirects/heredocs,
// MCP tools (e.g. apply_migration), or an agent that annotates its own
// override — those are named limitations, backstopped by skills/code/references/verify.md's
// git-history sweep, not silently claimed.
//
// Exit contract: 0 = allow, 2 + stderr = deny.

import { appendFileSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { notesDir } from './notes.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  detectSecrets,
  detectMissingRLS,
  detectSqlInterpolation,
  hasOverride,
  getOverrides,
} from './detectors.mjs';

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
// Skipped: placeholder env files, KNOWN lockfiles by exact name (a `.lock`
// wildcard here was an adversarially-proven bypass — `secrets.lock` walked
// straight through), and this skill's own *test fixtures* only. The gate's
// executable files (scan.mjs, detectors.mjs) stay under watch: exempting the
// whole hooks dir made the one directory whose compromise disables the gate
// the one directory the gate wouldn't inspect.
const SKIP =
  /(^|[/\\])(\.env\.example|\.env\.sample|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock)$/i;
// This folder's own test fixtures, wherever the plugin is installed.
const HOOKS_DIR = resolve(dirname(fileURLToPath(import.meta.url))).toLowerCase();
const isOwnTest = (p) => /\.test\.mjs$/i.test(p) && dirname(resolve(p)).toLowerCase() === HOOKS_DIR;
const LEARNINGS = join(notesDir(), 'CODE-LEARNINGS.md');

export function extractContent(payload) {
  const i = payload.tool_input ?? {};
  if (typeof i.content === 'string') return i.content;
  if (typeof i.new_string === 'string') return i.new_string;
  if (typeof i.new_source === 'string') return i.new_source; // NotebookEdit
  if (Array.isArray(i.edits)) return i.edits.map((e) => e.new_string ?? '').join('\n');
  return '';
}

// Tier 2 — advisory. `whole` rules span lines; the rest are per-line.
const ADVISORY = [
  {
    rule: 'definer-search-path',
    whole: (c) => /SECURITY\s+DEFINER/i.test(c) && !/SET\s+search_path/i.test(c),
    anchor: /SECURITY\s+DEFINER/i,
    message:
      '`SECURITY DEFINER` without a pinned `SET search_path` — the function is hijackable.',
  },
  {
    rule: 'eval',
    test: (l) => /\b(eval|new Function)\s*\(/.test(l),
    message: 'Dynamic code execution at a possible trust boundary.',
  },
  {
    rule: 'rls-permissive',
    test: (l) => /CREATE\s+POLICY/i.test(l) && /USING\s*\(\s*true\s*\)/i.test(l),
    message: 'Policy uses `USING (true)` — RLS is enabled but permits everything.',
  },
];

function advisoryFindings(content) {
  const findings = [];
  const lines = content.split('\n');

  for (const a of ADVISORY) {
    if (!a.whole) continue;
    if (!a.whole(content)) continue;
    const idx = lines.findIndex((l) => a.anchor.test(l));
    if (idx < 0 || hasOverride(lines[idx], a.rule)) continue;
    findings.push({
      rule: a.rule,
      line: idx + 1,
      excerpt: lines[idx].trim().slice(0, 80),
      message: a.message,
    });
  }

  lines.forEach((line, i) => {
    for (const a of ADVISORY) {
      if (a.whole || hasOverride(line, a.rule)) continue;
      if (a.test(line)) {
        findings.push({
          rule: a.rule,
          line: i + 1,
          excerpt: line.trim().slice(0, 80),
          message: a.message,
        });
      }
    }
  });

  return findings;
}

function format(findings, path, isPre) {
  const head = isPre
    ? `punchlist BLOCKED this write to ${path}:`
    : `punchlist advisory for ${path}:`;
  const body = findings
    .map((f) => `  • [${f.rule}] line ${f.line}: ${f.message}\n    ${f.excerpt}`)
    .join('\n');
  const foot = isPre
    ? '\n\nFix the cause, or — if this is deliberate and safe — annotate the exact line:\n' +
      '  punchlist:allow <rule> — <reason>\n' +
      'e.g. punchlist:allow secret — fixture, not a live credential'
    : '';
  return `${head}\n${body}${foot}`;
}

export function evaluate(payload) {
  const empty = { deny: false, findings: [], overrides: [], report: '' };
  if (!EDIT_TOOLS.has(payload.tool_name)) return empty;

  const path =
    payload.tool_input?.file_path ?? payload.tool_input?.notebook_path ?? '';
  if (SKIP.test(path) || isOwnTest(path)) return empty;

  const content = extractContent(payload);
  if (!content) return empty;

  const isPre = payload.hook_event_name === 'PreToolUse';

  // Docs get the secret scan only. Prose *about* SQL injection and permissive
  // policies otherwise fires the code rules, and example annotations in prose
  // get logged as fake overrides — this file's own reference docs proved it.
  const isDoc = /\.(md|mdx|markdown|rst|txt)$/i.test(path);

  const blocking = isDoc
    ? detectSecrets(content)
    : [
        ...detectSecrets(content),
        ...detectMissingRLS(content, path),
        ...detectSqlInterpolation(content),
      ];

  // Overrides suppress findings inside the detectors, so they are collected
  // separately here — otherwise every override is invisible to the learnings
  // loop and the blocked-vs-override ratio can never be computed. In docs,
  // only overrides that are actually clearing a secret block are real.
  const overrides = isDoc && blocking.length === 0 ? [] : getOverrides(content);

  const findings =
    isPre || isDoc ? blocking : [...blocking, ...advisoryFindings(content)];
  if (findings.length === 0 && overrides.length === 0) return empty;

  return {
    deny: isPre && blocking.length > 0,
    findings,
    overrides,
    report: findings.length ? format(findings, path, isPre) : '',
  };
}

/** Drop entries whose rule+path pair is already recorded — a standing advisory
 *  would otherwise re-append on every save of the file. Line numbers are
 *  ignored on purpose: they shift with every edit. */
export function dedupeEntries(existing, entries) {
  return entries.filter(
    (e) => !existing.includes(`\`${e.rule}\` · ${e.path}:`),
  );
}

// Point-of-use retrieval: surface the 1–3 learnings entries relevant to the
// file being edited, as PostToolUse additionalContext — the lesson arrives
// when it applies, not in a session-start skim. Keyword grep on purpose, not
// embeddings: at learnings-file scale (N≈dozens) brute-force matching wins,
// and vector retrieval degrades silently when store and search drift onto
// different embedders.
const FILE_TOPICS = [
  { re: /\.(sql|pgsql)$|migrat/i, words: /migrat|\bsql\b|\brls\b|policy|data|postgres|schema|backfill|index/i },
  { re: /auth|login|session|middleware/i, words: /auth|session|token|secret|guard|boundary/i },
  // 2026-09-02 (token cost): was every .ts/.tsx, which pushed the three detector notes into context
  // on each UI-component edit where none of them applied (~250 tokens a
  // time, dozens of times a round). Code paths only: scripts, hooks, api,
  // server, lib, workers. Components and content files get nothing.
  { re: /(^|[\\/])(scripts?|hooks?|api|server|lib|workers?|detector[s]?|routes?)[\\/].*\.(ts|js|mjs|py|go|rs)$|\.mjs$/i, words: /api|endpoint|detector|regex|pagination|error|validation/i },
];

/**
 * The notes not yet sent this session. A marker file in the temp dir, keyed by
 * session id, holds a short hash of each note already sent. No session id, or
 * any file error: send everything, never throw.
 */
export function newNotes(notes, sessionId, dir = tmpdir()) {
  if (!sessionId) return notes;
  try {
    const file = join(dir, `punchlist-notes-${String(sessionId).replace(/\W/g, '_')}`);
    let sent = [];
    try {
      sent = readFileSync(file, 'utf8').split('\n');
    } catch {
      /* first note of the session */
    }
    const hash = (n) => createHash('sha1').update(n).digest('hex').slice(0, 10);
    const fresh = notes.filter((n) => !sent.includes(hash(n)));
    if (fresh.length) appendFileSync(file, `${fresh.map(hash).join('\n')}\n`, 'utf8');
    return fresh;
  } catch {
    return notes;
  }
}

export function relevantLearnings(md, filePath) {
  const topics = FILE_TOPICS.filter((t) => t.re.test(filePath));
  if (topics.length === 0) return [];
  // An entry = its dated first line plus indented continuation lines.
  const entries = [];
  for (const line of md.split('\n')) {
    if (/^- \d{4}-\d{2}-\d{2} · /.test(line)) entries.push(line);
    else if (/^\s+\S/.test(line) && entries.length) entries[entries.length - 1] += ` ${line.trim()}`;
  }
  return entries
    .filter((e) => !/ · (BLOCKED|advisory|override|triage-due) · /.test(e)) // Notes, not hook noise
    .filter((e) => topics.some((t) => t.words.test(e)))
    .slice(-3);
}

/** Local date, not UTC — an audit trail stamped "tomorrow" reads as forged. */
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Entries under the real `## Hook catches` heading. The file's intro mentions
 *  the heading in backticks, so a bare substring split counted the wrong slice
 *  and the triage trigger never fired (found 2026-09-10, 32 rows deep). */
export function hookCatchCount(whole) {
  const i = whole.indexOf('\n## Hook catches\n');
  if (i < 0) return 0;
  return whole
    .slice(i)
    .split('\n')
    .filter((l) => /^- \d{4}-\d{2}-\d{2} · (BLOCKED|override|advisory) ·/.test(l)).length;
}

/** A `scratchpad` directory segment, exactly — not a pattern (skip-list rule). */
export function isScratchPath(path) {
  return /(^|[\\/])scratchpad([\\/]|$)/.test(String(path));
}

/** Append findings and overrides to the field-notes file. Never throws. */
function recordLearnings(findings, overrides, path, denied) {
  try {
    mkdirSync(dirname(LEARNINGS), { recursive: true });
    let whole = '';
    try {
      whole = readFileSync(LEARNINGS, 'utf8');
    } catch {
      /* first write */
    }
    const existing = whole.split('\n').slice(-120).join('\n');
    const stamp = localDate();
    // Advisories on throwaway probe scripts were 28 of 32 logged rows by
    // 2026-09-10 and never actionable; blocks on the same paths still log.
    const loggable = denied || !isScratchPath(path) ? findings : [];
    const entries = [
      ...loggable.map((f) => ({
        kind: denied ? 'BLOCKED' : 'advisory',
        rule: f.rule,
        path,
        line: f.line,
        message: f.message,
      })),
      ...overrides.map((o) => ({
        kind: 'override',
        rule: o.rule,
        path,
        line: o.line,
        message: o.reason,
      })),
    ];
    // The ~20-entry triage trigger has a counter here — the hook is the only
    // writer positioned to count. Without this the trigger can never fire.
    const catchCount = hookCatchCount(whole);
    if (catchCount >= 20) {
      entries.push({
        kind: 'triage-due',
        rule: 'trigger',
        path: '-',
        line: 0,
        message: `Hook catches holds ${catchCount} entries — run the triage pass (promote / ablate / prune).`,
      });
    }

    // Write-anomaly bound: one edit yielding a flood of entries is a broken
    // detector, not twenty lessons — cap the append, keep the trail sane.
    const kept = dedupeEntries(existing, entries).slice(0, 10);
    if (kept.length === 0) return;
    const lines = kept.map(
      (e) => `- ${stamp} · ${e.kind} · \`${e.rule}\` · ${e.path}:${e.line} — ${e.message}`,
    );
    appendFileSync(LEARNINGS, `${lines.join('\n')}\n`, 'utf8');
  } catch {
    // Bookkeeping must never break a write.
  }
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
    const { deny, findings, overrides, report } = evaluate(payload);
    const path = payload.tool_input?.file_path ?? payload.tool_input?.notebook_path ?? '';
    if (findings.length > 0 || overrides.length > 0) {
      recordLearnings(findings, overrides, path, deny);
      if (report) process.stderr.write(`${report}\n`);
    }
    // Post-only, non-blocking: hand relevant field notes to the session.
    if (payload.hook_event_name === 'PostToolUse' && !deny && path) {
      try {
        const md = readFileSync(LEARNINGS, 'utf8');
        const hits = newNotes(relevantLearnings(md, path), payload.session_id);
        if (hits.length) {
          process.stdout.write(
            `${JSON.stringify({
              hookSpecificOutput: {
                hookEventName: 'PostToolUse',
                additionalContext: `Field notes matching this file (CODE-LEARNINGS.md):\n${hits.join('\n')}`,
              },
            })}\n`,
          );
        }
      } catch {
        /* no learnings file yet */
      }
    }
    process.exit(deny ? 2 : 0);
  });
}
