import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { extractContent, evaluate, dedupeEntries } from './scan.mjs';

const AWS = 'const k = "AKIA' + 'IOSFODNN7EXAMPLE";';

// ------------------------------------------------------------- extraction

test('extracts content from a Write payload', () => {
  const p = { tool_name: 'Write', tool_input: { file_path: 'a.ts', content: 'x' } };
  assert.equal(extractContent(p), 'x');
});

test('extracts new_string from an Edit payload', () => {
  const p = {
    tool_name: 'Edit',
    tool_input: { file_path: 'a.ts', old_string: 'a', new_string: 'b' },
  };
  assert.equal(extractContent(p), 'b');
});

test('concatenates MultiEdit new_strings', () => {
  const p = {
    tool_name: 'MultiEdit',
    tool_input: { file_path: 'a.ts', edits: [{ new_string: 'a' }, { new_string: 'b' }] },
  };
  assert.equal(extractContent(p), 'a\nb');
});

// ------------------------------------------------------------ PreToolUse

test('PreToolUse denies on a secret', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: AWS },
  });
  assert.equal(r.deny, true);
  assert.equal(r.findings[0].rule, 'secret');
});

test('the denial report never echoes the raw secret', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: AWS },
  });
  assert.ok(!r.report.includes('AKIA' + 'IOSFODNN7EXAMPLE'));
});

test('the denial report names the override form', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: AWS },
  });
  assert.match(r.report, /punchlist:allow secret/);
});

test('PreToolUse denies a migration with no RLS', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'migrations/1.sql', content: 'CREATE TABLE public.o (id int);' },
  });
  assert.equal(r.deny, true);
  assert.equal(r.findings[0].rule, 'rls');
});

test('PreToolUse allows clean content', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: 'const k = process.env.API_KEY;' },
  });
  assert.equal(r.deny, false);
  assert.equal(r.findings.length, 0);
});

// ----------------------------------------------------------- PostToolUse

test('PostToolUse never denies, even on a secret', () => {
  const r = evaluate({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: AWS },
  });
  assert.equal(r.deny, false);
});

test('PostToolUse advises on SECURITY DEFINER without search_path', () => {
  const sql =
    'CREATE FUNCTION f() RETURNS void LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;';
  const r = evaluate({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'migrations/1.sql', content: sql },
  });
  assert.ok(r.findings.some((f) => f.rule === 'definer-search-path'));
});

test('PostToolUse does not advise when search_path is pinned', () => {
  const sql =
    'CREATE FUNCTION f() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 1 $$;';
  const r = evaluate({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'migrations/1.sql', content: sql },
  });
  assert.equal(r.findings.filter((f) => f.rule === 'definer-search-path').length, 0);
});

test('PostToolUse advises on a permissive RLS policy', () => {
  const sql = 'CREATE POLICY p ON public.o FOR SELECT USING (true);';
  const r = evaluate({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'migrations/2.sql', content: sql },
  });
  assert.ok(r.findings.some((f) => f.rule === 'rls-permissive'));
});

// ----------------------------------------------------------------- scope

test('ignores tool calls that are not edits', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command: 'ls' },
  });
  assert.equal(r.deny, false);
  assert.equal(r.findings.length, 0);
});

test('skips lockfiles and .env.example', () => {
  const payload = (file_path) => ({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path, content: 'api_key = "sk_' + 'live_9f8a7b6c5d4e3f2a1b0c"' },
  });
  assert.equal(evaluate(payload('.env.example')).deny, false);
  assert.equal(evaluate(payload('pnpm-lock.yaml')).deny, false);
  assert.equal(evaluate(payload('package-lock.json')).deny, false);
});

test('an arbitrary .lock filename is NOT a bypass', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'secrets.lock', content: 'const k = "AKIA' + 'IOSFODNN7EXAMPLE";' },
  });
  assert.equal(r.deny, true);
});

test('hooks-dir exemption covers test fixtures only, not the gate itself', () => {
  const secret = 'const k = "AKIA' + 'IOSFODNN7EXAMPLE";';
  const fixture = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: {
      file_path: fileURLToPath(new URL('./detectors.test.mjs', import.meta.url)),
      content: secret,
    },
  });
  assert.equal(fixture.deny, false);
  const gate = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: {
      file_path: fileURLToPath(new URL('./scan.mjs', import.meta.url)),
      content: secret,
    },
  });
  assert.equal(gate.deny, true);
});

test('NotebookEdit new_source is scanned', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'NotebookEdit',
    tool_input: { notebook_path: 'a.ipynb', new_source: 'k = "AKIA' + 'IOSFODNN7EXAMPLE"' },
  });
  assert.equal(r.deny, true);
});

test('an empty payload is inert', () => {
  assert.equal(evaluate({}).deny, false);
  assert.equal(evaluate({ tool_name: 'Write', tool_input: {} }).deny, false);
});

