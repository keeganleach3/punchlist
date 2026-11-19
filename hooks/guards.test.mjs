import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendLedger, audit, bigReads, ledgerPath, ledgerRow, parseTranscript, sinceMark, syncMisses } from './dispatch.mjs';
import { detectSecrets } from './detectors.mjs';
import { evaluate } from './scan.mjs';

const line = (blocks) => JSON.stringify({ message: { content: blocks } });
const agent = (input) => line([{ type: 'tool_use', name: 'Agent', input }]);
const post = (input) => ({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: input, tool_response: '' });
const HERE = dirname(fileURLToPath(import.meta.url));
// Assembled at runtime so no literal key shape sits in this file.
const fakeKey = (prefix) => `${prefix}${'aB3_x-9Qz'.repeat(5)}`;

// OpenAI project keys carry hyphens and underscores
test('detects an OpenAI project key', () => {
  assert.equal(detectSecrets(`const k = "${fakeKey('sk-proj-')}";`).length > 0, true);
});

// the ledger never creates the plans folder
test('appendLedger writes only when docs/superpowers/plans exists', () => {
  const bare = mkdtempSync(join(tmpdir(), 'pl-bare-'));
  appendLedger({ a: 1 }, bare);
  assert.equal(existsSync(join(bare, 'docs')), false);
  const ready = mkdtempSync(join(tmpdir(), 'pl-ready-'));
  mkdirSync(join(ready, 'docs', 'superpowers', 'plans'), { recursive: true });
  appendLedger({ a: 1 }, ready);
  assert.match(readFileSync(ledgerPath(ready), 'utf8'), /"a":1/);
});

// the audit window is the round, not the session
test('sinceMark returns only lines after the last audited line', () => {
  assert.deepEqual(sinceMark('a\nb\nc', 0), { slice: 'a\nb\nc', mark: 3 });
  assert.deepEqual(sinceMark('a\nb\nc\nd', 3), { slice: 'd', mark: 4 });
  assert.deepEqual(sinceMark('a\nb', 9), { slice: '', mark: 2 });
});

// opus matched one way; review and motion detection
test('audit flags a full opus model id with no reason', () => {
  const f = audit(
    { dispatches: [{ model: 'claude-opus-4-1', promptChars: 1, referencesPunchlist: true, complexReason: null }], editedPaths: [] },
    { punchlistExists: true, punchlistHasBuild: true, ledgerRows: 1 },
  );
  assert.match(f.join('\n'), /1 opus dispatch/);
});

test('"implement review feedback" is a builder, not a reviewer', () => {
  const { dispatches } = parseTranscript(
    [
      agent({ model: 'sonnet', description: 'implement review feedback', prompt: 'x' }),
      agent({ model: 'sonnet', subagent_type: 'reviewer', description: 'check diff', prompt: 'x' }),
      agent({ model: 'sonnet', description: 'Review the diff', prompt: 'x' }),
    ].join('\n'),
  );
  assert.deepEqual(dispatches.map((d) => d.review), [false, true, true]);
});

test('section, head, hero, band alone are not motion work', () => {
  for (const p of ['edit the hero copy', 'fix the section order', 'rename the head tag', 'band names list']) {
    assert.equal(ledgerRow(post({ model: 'sonnet', prompt: p })).motionWork, false, p);
  }
  assert.equal(ledgerRow(post({ model: 'sonnet', prompt: 'add a scroll reveal' })).motionWork, true);
});

// image reads are not big reads
test('image reads are exempt from the big-read flag', () => {
  const sizeOf = () => 10 ** 6;
  assert.deepEqual(bigReads(['a/shot.png', 'b.JPG', 'c.webp', 'd.jpeg'], sizeOf), []);
  assert.deepEqual(bigReads(['big.ts'], sizeOf), ['big.ts']);
});

