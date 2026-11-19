import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, backfillRows, BIG_WORKER_CTX, bigReads, guard, hasSweepConfig, roundGaps, ledgerPath, ledgerRow, parseTranscript, parseWorker, workerSweepGaps } from './dispatch.mjs';

const pre = (input) => ({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: input });
const post = (input, response) => ({
  hook_event_name: 'PostToolUse',
  tool_name: 'Agent',
  tool_input: input,
  tool_response: response,
});

// ---- guard ----
test('blocks generic dispatch without model', () => {
  for (const type of [undefined, 'general-purpose', 'claude', 'Explore', 'Plan']) {
    const r = guard(pre({ subagent_type: type, prompt: 'x' }));
    assert.equal(r.deny, true, `type=${type}`);
    assert.match(r.report, /spawn-tier matrix/);
  }
});

test('allows generic dispatch with explicit model', () => {
  assert.equal(guard(pre({ subagent_type: 'general-purpose', model: 'sonnet' })).deny, false);
});

test('allows custom agent types and forks without model', () => {
  assert.equal(guard(pre({ subagent_type: 'impeccable:impeccable-documenter' })).deny, false);
  assert.equal(guard(pre({ subagent_type: 'fork' })).deny, false);
});

test('ignores non-dispatch tools and non-Pre events', () => {
  assert.equal(guard({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: {} }).deny, false);
  assert.equal(guard(post({ subagent_type: 'claude' }, '')).deny, false);
});

test('whitespace-only model still blocks', () => {
  assert.equal(guard(pre({ subagent_type: 'claude', model: '  ' })).deny, true);
});

// ---- ledgerRow ----
test('ledger row captures model, tokens, and punchlist reference', () => {
  const r = ledgerRow(
    post(
      { description: 'implement search', model: 'sonnet', subagent_type: 'general-purpose', prompt: 'see the punchlist file' },
      'done\n<usage>subagent_tokens: 99119\ntool_uses: 19</usage>',
    ),
  );
  assert.equal(r.model, 'sonnet');
  assert.equal(r.effort, null);
  assert.equal(r.actualTokens, 99119);
  assert.equal(r.referencesPunchlist, true);
  assert.equal(r.step, 'implement search');
});

test('ledger row records the effort param when given', () => {
  assert.equal(ledgerRow(post({ model: 'opus', effort: 'high', prompt: 'x' }, '')).effort, 'high');
});

test('ledger row marks inherited model and null tokens when absent', () => {
  const r = ledgerRow(post({ prompt: 'do a thing' }, 'no usage data'));
  assert.equal(r.model, 'inherited');
  assert.equal(r.actualTokens, null);
  assert.equal(r.referencesPunchlist, false);
});

test('ledger row is null off the dispatch path', () => {
  assert.equal(ledgerRow({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: {} }), null);
  assert.equal(ledgerRow(pre({ model: 'haiku' })), null);
});

test('ledgerPath lands in docs/superpowers/plans', () => {
  assert.match(ledgerPath('/proj', '2026-08-28'), /docs[/\\]superpowers[/\\]plans[/\\]2026-08-28-ledger\.jsonl$/);
});

// ---- parseTranscript ----
const line = (blocks) => JSON.stringify({ message: { content: blocks } });

