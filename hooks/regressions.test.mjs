import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audit, effectiveModel, guard, ledgerRow, parseTranscript, syncMisses } from './dispatch.mjs';
import { detectMissingRLS, detectSecrets, getOverrides } from './detectors.mjs';

const pre = (input) => ({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: input });
const post = (input) => ({ hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_input: input, tool_response: '' });
const agent = (input) => JSON.stringify({ message: { content: [{ type: 'tool_use', name: 'Agent', input }] } });
// Built at runtime so no literal key shape sits in this file.
const rnd = (n) => 'a8F3x9Qz'.repeat(Math.ceil(n / 8)).slice(0, n);

test('effectiveModel: explicit, default from the agent definition, inherited', () => {
  assert.deepEqual(effectiveModel({ model: 'sonnet' }), { model: 'sonnet', source: 'explicit' });
  assert.deepEqual(effectiveModel({ subagent_type: 'reviewer' }), { model: 'opus', source: 'default' });
  assert.deepEqual(effectiveModel({ subagent_type: 'plugin:reviewer' }), { model: 'opus', source: 'default' });
  assert.deepEqual(effectiveModel({ subagent_type: 'service-implementer' }), { model: 'sonnet', source: 'default' });
  assert.deepEqual(effectiveModel({ subagent_type: 'no-such-worker' }), { model: 'inherited', source: 'inherited' });
  assert.deepEqual(effectiveModel({ subagent_type: '../../etc/passwd' }), { model: 'inherited', source: 'inherited' });
  assert.deepEqual(effectiveModel({ subagent_type: 'general-purpose' }), { model: 'inherited', source: 'inherited' });
});

test('ledger row records the effective model and its source', () => {
  const r = ledgerRow(post({ subagent_type: 'reviewer', prompt: 'x' }));
  assert.equal(r.model, 'opus');
  assert.equal(r.modelSource, 'default');
  assert.equal(ledgerRow(post({ model: 'opus', prompt: 'COMPLEX: r' })).modelSource, 'explicit');
  assert.equal(ledgerRow(post({ prompt: 'x' })).modelSource, 'inherited');
});

test('a worker whose own default is opus passes without a reason; explicit opus does not', () => {
  assert.equal(guard(pre({ subagent_type: 'reviewer', prompt: 'x' })).deny, false);
  assert.equal(guard(pre({ subagent_type: 'reviewer', model: 'opus', prompt: 'x' })).deny, true);
  const { dispatches } = parseTranscript(agent({ subagent_type: 'reviewer', prompt: 'x' }));
  const ctx = { punchlistExists: true, punchlistHasBuild: true, ledgerRows: 1 };
  assert.doesNotMatch(audit({ dispatches, editedPaths: [] }, ctx).join('\n'), /opus dispatch/);
  const explicit = parseTranscript(agent({ subagent_type: 'reviewer', model: 'opus', prompt: 'x' })).dispatches;
  assert.match(audit({ dispatches: explicit, editedPaths: [] }, ctx).join('\n'), /1 opus dispatch/);
});

test('COMPLEX: counts only at the start of a line', () => {
  assert.equal(guard(pre({ model: 'opus', prompt: 'there is no COMPLEX: here' })).deny, true);
  assert.equal(guard(pre({ model: 'opus', prompt: 'x\n  COMPLEX: silent if wrong' })).deny, false);
});

test('quoted key names are caught', () => {
  for (const s of [`"api_key": "${rnd(24)}"`, `"pass${"word"}": "Tr0ub4dor-and-3"`, `{"ApiKey":"${rnd(24)}"}`]) {
    assert.equal(detectSecrets(s).length > 0, true, s);
  }
});

test('Supabase secret keys are caught', () => {
  assert.equal(detectSecrets(`k = "${'sb_secret_'}${rnd(24)}"`).length > 0, true);
  assert.equal(detectSecrets(`service_role_key: "${rnd(30)}"`).length > 0, true);
});

test('prose in a quoted password string does not block', () => {
  assert.equal(detectSecrets('password: "Password must be at least 8 characters"').length, 0);
  assert.equal(detectSecrets('resetPassword = "Reset your password now"').length, 0);
});

test('commented-out ENABLE ROW LEVEL SECURITY does not satisfy the RLS check', () => {
  const create = 'CREATE TABLE a (id int);\n';
  assert.equal(detectMissingRLS(`${create}-- ALTER TABLE a ENABLE ROW LEVEL SECURITY;`, 'm.sql').length, 1);
  assert.equal(detectMissingRLS(`${create}/* ALTER TABLE a ENABLE ROW LEVEL SECURITY; */`, 'm.sql').length, 1);
  assert.equal(detectMissingRLS(`${create}ALTER TABLE a ENABLE ROW LEVEL SECURITY;`, 'm.sql').length, 0);
  assert.equal(detectMissingRLS('-- CREATE TABLE ghost (id int);', 'm.sql').length, 0);
});

test('the nth identical Miss line gets its own row; a rerun adds nothing', () => {
  const line = 'Miss: taste · rule none · caught by owner · changed none · again';
  const one = `## Ask 4 — x\n${line}`;
  const two = `${one}\n${line}`;
  const r1 = syncMisses({ punchlist: one, date: 'd', ledger: [], known: new Set() });
  assert.equal(r1.rows.length, 1);
  const known = new Set(r1.rows.map((x) => `${x.date}|${x.ask}|${x.key}`));
  const r2 = syncMisses({ punchlist: two, date: 'd', ledger: [], known });
  assert.equal(r2.rows.length, 1);
  assert.equal(r2.rows[0].round, 2);
  assert.match(r2.findings.join('\n'), /Ask 4: second miss with changed none/);
  known.add(`d|4|${r2.rows[0].key}`);
  assert.equal(syncMisses({ punchlist: two, date: 'd', ledger: [], known }).rows.length, 0);
});

test('the legacy override prefix no longer clears a block', () => {
  const legacy = `x = "${'AKIA'}${'IOSFODNN7EXAMPL0'}" // ${'kee' + 'gan-code'}:allow secret — fixture`;
  assert.equal(detectSecrets(legacy).length > 0, true);
  assert.equal(getOverrides(legacy).length, 0);
  assert.equal(detectSecrets(legacy.replace('kee' + 'gan-code', 'punchlist')).length, 0);
});