// scan skip list does not depend on the install folder name
test("scan skips this folder's own tests and nothing else named *.test.mjs", () => {
  const content = `const apiKey = "${fakeKey('sk-ant-')}";`;
  const ev = (file_path) => evaluate({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path, content } });
  assert.equal(ev(join(HERE, 'x.test.mjs')).deny, false);
  assert.equal(ev(join(tmpdir(), 'hooks', 'x.test.mjs')).deny, true);
  assert.equal(ev(join(HERE, 'scan.mjs')).deny, true);
});

// Miss ledger
test('ASK id lands on the ledger row', () => {
  assert.equal(ledgerRow(post({ model: 'sonnet', prompt: 'ASK: 2\nPunchlist: x' })).ask, '2');
  assert.equal(ledgerRow(post({ model: 'sonnet', prompt: 'no id' })).ask, null);
});

const PL = [
  '## Ask 2 — hooks',
  '- [ ] box',
  'Miss: no-check · rule none · caught by reviewer · changed spec · forgot the negative case',
  '## Ask 3 — scripts',
  'Miss: taste · rule R1 · caught by owner · changed none · wanted shorter',
  'Miss: environment · rule none · caught by hook · changed none · chrome path',
  'Miss: made-up · rule none · caught by hook · changed brief · bad cause',
].join('\n');
const LEDGER = [
  { ask: '2', model: 'sonnet', effort: 'medium', agentType: 'service-implementer' },
  { ask: '2', model: 'opus', effort: 'high', agentType: 'reviewer' },
];

test('syncMisses joins ledger by ask, flags unknown cause, skips known rows', () => {
  const r = syncMisses({ punchlist: PL, date: '2025-06-02', ledger: LEDGER, known: new Set() });
  assert.equal(r.rows.length, 2 + 0 + 1);
  assert.deepEqual(r.rows[0], {
    date: '2025-06-02', ask: '2', cause: 'no-check', rule: 'none', caughtBy: 'reviewer', changed: 'spec',
    note: 'forgot the negative case', model: 'opus', effort: 'high', agentType: 'reviewer', round: 1, dispatches: 2, assignedBy: 'architect',
    key: 'Miss: no-check · rule none · caught by reviewer · changed spec · forgot the negative case',
  });
  assert.match(r.findings.join('\n'), /unknown cause "made-up"/);
});

test('syncMisses is idempotent', () => {
  const first = syncMisses({ punchlist: PL, date: '2025-06-02', ledger: LEDGER, known: new Set() });
  const known = new Set(first.rows.map((x) => `${x.date}|${x.ask}|${x.key}`));
  const again = syncMisses({ punchlist: PL, date: '2025-06-02', ledger: LEDGER, known });
  assert.equal(again.rows.length, 0);
  assert.equal(again.findings.filter((f) => /second miss|third miss/.test(f)).length, 0);
});

test('second miss with changed none, and a third miss, are findings', () => {
  const two = syncMisses({ punchlist: PL.split('\n').slice(0, 6).join('\n'), date: 'd', ledger: [], known: new Set() });
  assert.match(two.findings.join('\n'), /Ask 3: second miss with changed none/);
  const three = [PL, 'Miss: taste · rule none · caught by owner · changed tier · again'].join('\n');
  const t = syncMisses({ punchlist: three.replace(/Miss: made-up.*\n/, ''), date: 'd', ledger: [], known: new Set() });
  assert.match(t.findings.join('\n'), /Ask 3: third miss.*owner/);
});

// ---- detector, misses, triage, notes dir, override form, messages ----
import { learningsTriage, TRIAGE, guard } from './dispatch.mjs';
import { notesDir } from './notes.mjs';
import { getOverrides } from './detectors.mjs';

test('a long sk- kebab class name does not block; a project-key shape does', () => {
  assert.equal(detectSecrets('.sk-circle-fade-dot-wrapper-container { color: red }').length, 0);
  assert.equal(detectSecrets(`x = "${fakeKey('sk-proj-')}"`).length > 0, true);
  assert.equal(detectSecrets(`x = "${fakeKey('sk-svcacct-')}"`).length > 0, true);
});