test('transcript parser collects dispatches and edited paths', () => {
  const raw = [
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', prompt: 'p'.repeat(10) } }]),
    line([{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/a.ts' } }]),
    line([{ type: 'text', text: 'not a tool_use line but contains "tool_use"' }]),
    'garbage not json with "tool_use"',
  ].join('\n');
  const { dispatches, editedPaths } = parseTranscript(raw);
  assert.equal(dispatches.length, 1);
  assert.equal(dispatches[0].promptChars, 10);
  assert.deepEqual(editedPaths, ['src/a.ts']);
});

// ---- audit ----
test('flags source edits without a punchlist; docs/tests/scratch exempt', () => {
  const f = audit(
    { dispatches: [], editedPaths: ['src/a.ts', 'docs/x.md', 'src/b.test.ts', 'C:\\x\\scratchpad\\t.ts'] },
    { punchlistExists: false, plansDir: true, ledgerRows: 0 },
  );
  assert.equal(f.length, 1);
  assert.match(f[0], /1 source file/);
});

test('quiet when punchlist exists or was edited this round', () => {
  const parsed = { dispatches: [], editedPaths: ['src/a.ts'] };
  assert.equal(audit(parsed, { punchlistExists: true, ledgerRows: 0 }).length, 0);
  const edited = { dispatches: [], editedPaths: ['src/a.ts', 'docs/superpowers/plans/2026-08-28-punchlist.md'] };
  assert.equal(audit(edited, { punchlistExists: false, ledgerRows: 0 }).length, 0);
});

test('flags source edits when the punchlist records no Build: route', () => {
  const parsed = { dispatches: [], editedPaths: ['src/a.ts'] };
  const f = audit(parsed, { punchlistExists: true, punchlistHasBuild: false, ledgerRows: 0 });
  assert.equal(f.length, 1);
  assert.match(f[0], /no "Build:" line/);
  assert.equal(audit(parsed, { punchlistExists: true, punchlistHasBuild: true, ledgerRows: 0 }).length, 0);
  // docs-only rounds owe no route
  assert.equal(audit({ dispatches: [], editedPaths: ['docs/x.md'] }, { punchlistExists: true, punchlistHasBuild: false, ledgerRows: 0 }).length, 0);
});

test('flags fat dispatch prompts without punchlist reference, and ledger gaps', () => {
  const parsed = {
    dispatches: [
      { promptChars: 5000, referencesPunchlist: false },
      { promptChars: 5000, referencesPunchlist: true },
    ],
    editedPaths: [],
  };
  const f = audit(parsed, { punchlistExists: true, ledgerRows: 1 });
  assert.equal(f.length, 2);
  assert.match(f[0], /no punchlist reference/);
  assert.match(f[1], /only 1 ledger row/);
});

test('clean round produces no findings', () => {
  const parsed = { dispatches: [{ promptChars: 800, referencesPunchlist: true }], editedPaths: [] };
  assert.equal(audit(parsed, { punchlistExists: true, ledgerRows: 1 }).length, 0);
});

// ---- 2026-09-02: token back-fill, opus reason, big reads ----
test('ledger row records toolUseId and the COMPLEX reason', () => {
  const r = ledgerRow({
    ...post({ model: 'opus', subagent_type: 'general-purpose', prompt: 'punchlist V13.23\nCOMPLEX: root-cause on a pin that re-docks' }, ''),
    tool_use_id: 'toolu_01ABC',
  });
  assert.equal(r.toolUseId, 'toolu_01ABC');
  assert.equal(r.complexReason, 'root-cause on a pin that re-docks');
  assert.equal(r.actualTokens, null);
});

test('transcript parser reads task-notifications, whole-file reads, and cat', () => {
  const notif = JSON.stringify({
    type: 'user',
    message: { content: '<task-notification>\n<tool-use-id>toolu_01ABC</tool-use-id>\n<usage><subagent_tokens>233968</subagent_tokens></usage>' },
  });
  const raw = [
    line([{ type: 'tool_use', id: 'toolu_01ABC', name: 'Agent', input: { model: 'opus', prompt: 'x' } }]),
    notif,
    line([{ type: 'tool_use', name: 'Read', input: { file_path: 'a.md' } }]),
    line([{ type: 'tool_use', name: 'Read', input: { file_path: 'b.md', offset: 10, limit: 5 } }]),
    line([{ type: 'tool_use', name: 'Bash', input: { command: 'cat c.md | head; cat > out.txt <<EOF\nx\nEOF' } }]),
  ].join('\n');
  const p = parseTranscript(raw);
  assert.deepEqual(p.notifications, { toolu_01ABC: 233968 });
  assert.equal(p.dispatches[0].id, 'toolu_01ABC');
  assert.equal(p.dispatches[0].complexReason, null);
  assert.deepEqual(p.reads, ['a.md', 'c.md']);
});

test('backfillRows fills only null rows with a matching notification', () => {
  const rows = [
    { toolUseId: 'toolu_1', actualTokens: null },
    { toolUseId: 'toolu_2', actualTokens: 5 },
    { toolUseId: null, actualTokens: null },
  ];
  assert.equal(backfillRows(rows, { toolu_1: 100, toolu_2: 999 }), 1);
  assert.equal(rows[0].actualTokens, 100);
  assert.equal(rows[1].actualTokens, 5);
});

test('bigReads keeps files over the limit and exempts the architect set', () => {
  const size = (p) => ({ 'big.ts': 30000, 'small.ts': 100, 'docs/superpowers/plans/x-punchlist.md': 90000, 'missing.ts': null })[p] ?? (() => { throw new Error('nope'); })();
  assert.deepEqual(bigReads(['big.ts', 'small.ts', 'docs/superpowers/plans/x-punchlist.md', 'missing.ts', 'big.ts'], size), ['big.ts']);
});

test('audit flags opus without a reason and big architect reads', () => {
  const parsed = {
    dispatches: [
      { model: 'opus', promptChars: 100, referencesPunchlist: true, complexReason: null },
      { model: 'opus', promptChars: 100, referencesPunchlist: true, complexReason: 'security review' },
      { model: 'sonnet', promptChars: 100, referencesPunchlist: true, complexReason: null },
    ],
    editedPaths: [],
    bigReads: ['site/src/content/exampleCase.ts'],
  };
  const f = audit(parsed, { punchlistExists: true, ledgerRows: 3 });
  assert.equal(f.length, 2);
  assert.match(f[0], /1 opus dispatch/);
  assert.match(f[1], /exampleCase\.ts/);
});

// ---- 2026-09-05: motion/section dispatches carry a SOURCE line ----
test('audit flags motion dispatches without a SOURCE line', () => {
  const parsed = {
    dispatches: [
      { promptChars: 100, referencesPunchlist: true, motionWork: true, sourced: false },
      { promptChars: 100, referencesPunchlist: true, motionWork: true, sourced: true },
      { promptChars: 100, referencesPunchlist: true, motionWork: false, sourced: false },
    ],
    editedPaths: [],
  };
  const f = audit(parsed, { punchlistExists: true, ledgerRows: 3 });
  assert.equal(f.length, 1);
  assert.match(f[0], /1 motion\/section dispatch/);
});

test('parseTranscript tags motion work and SOURCE lines', () => {
  const raw = [
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', prompt: 'build the reveal animation\nSOURCE: ref-one index.html' } }]),
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', prompt: 'rename a variable' } }]),
  ].join('\n');
  const { dispatches } = parseTranscript(raw);
  assert.deepEqual(dispatches.map((d) => [d.motionWork, d.sourced]), [[true, true], [false, false]]);
});

// ---- learnings triage ----
import { learningsTriage, TRIAGE } from './dispatch.mjs';

const bullets = (n) => Array.from({ length: n }, (_, i) => `- 2026-09-0${(i % 9) + 1} · x · entry ${i}`).join('\n');

test('learningsTriage: under both caps → no findings', () => {
  const code = `# Code\n\n## Notes\n${bullets(3)}\n\n## Hook catches\n${bullets(TRIAGE.hookCatches)}\n`;
  const design = `# Design\n\n## A\n${bullets(TRIAGE.designSection)}\n`;
  assert.deepEqual(learningsTriage({ code, design }), []);
});

test('learningsTriage: hook catches over cap names the count', () => {
  const code = `## Hook catches\n${bullets(TRIAGE.hookCatches + 12)}\n`;
  const r = learningsTriage({ code, design: '' });
  assert.equal(r.length, 1);
  assert.match(r[0], /holds 32 entries/);
});

test('learningsTriage: every fat design section is named', () => {
  const design = `## Small\n${bullets(2)}\n\n## 2026-08-28 — big round\n${bullets(40)}\n\n## Also big\n${bullets(16)}\n`;
  const r = learningsTriage({ code: '', design });
  assert.equal(r.length, 2);
  assert.match(r[0], /2026-08-28 — big round.*40 entries/);
});

test('audit appends triage findings after its own', () => {
  const r = audit({ dispatches: [], editedPaths: [], bigReads: [] }, { punchlistExists: true, ledgerRows: 0, triage: ['T'] });
  assert.deepEqual(r, ['T']);
});

// ---- worker sweep check (2026-09-21) ----
const use = (name, input) => JSON.stringify({ isSidechain: true, message: { content: [{ type: 'tool_use', name, input }] } });

test('parseWorker counts UI edits and sees a sweep run in Bash or PowerShell', () => {
  const ran = parseWorker([
    use('Edit', { file_path: 'C:\\site\\src\\Hero.tsx' }),
    use('Write', { file_path: 'site/src/hero.css' }),
    use('Edit', { file_path: 'docs/notes.md' }),
    use('Bash', { command: 'node scripts/verify-sweep/verify-sweep.mjs' }),
  ].join('\n'));
  assert.deepEqual(ran, { uiEdits: 2, ranSweep: true, sourceEdits: 2, lastContext: 0 });
  assert.equal(parseWorker(use('PowerShell', { command: 'npm run verify:sweep' })).ranSweep, true);
  assert.deepEqual(parseWorker(use('Edit', { file_path: 'src/Hero.tsx' })), { uiEdits: 1, ranSweep: false, sourceEdits: 1, lastContext: 0 });
});

test('parseWorker counts non-UI source edits and keeps the LAST turn context size', () => {
  const turn = (input, write, read) =>
    JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: input, cache_creation_input_tokens: write, cache_read_input_tokens: read }, content: [] } });
  const w = parseWorker([use('Edit', { file_path: 'server/api/orders.ts' }), turn(2, 60000, 0), turn(2, 1000, 310000)].join('\n'));
  assert.deepEqual(w, { uiEdits: 0, ranSweep: false, sourceEdits: 1, lastContext: 311002 });
});

