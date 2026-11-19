import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { aggregate, compact, parseRows } from './misses.mjs';

const row = (extra = {}) => ({ date: '2025-11-18', ask: '3', cause: 'no-check', rule: 'R1', caughtBy: 'test', changed: 'mechanism', model: 'sonnet', effort: 'medium', agentType: 'service-implementer', round: 1, ...extra });
const many = (n, extra) => Array.from({ length: n }, (_, i) => row({ ask: String(i), ...(typeof extra === 'function' ? extra(i) : extra) }));

test('parseRows skips blank and malformed lines', () => {
  assert.equal(parseRows(`${JSON.stringify(row())}\n\nnot json\n[1]\n"x"\n${JSON.stringify(row())}\n`).length, 2);
});

test('empty input prints one honest line', () => {
  assert.deepEqual(aggregate([]), ['misses: none recorded (N=0)']);
});

test('N sits beside every figure; no percentage under N 20, one at N 20', () => {
  const small = aggregate(many(19, (i) => ({ cause: i < 12 ? 'no-check' : 'taste' }))).join('\n');
  assert.doesNotMatch(small, /%/);
  assert.match(small, /no-check 12\/19/);
  const big = aggregate(many(20, (i) => ({ cause: i < 10 ? 'no-check' : 'taste' }))).join('\n');
  assert.match(big, /no-check 10\/20 50%/);
});

test('counts by cause, rule, and cause x model; first-pass by model; rework share', () => {
  const rows = [
    row({ cause: 'no-check', rule: 'R1', model: 'sonnet', round: 1 }),
    row({ cause: 'no-check', rule: 'R1', model: 'sonnet', round: 2 }),
    row({ cause: 'taste', rule: 'none', model: 'opus', round: 1 }),
  ];
  const out = aggregate(rows).join('\n');
  assert.match(out, /by cause: no-check 2\/3 · taste 1\/3/);
  assert.match(out, /by rule: R1 2\/3 · none 1\/3/);
  assert.match(out, /sonnet \(N=2\): no-check 2\/2/);
  assert.match(out, /first-pass: 2\/3 · by model: sonnet 1\/2 · opus 1\/1/);
  assert.match(out, /rework: 1\/3/);
});

test('output never exceeds 25 lines, however many models and rules', () => {
  const rows = many(200, (i) => ({ model: 'm' + (i % 40), rule: 'r' + (i % 60), cause: 'taste' }));
  assert.ok(aggregate(rows).length <= 25);
});

test('compact folds rows older than 90 days into monthly counts and keeps recent rows', () => {
  const now = Date.parse('2025-11-19T00:00:00Z');
  const old = [row({ date: '2025-05-02', round: 1 }), row({ date: '2025-05-20', round: 2 }), row({ date: '2025-05-21', cause: 'taste' })];
  const out = compact([...old, row({ date: '2025-11-01' })], now);
  assert.equal(out.length, 4); // 3 old rows -> 3 groups (rework split, cause split) ... plus the recent one
  assert.ok(out.some((r) => r.date === '2025-11-01' && r.ask));
  const folded = out.filter((r) => r.month === '2025-05');
  assert.equal(folded.reduce((n, r) => n + r.n, 0), 3);
  assert.ok(folded.every((r) => !r.date && !r.ask && !r.note));
});

test('compacted rows keep counting: aggregate weights by n; compact twice is a no-op', () => {
  const now = Date.parse('2025-11-19T00:00:00Z');
  const once = compact(many(5, { date: '2025-05-02' }), now);
  assert.equal(once.length, 1);
  assert.equal(once[0].n, 5);
  assert.deepEqual(compact(once, now), once);
  assert.match(aggregate(once).join('\n'), /no-check 5\/5/);
});

test('CLI: reads the path argument; --compact rewrites it; missing path exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'misses-'));
  const file = join(dir, 'misses.jsonl');
  writeFileSync(file, [row({ date: '2020-01-05' }), row({ date: '2020-01-09' }), row()].map((r) => JSON.stringify(r)).join('\n') + '\n');
  const script = fileURLToPath(new URL('./misses.mjs', import.meta.url));
  const out = execFileSync('node', [script, file], { encoding: 'utf8' });
  assert.match(out, /N=3/);
  execFileSync('node', [script, file, '--compact'], { encoding: 'utf8' });
  assert.equal(readFileSync(file, 'utf8').trim().split('\n').length, 2);
  assert.throws(() => execFileSync('node', [script], { stdio: 'pipe' }), (e) => e.status === 2);
});

test('rows without round or model never produce a rate: n/a with the row count', () => {
  const bare = [{ date: '2025-08-27', area: 'code', cause: 'unclear', caughtBy: 'test' }, { date: '2025-08-27', area: 'code', cause: 'taste', caughtBy: 'hook' }];
  const out = aggregate(bare).join('\n');
  assert.match(out, /first-pass: n\/a \(no round on 2 rows\)/);
  assert.match(out, /rework: n\/a \(no round on 2 rows\)/);
  assert.match(out, /by cause × model: n\/a \(no model on 2 rows\)/);
  assert.doesNotMatch(out, /100%|0%/);
});

test('mixed rows: rows without round are left out of the rate and counted', () => {
  const rows = [row({ round: 1 }), row({ round: 2 }), { cause: 'taste', caughtBy: 'owner' }];
  const out = aggregate(rows).join('\n');
  assert.match(out, /first-pass: 1\/2/);
  assert.match(out, /1 row without round left out/);
  assert.match(out, /by cause × model \(1 row without model left out\):/);
});

test('compacted rows use caughtBy and keep an unknown model unknown', () => {
  const now = Date.parse('2025-11-19T00:00:00Z');
  const [g] = compact([{ date: '2025-05-02', cause: 'taste', caughtBy: 'owner' }], now);
  assert.equal(g.caughtBy, 'owner');
  assert.ok(!('caught_by' in g) && !('model' in g) && !('rework' in g));
});