test('syncMisses: round is the nth miss on the ask, dispatches counts ledger rows, note capped at 12 words', () => {
  const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen';
  const pl = `## Ask 2 — x\nMiss: taste · rule none · caught by owner · changed tier · a\nMiss: taste · rule none · caught by owner · changed tier · ${long}`;
  const { rows } = syncMisses({ punchlist: pl, date: 'd', ledger: LEDGER, known: new Set() });
  assert.deepEqual(rows.map((r) => [r.round, r.dispatches]), [[1, 2], [2, 2]]);
  assert.equal(rows[1].note, 'one two three four five six seven eight nine ten eleven twelve');
});

test('syncMisses: unknown caught by / changed are findings and are not written', () => {
  const pl = '## Ask 2 — x\nMiss: taste · rule none · caught by panel · changed tier · a\nMiss: taste · rule none · caught by owner · changed fixed · b';
  const r = syncMisses({ punchlist: pl, date: 'd', ledger: [], known: new Set() });
  assert.equal(r.rows.length, 0);
  assert.match(r.findings.join('\n'), /unknown caught by "panel"/);
  assert.match(r.findings.join('\n'), /unknown changed "fixed"/);
});

test('learningsTriage: file size and total entries fire; thresholds exported', () => {
  assert.equal(TRIAGE.fileBytes, 40 * 1024);
  assert.equal(TRIAGE.totalEntries, 60);
  const sections = Array.from({ length: 7 }, (_, i) => `## R${i}\n${Array(10).fill('- e').join('\n')}\n`).join('\n');
  assert.match(learningsTriage({ code: '', design: sections }).join('\n'), /70 entries/);
  const big = `## A\n- ${'x'.repeat(41 * 1024)}\n`;
  assert.match(learningsTriage({ code: big, design: '' }).join('\n'), /KB/);
});

test('notesDir: env override, else ~/.claude', () => {
  assert.equal(notesDir({ PUNCHLIST_NOTES_DIR: '/n' }), '/n');
  assert.match(notesDir({}), /\.claude$/);
});

test('punchlist:allow overrides; output shows only that form', () => {
  assert.equal(getOverrides('x // punchlist:allow secret — fixture').length, 1);
  const r = evaluate({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: 'a.ts', content: `k = "${fakeKey('sk-ant-')}"` } });
  assert.match(r.report, /^punchlist BLOCKED/);
  assert.match(r.report, /punchlist:allow/);
  assert.doesNotMatch(r.report, new RegExp('kee' + 'gan', 'i'));
});

test('guard messages start with punchlist and cite repo paths', () => {
  const a = guard({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { model: 'opus', prompt: 'x' } }).report;
  const b = guard({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt: 'x' } }).report;
  for (const m of [a, b]) {
    assert.match(m, /^punchlist BLOCKED/);
    assert.match(m, /shared\/architect\.md/);
    assert.doesNotMatch(m, new RegExp('kee' + 'gan|get' + 'layers', 'i'));
  }
});

test('miss row schema is frozen, in this field set', () => {
  const { rows } = syncMisses({ punchlist: PL, date: 'd', ledger: LEDGER, known: new Set() });
  const want = 'date ask cause rule caughtBy changed note model effort agentType round dispatches assignedBy key'.split(' ').sort();
  assert.deepEqual(Object.keys(rows[0]).sort(), want);
  assert.equal(rows[0].assignedBy, 'architect');
});

// Public repo: no file under hooks/ may hold a contiguous secret-shaped string,
// checked with the plugin's own detector, nothing skipped.
test('detectSecrets finds nothing in any file under hooks/', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  for (const f of readdirSync(HERE)) {
    assert.deepEqual(detectSecrets(readFileSync(join(HERE, f), 'utf8')), [], f);
  }
});