// ---- opus needs a reason at dispatch time (2026-09-21: most opus dispatches had none) ----
test('guard blocks an opus dispatch with no COMPLEX reason, on any agent type', () => {
  for (const type of ['general-purpose', 'ui-implementer']) {
    const r = guard(pre({ subagent_type: type, model: 'opus', prompt: 'build the thing' }));
    assert.equal(r.deny, true, `type=${type}`);
    assert.match(r.report, /COMPLEX:/);
  }
  assert.equal(guard(pre({ subagent_type: 'general-purpose', model: 'opus', prompt: 'x\nCOMPLEX: RLS policy, silent if wrong' })).deny, false);
  assert.equal(guard(pre({ subagent_type: 'fork', model: 'opus', prompt: 'x' })).deny, false);
  assert.equal(guard(pre({ subagent_type: 'general-purpose', model: 'sonnet', prompt: 'x' })).deny, false);
});

// ---- read-only and review dispatches build nothing, so they owe no SOURCE line ----
test('parseTranscript: READ-ONLY and reviewer dispatches are not motion work; review is tagged', () => {
  const raw = [
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', prompt: 'READ-ONLY audit. Walk the file section by section.' } }]),
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', subagent_type: 'reviewer', description: 'check hero', prompt: 'look at the hero section animation' } }]),
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', description: 'Review the diff', prompt: 'findings please' } }]),
    line([{ type: 'tool_use', name: 'Agent', input: { model: 'sonnet', prompt: 'build the hero section reveal' } }]),
  ].join('\n');
  const { dispatches } = parseTranscript(raw);
  assert.deepEqual(dispatches.map((d) => [d.motionWork, d.review]), [[false, false], [false, true], [false, true], [true, false]]);
});

