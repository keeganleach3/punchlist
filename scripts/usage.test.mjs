import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUsage, countLearnings } from './usage.mjs';

const line = (model, inTok, outTok, cacheRead, ts) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: ts,
    message: {
      model,
      usage: {
        input_tokens: inTok,
        output_tokens: outTok,
        cache_read_input_tokens: cacheRead,
      },
    },
  });

test('aggregates tokens per model', () => {
  const lines = [
    line('claude-opus-5', 100, 500, 2000, '2026-08-27T10:00:00Z'),
    line('claude-opus-5', 50, 300, 1000, '2026-08-27T11:00:00Z'),
    line('claude-haiku-4-5', 10, 200, 0, '2026-08-27T12:00:00Z'),
    'not json at all',
    JSON.stringify({ type: 'user', message: {} }),
  ];
  const r = parseUsage(lines);
  assert.equal(r.models['claude-opus-5'].out, 800);
  assert.equal(r.models['claude-opus-5'].msgs, 2);
  assert.equal(r.models['claude-haiku-4-5'].out, 200);
  assert.equal(r.total.out, 1000);
  assert.equal(r.total.cacheRead, 3000);
});

test('ignores messages with no usage', () => {
  const r = parseUsage([
    JSON.stringify({ type: 'assistant', message: { model: 'x' } }),
  ]);
  assert.equal(r.total.out, 0);
});

test('renderHtml carries KPIs, zero-based bars, and a traceable source', async () => {
  const { renderHtml } = await import('./usage.mjs');
  const data = {
    models: {
      'claude-opus-5': { msgs: 10, in: 5, out: 900, cacheRead: 100, cacheWrite: 50 },
      'claude-haiku-4-5': { msgs: 5, in: 2, out: 100, cacheRead: 10, cacheWrite: 5 },
    },
    total: { msgs: 15, in: 7, out: 1000, cacheRead: 110, cacheWrite: 55 },
  };
  const gate = { blocked: 3, override: 1, advisory: 2 };
  const html = renderHtml(data, gate, [], { days: 7, dir: 'X:/transcripts', sessions: 4 });
  assert.match(html, /1,000|1000/); // total out KPI present
  assert.match(html, /claude-opus-5/);
  assert.match(html, /tabular-nums/); // hard rule: tabular figures
  assert.match(html, /X:\/transcripts/); // traceable source in footer
  assert.match(html, /collecting/i); // <2 snapshots → honest empty trend state
  // zero-based bars: haiku bar width must be exactly out/max of the widest
  assert.match(html, /width:\s*11(\.1)?%/); // 100/900 ≈ 11.1%
});

test('renderHtml draws a trend once history has 2+ snapshots', async () => {
  const { renderHtml } = await import('./usage.mjs');
  const data = { models: {}, total: { msgs: 0, in: 0, out: 0, cacheRead: 0, cacheWrite: 0 } };
  const hist = [
    { date: '2026-08-25', out: 500, blocked: 2, override: 0 },
    { date: '2026-08-26', out: 800, blocked: 1, override: 1 },
  ];
  const html = renderHtml(data, { blocked: 0, override: 0, advisory: 0 }, hist, {
    days: 7, dir: 'd', sessions: 1,
  });
  assert.match(html, /polyline|path/);
  assert.doesNotMatch(html, /collecting/i);
});

test('counts learnings entries by kind', () => {
  const md = [
    '- 2026-08-27 · BLOCKED · `secret` · a.ts:1 — x',
    '- 2026-08-27 · override · `secret` · b.ts:1 — y',
    '- 2026-08-27 · advisory · `eval` · c.ts:1 — z',
    '- 2026-08-27 · BLOCKED · `rls` · d.sql:1 — w',
    'prose line',
  ].join('\n');
  const c = countLearnings(md);
  assert.equal(c.blocked, 2);
  assert.equal(c.override, 1);
  assert.equal(c.advisory, 1);
});

test('counts escapes (owner and the legacy tag) and panel catches separately', () => {
  const md = [
    '- 2026-08-27 · api · pagination — the model returned unbounded lists.',
    '  Correct: cursor + limit. Caught by: ' + ['Kee', 'gan'].join('') + '.',
    '  Correct: y. Caught by: owner.',
    '- 2026-08-27 · detectors · x — y. Correct: z. Caught by: audit.',
    '- 2026-08-26 · claims · a — b. Correct: c. Caught by: panel.',
    '- 2026-08-26 · detectors · d — e. Correct: f. Caught by: test.',
  ].join('\n');
  const c = countLearnings(md);
  assert.equal(c.escaped, 2); // reached the owner = an escape
  assert.equal(c.panel, 1);
});