// ------------------------------------------------------------- overrides

test('an override suppresses the deny but is surfaced for logging', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: {
      file_path: 'a.ts',
      content:
        'const k = "AKIA' + 'IOSFODNN7EXAMPLE"; // punchlist:allow secret — docs fixture',
    },
  });
  assert.equal(r.deny, false);
  assert.equal(r.overrides.length, 1);
  assert.equal(r.overrides[0].rule, 'secret');
  assert.equal(r.overrides[0].reason, 'docs fixture');
});

test('clean content reports no overrides', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'a.ts', content: 'const k = process.env.K;' },
  });
  assert.deepEqual(r.overrides, []);
});

// -------------------------------------------------------------- doc files

test('markdown: SQL examples and policy prose do not fire', () => {
  const md = [
    'Never build queries like `SELECT * FROM t WHERE id = ${id}`.',
    'A policy of `CREATE POLICY p ON t USING (true)` protects nothing.',
    '// punchlist:allow secret — example annotation in prose',
  ].join('\n');
  const r = evaluate({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'docs/security.md', content: md },
  });
  assert.equal(r.findings.length, 0);
  assert.equal(r.overrides.length, 0);
});

test('markdown: a real secret still denies', () => {
  const r = evaluate({
    hook_event_name: 'PreToolUse',
    tool_name: 'Write',
    tool_input: { file_path: 'README.md', content: 'key: "AKIA' + 'IOSFODNN7EXAMPLE"' },
  });
  assert.equal(r.deny, true);
});

// ------------------------------------------------- point-of-use learnings

test('relevantLearnings surfaces entries matching the file being edited', async () => {
  const { relevantLearnings } = await import('./scan.mjs');
  const md = [
    '- 2026-08-20 · data · migrations — the model puts DDL and backfill in one',
    '  migration. Correct: separate. Caught by: review.',
    '- 2026-08-21 · api · pagination — the model returns unbounded lists.',
    '  Correct: cursor + limit. Caught by: owner.',
    '- 2026-08-22 · detectors · regex — the model anchors wrong. Correct: x.',
    '  Caught by: test.',
  ].join('\n');
  const hits = relevantLearnings(md, 'supabase/migrations/007_orders.sql');
  assert.ok(hits.some((h) => h.includes('migrations')));
  assert.ok(!hits.some((h) => h.includes('pagination')));
});

test('relevantLearnings caps at 3 and returns [] with no match', async () => {
  const { relevantLearnings } = await import('./scan.mjs');
  const many = Array.from({ length: 6 }, (_, i) =>
    `- 2026-08-2${i} · sql · rule${i} — the model does X with sql. Correct: Y. Caught by: test.`,
  ).join('\n');
  assert.equal(relevantLearnings(many, 'db/query.sql').length, 3);
  assert.deepEqual(relevantLearnings(many, 'src/Button.tsx'), []);
});

// ----------------------------------------------------------------- dedup

test('dedupeEntries drops rule+path pairs already recorded', () => {
  const existing = [
    '- 2026-08-27 · advisory · `definer-search-path` · m/1.sql:3 — msg.',
  ].join('\n');
  const fresh = [
    { kind: 'advisory', rule: 'definer-search-path', path: 'm/1.sql', line: 9, message: 'msg.' },
    { kind: 'advisory', rule: 'eval', path: 'm/1.sql', line: 2, message: 'other.' },
  ];
  const kept = dedupeEntries(existing, fresh);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].rule, 'eval');
});

// ---- triage counter and scratchpad advisory filter (2026-09-10) ----
import { hookCatchCount, isScratchPath } from './scan.mjs';

test('hookCatchCount ignores the intro mention of the heading', () => {
  const md = 'Intro says the hook appends to `## Hook catches` at EOF.\n\n## Notes\n- 2026-09-01 · x · note\n\n## Hook catches\n- 2026-09-01 · BLOCKED · `secret` · a.ts:1 — x\n- 2026-09-02 · advisory · `eval` · b.mjs:2 — y\n- 2026-09-03 · triage · summary line\n';
  assert.equal(hookCatchCount(md), 2);
  assert.equal(hookCatchCount('no section'), 0);
});

test('isScratchPath matches the directory segment only', () => {
  assert.ok(isScratchPath('C:/Users/k/AppData/Local/Temp/claude/x/scratchpad/probe.mjs'));
  assert.ok(isScratchPath(['C:', 'Temp', 'scratchpad', 'p.mjs'].join(String.fromCharCode(92))));
  assert.ok(isScratchPath('/tmp/scratchpad/p.mjs'));
  assert.ok(!isScratchPath('src/scratchpad-utils.ts'));
  assert.ok(!isScratchPath('src/app.ts'));
});