test('ledger row applies the same read-only exemption', () => {
  assert.equal(ledgerRow(post({ model: 'sonnet', prompt: 'READ-ONLY. section by section' }, {})).motionWork, false);
  assert.equal(ledgerRow(post({ model: 'sonnet', prompt: 'build the marquee' }, {})).motionWork, true);
});

// ---- round gaps: builders with no independent reviewer; oversized workers ----
test('roundGaps: workers edited source and nobody reviewed', () => {
  const f = roundGaps([{ sourceEdits: 3, lastContext: 100000 }], [{ review: false }]);
  assert.equal(f.length, 1);
  assert.match(f[0], /no independent reviewer/);
});

test('roundGaps: quiet when a reviewer ran, or when no worker edited source', () => {
  assert.deepEqual(roundGaps([{ sourceEdits: 3, lastContext: 1 }], [{ review: false }, { review: true }]), []);
  assert.deepEqual(roundGaps([{ sourceEdits: 0, lastContext: 1 }], [{ review: false }]), []);
  assert.deepEqual(roundGaps([], []), []);
});

test('roundGaps: workers that ended above the context limit are counted', () => {
  const f = roundGaps(
    [{ sourceEdits: 0, lastContext: BIG_WORKER_CTX + 1 }, { sourceEdits: 0, lastContext: BIG_WORKER_CTX }, { sourceEdits: 0, lastContext: 5 }],
    [{ review: true }],
  );
  assert.equal(f.length, 1);
  assert.match(f[0], /1 worker\(s\) ended above 300k/);
});

