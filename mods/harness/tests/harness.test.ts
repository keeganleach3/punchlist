import { expect, mock, test } from 'claude-code/testing'
import { tierDeny } from '../hooks/rules'

const spawn = (over: Record<string, unknown>) =>
  ({
    tool_use_id: 'tu1',
    prompt: 'build the thing',
    description: 'build',
    subagentType: 'general-purpose',
    provider: { plugin: 'engine', tier: 'core' },
    parentModel: 'claude-sonnet-5-5',
    background: false,
    fork: false,
    ...over,
  }) as any

const done = (over: Record<string, unknown>) =>
  ({ answer: 'Done.', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...over }) as any

const edit = (file_path: string, agentId?: string) =>
  ({ tool: 'Edit', file_path, old_string: 'a', new_string: 'b', ...(agentId ? { agentId } : {}) }) as any
const bash = (command: string, agentId?: string) => ({ tool: 'Bash', command, ...(agentId ? { agentId } : {}) }) as any
const read = (file_path: string) => ({ tool: 'Read', file_path }) as any

// ---- agent.spawn ----

test('refuses a spawn above the session tier', async ($, on) => {
  on('agent.spawn', ($, e) => ({ model: e.model ?? 'x', agentId: 'a1' }))
  const r = await $.agent.spawn(spawn({ model: 'opus' }))
  expect(r.deny).toMatch(/above the session's tier/)
  expect(r.agentId).toBeUndefined()
})

test('lets a spawn at or below tier through, and leaves an unjudgeable model alone', async ($, on) => {
  on('agent.spawn', ($, e) => ({ model: e.model ?? 'inherit', agentId: 'a1' }))
  for (const model of ['sonnet', 'haiku', 'claude-sonnet-5-5', undefined, 'inherit']) {
    const r = await $.agent.spawn(spawn({ model }))
    expect(r.deny).toBeUndefined()
  }
  const r = await $.agent.spawn(spawn({ model: 'opus', parentModel: 'claude-fable-5-1' }))
  expect(r.deny).toBeUndefined()
})

test("the owner's override line lets one spawn above the tier; without it the cap holds", async ($, on) => {
  on('agent.spawn', ($, e) => ({ model: e.model ?? 'x', agentId: 'a1' }))
  const r = await $.agent.spawn(spawn({ model: 'fable', prompt: 'TIER-OVERRIDE: owner approved\naudit the view' }))
  expect(r.deny).toBeUndefined()
  const s = await $.agent.spawn(spawn({ model: 'fable', prompt: 'audit the view' }))
  expect(s.deny).toMatch(/above the session's tier/)
})

test("the owner naming the model in his own message voids the cap; other words don't", async () => {

  const opus = 'claude-opus-5-5'
  expect(tierDeny(opus, 'fable', 'review it', 'spawn a fable agent to review it')).toBeUndefined()
  expect(tierDeny(opus, 'fable', 'review it', 'Fable review please')).toBeUndefined()
  expect(tierDeny(opus, 'fable', 'review it', 'review it carefully')).toMatch(/above the session's tier/)
  expect(tierDeny(opus, 'fable', 'review it', 'unfabled text')).toMatch(/TIER-OVERRIDE/)
})

test('injects the worker directive and standing lines once for a generic type', async ($, on) => {
  let seen: any
  on('agent.spawn', ($, e) => {
    seen = e
    return { model: 'sonnet', agentId: 'a1' }
  })
  await $.agent.spawn(spawn({ model: 'sonnet' }))
  expect(seen.prompt).toContain('build the thing')
  expect(seen.prompt).toContain('Apply Honey')
  expect(seen.prompt).toContain('Never run git stash')
  await $.agent.spawn(spawn({ model: 'sonnet', prompt: seen.prompt }))
  expect(seen.prompt.split('[punchlist-harness standing rules]').length).toBe(2)
})

test('typed workers skip the standing lines; review-shaped dispatches get the reviewer variant', async ($, on) => {
  let seen: any
  on('agent.spawn', ($, e) => {
    seen = e
    return { model: 'sonnet', agentId: 'a1' }
  })
  await $.agent.spawn(spawn({ model: 'sonnet', subagentType: 'ui-implementer' }))
  expect(seen.prompt).toContain('Apply Honey')
  expect(seen.prompt).not.toContain('Never run git stash')
  await $.agent.spawn(spawn({ model: 'sonnet', subagentType: 'reviewer', description: 'review the diff' }))
  expect(seen.prompt).toContain('never your verdict or severity')
  expect(seen.prompt).not.toContain('Apply Honey')
})

test('workflow agents and forks pass through untouched', async ($, on) => {
  let seen: any
  on('agent.spawn', ($, e) => {
    seen = e
    return { model: 'opus', agentId: 'a1' }
  })
  const r = await $.agent.spawn(spawn({ model: 'opus', fork: true }))
  expect(r.deny).toBeUndefined()
  expect(seen.prompt).toBe('build the thing')
})

// ---- worker exit stamp ----

test('a worker that edited UI without its gates is stamped into the main conversation', async ($, on) => {
  const session = mock.session(on)
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'w1' }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.agent.spawn(spawn({ model: 'sonnet', subagentType: 'ui-implementer' }))
  await $.tool.call(edit('src/App.tsx', 'w1'))
  await $.turn.complete(done({ agentId: 'w1' }))
  const rows = session.appended()
  expect(rows.length).toBe(1)
  const text = JSON.stringify(rows[0]!.message)
  expect(text).toContain('worker ui-implementer (w1)')
  expect(text).toContain('verify-sweep did not run')
  expect(text).toContain('route-shots did not run')
  expect(text).toContain('no typecheck/build/test command ran')
})

test('a worker with its evidence is not stamped', async ($, on) => {
  const session = mock.session(on)
  on('agent.spawn', () => ({ model: 'sonnet', agentId: 'w2' }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.agent.spawn(spawn({ model: 'sonnet', subagentType: 'ui-implementer' }))
  await $.tool.call(edit('src/App.tsx', 'w2'))
  await $.tool.call(bash('npm run build', 'w2'))
  await $.tool.call(bash('node scripts/verify-sweep/verify-sweep.mjs', 'w2'))
  await $.tool.call(bash('node scripts/verify-sweep/route-shots.mjs out /', 'w2'))
  await $.turn.complete(done({ agentId: 'w2' }))
  expect(session.appended().length).toBe(0)
})

// ---- look-before-done gate on the main turn ----

test('a done claim after UI edits with no route-shots is marked UNVERIFIED', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.turn.start({ text: 'fix the nav', turnId: 't1' })
  await $.tool.call(edit('src/Nav.tsx'))
  const r = await $.turn.complete(done({ answer: 'Fixed the nav chip.' }))
  expect(r.text).toContain('[harness] skills: none · edits: 1 (1 ui)')
  expect(r.text).toContain('UNVERIFIED: UI changed and route-shots did not run')
  expect(r.text).toContain('UNVERIFIED: no verify-sweep ran')
})

test('route-shots plus an opened PNG plus the sweep clears the gate; the audit line stays', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  await $.turn.start({ text: 'fix the nav', turnId: 't1' })
  await $.skill.prompt({ skill: 'the design skill', text: 'x' })
  await $.tool.call(edit('src/Nav.tsx'))
  await $.tool.call(bash('node scripts/verify-sweep/verify-sweep.mjs'))
  await $.tool.call(bash('node scripts/verify-sweep/route-shots.mjs shots /'))
  await $.tool.call(read('shots/home-1920.png'))
  const r = await $.turn.complete(done({ answer: 'Fixed and verified.' }))
  expect(r.text).toContain('skills: the design skill')
  expect(r.text).toContain('sweep: yes · route-shots: yes · looked: 1')
  expect(r.text).not.toContain('UNVERIFIED')
})

test('non-UI source edits need a test or typecheck command', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.turn.start({ text: 'add endpoint', turnId: 't1' })
  await $.tool.call(edit('src/api/orders.ts'))
  let r = await $.turn.complete(done({ answer: 'Endpoint landed.' }))
  expect(r.text).toContain('UNVERIFIED: source changed and no test')
  await $.turn.start({ text: 'again', turnId: 't2' })
  await $.tool.call(edit('src/api/orders.ts'))
  await $.tool.call(bash('npm test'))
  r = await $.turn.complete(done({ answer: 'Endpoint landed.' }))
  expect(r.text).not.toContain('UNVERIFIED')
})

test('a turn with no edits, workers, or skills leaves the answer alone', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.turn.start({ text: 'what do you think', turnId: 't1' })
  const r = await $.turn.complete(done({ answer: 'Just talking, nothing is done here.' }))
  expect(r.text).toBe('Just talking, nothing is done here.')
})

test('edits under docs or .claude do not count as source', async ($, on) => {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: { ok: true } }) as any)
  on('turn.complete', ($, e) => ({ text: e.answer }))
  await $.turn.start({ text: 'notes', turnId: 't1' })
  await $.tool.call(edit('docs/superpowers/plans/2026-10-08-punchlist.md'))
  await $.tool.call(edit('.claude/launch.json'))
  const r = await $.turn.complete(done({ answer: 'Done.' }))
  expect(r.text).toBe('Done.')
})