test('countVerified reads all punchlist shapes: architect checklist boxes, [V] states, and an Architect column', async () => {
  const { countVerified } = await import('./usage.mjs');
  const md = [
    '- [x] Architect verified in browser (live DOM: gap 40px)',
    '- [ ] Architect verified in the browser',
    '- [x] Verify the wrapper clip',
    '- [x] architect eyes at 390/1920x1080 (played states)',
    '- [V] Phase 1 measured (architect, prod preview)',
    '- [B] built (agent)',
    '',
    '| # | Defect | Owner | Built | Architect | Owner |',
    '|---|---|---|---|---|---|',
    '| M1 | "Architect said" | A | ☑ | ☑ | ☐ |',
    '| M2 | x | A | ☑ | ☐ | ☐ |',
    '| M3 | x | A | ☑ | [x] | ☐ |',
    '',
    '| step | tier |',
    '|---|---|',
    '| Architect review ☑ | opus |',
  ].join('\n');
  assert.equal(countVerified(md), 5);
});

test('ledgerTokens sums actualTokens inside the window and counts unreported rows', async () => {
  const { ledgerTokens } = await import('./usage.mjs');
  const row = (ts, actualTokens) => JSON.stringify({ ts, step: 's', model: 'sonnet', actualTokens });
  const r = ledgerTokens(
    [
      row('2026-09-19T10:00:00Z', 200000),
      row('2026-09-19T11:00:00Z', null),
      row('2026-08-01T10:00:00Z', 999999),
      'not json',
    ],
    Date.parse('2026-09-01T00:00:00Z'),
  );
  assert.deepEqual(r, { tokens: 200000, rows: 2, missing: 1 });
});

import { mkdtempSync, existsSync, mkdirSync, writeFileSync, readFileSync as readFile } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs, sameWindow } from './usage.mjs';

test('parseArgs reads flags by name, not position', () => {
  assert.deepEqual(parseArgs([]), { days: 7, dir: null, html: false, record: false });
  assert.equal(parseArgs(['--html', '--days', '30']).days, 30);
  assert.equal(parseArgs(['--dir', 'x']).days, 7);
  assert.equal(parseArgs(['--dir', 'x']).dir, 'x');
  assert.equal(parseArgs(['--record']).record, true);
});

test('parseArgs rejects a missing or non-positive --days instead of guessing', () => {
  for (const bad of [['--days'], ['--days', 'abc'], ['--days', '0'], ['--days', '--html'], ['--dir']]) {
    assert.throws(() => parseArgs(bad), /--(days|dir)/, bad.join(' '));
  }
});

test('sameWindow keeps only snapshots taken with the same --days', () => {
  const h = [{ days: 7, out: 1 }, { days: 60, out: 9 }, { days: 7, out: 2 }, { out: 5 }];
  assert.deepEqual(sameWindow(h, 7).map((s) => s.out), [1, 2]);
  assert.deepEqual(sameWindow(h, 60).map((s) => s.out), [9]);
});

test('no dynamic imports in usage.mjs', () => {
  assert.doesNotMatch(readFile(fileURLToPath(new URL('./usage.mjs', import.meta.url)), 'utf8'), /await import\(/);
});

test('a plain run writes nothing; --record writes one snapshot', () => {
  const home = mkdtempSync(join(tmpdir(), 'usage-'));
  mkdirSync(join(home, '.claude'));
  const empty = mkdtempSync(join(tmpdir(), 'usage-t-'));
  const script = fileURLToPath(new URL('./usage.mjs', import.meta.url));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const hist = join(home, '.claude', 'usage-history.jsonl');
  execFileSync('node', [script, '--dir', empty, '--days', '3'], { env, cwd: home, encoding: 'utf8' });
  assert.ok(!existsSync(hist));
  execFileSync('node', [script, '--dir', empty, '--days', '3', '--record'], { env, cwd: home, encoding: 'utf8' });
  const rows = readFile(hist, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].days, 3);
});

test('the notes folder comes from hooks/notes.mjs (PUNCHLIST_NOTES_DIR)', () => {
  const home = mkdtempSync(join(tmpdir(), 'usage-h-'));
  const notes = mkdtempSync(join(tmpdir(), 'usage-n-'));
  const empty = mkdtempSync(join(tmpdir(), 'usage-t-'));
  writeFileSync(join(notes, 'CODE-LEARNINGS.md'), '- 2026-08-27 · BLOCKED · `secret` · a.ts:1 — x\n');
  const script = fileURLToPath(new URL('./usage.mjs', import.meta.url));
  const env = { ...process.env, HOME: home, USERPROFILE: home, PUNCHLIST_NOTES_DIR: notes };
  const out = execFileSync('node', [script, '--dir', empty, '--record'], { env, cwd: home, encoding: 'utf8' });
  assert.match(out, /CODE-LEARNINGS\.md: \d+ lines · blocked 1/);
  assert.ok(existsSync(join(notes, 'usage-history.jsonl')));
});