test('parseWorker ignores test files, scratch and non-UI source', () => {
  const w = parseWorker([
    use('Edit', { file_path: 'src/Hero.test.tsx' }),
    use('Write', { file_path: 'scratchpad/probe.css' }),
    use('Edit', { file_path: 'server/api/orders.ts' }),
  ].join('\n'));
  assert.deepEqual(w, { uiEdits: 0, ranSweep: false, sourceEdits: 1, lastContext: 0 });
});

test('workerSweepGaps: UI workers that never ran the sweep are counted', () => {
  const workers = [
    { uiEdits: 3, ranSweep: false },
    { uiEdits: 1, ranSweep: true },
    { uiEdits: 0, ranSweep: false },
  ];
  const f = workerSweepGaps(workers, true);
  assert.equal(f.length, 1);
  assert.match(f[0], /1 of 2 UI worker\(s\) never ran verify-sweep/);
});

test('workerSweepGaps: a UI project with no sweep config is the finding, not the workers', () => {
  const f = workerSweepGaps([{ uiEdits: 2, ranSweep: false }], false);
  assert.equal(f.length, 1);
  assert.match(f[0], /no verify-sweep\.config\.json/);
});

test('workerSweepGaps: quiet when every UI worker ran it, or none touched UI', () => {
  assert.deepEqual(workerSweepGaps([{ uiEdits: 2, ranSweep: true }], true), []);
  assert.deepEqual(workerSweepGaps([{ uiEdits: 0, ranSweep: false }], false), []);
  assert.deepEqual(workerSweepGaps([], true), []);
});

test('hasSweepConfig looks in cwd and one folder down (Portfolio keeps it in site/)', () => {
  const tree = (files) => ({
    exists: (p) => files.includes(p.replaceAll('\\', '/')),
    list: () => ['site', 'docs', 'node_modules'],
  });
  const at = (files) => hasSweepConfig('/repo', tree(files).exists, tree(files).list);
  assert.equal(at(['/repo/verify-sweep.config.json']), true);
  assert.equal(at(['/repo/site/verify-sweep.config.json']), true);
  assert.equal(at(['/repo/node_modules/verify-sweep.config.json']), false);
  assert.equal(at([]), false);
});

test('audit carries worker findings', () => {
  const r = audit({ dispatches: [], editedPaths: [], bigReads: [] }, { punchlistExists: true, ledgerRows: 0, workers: ['W'] });
  assert.deepEqual(r, ['W']);
});
