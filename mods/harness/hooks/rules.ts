// Pure rules: no `$`, so `claude plugin test` and a reader can check them cold.

// ---- spawn-tier cap (shared/architect.md) ----
const RANK: Record<string, number> = { haiku: 1, sonnet: 2, opus: 3, fable: 4, mythos: 4 }
const NAMES = ['fable', 'mythos', 'opus', 'sonnet', 'haiku'] as const

export function tierOf(model: string | undefined): number | undefined {
  const m = (model ?? '').toLowerCase()
  for (const k of NAMES) if (m.includes(k)) return RANK[k]
  return undefined // '', 'inherit', an id with no tier word: not judged here
}

// Per-dispatch opt-out (2026-10-25): a prompt carrying this line spawns above the cap.
export const TIER_OVERRIDE = 'TIER-OVERRIDE: owner approved'

// An explicit ask from the owner voids the cap: their latest message names the
// requested model's tier word.
export function userNamedTier(userText: string, requested: string | undefined): boolean {
  const k = NAMES.find(n => (requested ?? '').toLowerCase().includes(n))
  return !!k && new RegExp(`\\b${k}\\b`, 'i').test(userText)
}

export function tierDeny(parentModel: string, requested: string | undefined, prompt = '', userText = ''): string | undefined {
  if (prompt.includes(TIER_OVERRIDE) || userNamedTier(userText, requested)) return undefined
  const p = tierOf(parentModel)
  const r = tierOf(requested)
  if (p === undefined || r === undefined || r <= p) return undefined
  const cap = NAMES.find(k => RANK[k] === p) ?? 'the session model'
  return (
    `punchlist-harness refused this spawn: model "${requested}" is above the session's tier (${parentModel}). ` +
    'Never spawn above your own tier (shared/architect.md, spawn-tier matrix). ' +
    `Re-dispatch at ${cap} or below, or HALT and ask the owner. If the owner explicitly asked for this model, ` +
    `re-dispatch with the line "${TIER_OVERRIDE}" in the prompt.`
  )
}

// ---- injected rules (honey-superpowers directive + the four standing lines) ----
export const MARK = '[punchlist-harness standing rules]'
const WORKER =
  'Apply Honey: write the minimum code that needs to exist: YAGNI, stdlib/native before custom; ' +
  'no speculative params, branches, or single-caller abstractions. Never cut validation, error handling, auth, ' +
  "or anything the task asked for. Keep code, identifiers, paths, and the brief's exact spec values verbatim. " +
  'Report terse: status, commits, one-line test summary, concerns. No narration.'
const REVIEWER =
  "Report findings tersely: id · severity · file:line · one-line fix. Don't narrate or restate the diff. " +
  'Honey governs your prose only, never your verdict or severity. Flag everything you normally would; ' +
  'raise false positives for the controller to adjudicate. Do not suppress or downgrade a finding to save words.'
const STANDING =
  'Edit only files inside your fence; if the task needs one outside it, stop and report. ' +
  'Never run git stash, checkout, reset, or clean; a baseline is `git show HEAD:path` into scratch. ' +
  'Never kill a process you did not start. Run every verify step in the FOREGROUND and paste its last line; ' +
  'never end your turn waiting on a run. Final message at most ten lines.'
// These definitions (agents/) already carry the standing lines.
const TYPED = new Set(['ui-implementer', 'motion-implementer', 'data-implementer', 'service-implementer', 'reviewer'])
const REVIEW_RE = /review|audit|critique|adversar|second-opinion/i

export function inject(prompt: string, subagentType: string, description: string): string {
  if (prompt.includes(MARK)) return prompt
  const review = REVIEW_RE.test(`${subagentType} ${description}`)
  const lines = [MARK, review ? REVIEWER : WORKER]
  if (!TYPED.has(subagentType)) lines.push(STANDING)
  return `${prompt}\n\n${lines.join('\n')}`
}

// ---- per-loop tally of what ran ----
export type Tally = {
  source: number
  ui: number
  sweep: boolean
  shots: boolean
  looked: number
  tests: boolean
  skills: string[]
  denies: number
  workers: number
  // merged in from workers that completed inside this turn (main loop only)
  fromWorkers: { source: number; ui: number; sweep: boolean; tests: boolean }
}
export const fresh = (): Tally => ({
  source: 0,
  ui: 0,
  sweep: false,
  shots: false,
  looked: 0,
  tests: false,
  skills: [],
  denies: 0,
  workers: 0,
  fromWorkers: { source: 0, ui: 0, sweep: false, tests: false },
})

// Same file classes as hooks/dispatch.mjs.
const SOURCE_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|sql|css|html|vue|svelte)$/i
const UI_RE = /\.(tsx|jsx|css|scss)$/i
const SKIP_RE = /([/\\]|^)(docs|scratchpad|\.claude|node_modules|dev-mods)([/\\]|$)|\.test\./i
const IMAGE_RE = /\.(png|jpe?g|webp)$/i
const SWEEP_RE = /verify-sweep|verify:sweep/
const SHOTS_RE = /route-shots/
const TEST_RE = /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|typecheck|build|lint)\b|\b(vitest|jest|pytest|tsc|cargo|go)\b|\bnode --test\b/

export function note(t: Tally, tool: string, input: { file_path?: unknown; command?: unknown }): void {
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') {
    const p = String(input.file_path ?? '')
    if (SKIP_RE.test(p)) return
    if (SOURCE_RE.test(p)) t.source += 1
    if (UI_RE.test(p)) t.ui += 1
  } else if (tool === 'Bash' || tool === 'PowerShell') {
    const c = String(input.command ?? '')
    if (SWEEP_RE.test(c)) t.sweep = true
    if (SHOTS_RE.test(c)) t.shots = true
    if (TEST_RE.test(c)) t.tests = true
  } else if (tool === 'Read') {
    if (IMAGE_RE.test(String(input.file_path ?? ''))) t.looked += 1
  }
}

// ---- stamps ----
const DONE_RE = /\b(done|verified|fixed|landed|shipped|passing|resolved)\b/i
const yn = (b: boolean) => (b ? 'yes' : 'no')

/** Gaps in a worker's own evidence, for its spawner to read. Empty when clean. */
export function workerGaps(t: Tally): string[] {
  const out: string[] = []
  if (t.ui > 0 && !t.sweep) out.push(`edited ${t.ui} UI file(s), verify-sweep did not run`)
  if (t.ui > 0 && !t.shots) out.push('edited UI, route-shots did not run (its definition says look at it)')
  if (t.source > 0 && !t.tests) out.push(`edited ${t.source} source file(s), no typecheck/build/test command ran`)
  return out
}

/** The lines shown beneath the architect's answer; undefined when the turn did nothing checkable. */
export function mainStamp(t: Tally, answer: string): string | undefined {
  const edits = t.source + t.fromWorkers.source
  const ui = t.ui + t.fromWorkers.ui
  if (edits === 0 && t.workers === 0 && t.skills.length === 0) return undefined
  const sweep = t.sweep || t.fromWorkers.sweep
  const tests = t.tests || t.fromWorkers.tests
  const skills = t.skills.length ? [...new Set(t.skills)].join(', ') : 'none'
  const lines = [
    `[harness] skills: ${skills} · edits: ${edits} (${ui} ui) · workers: ${t.workers} · sweep: ${yn(sweep)}` +
      ` · route-shots: ${yn(t.shots)} · looked: ${t.looked} · tests/typecheck: ${yn(tests)} · denies: ${t.denies}`,
  ]
  if (edits > 0 && DONE_RE.test(answer)) {
    if (ui > 0 && !t.shots) {
      lines.push(
        '[harness] UNVERIFIED: UI changed and route-shots did not run in the architect loop ' +
          '(skills/design/SKILL.md: done means the architect looked, at the viewport the owner uses).',
      )
    } else if (ui > 0 && t.looked === 0) {
      lines.push('[harness] UNVERIFIED: route-shots ran but no PNG was opened; DOM numbers do not replace looking.')
    }
    if (ui > 0 && !sweep) {
      lines.push('[harness] UNVERIFIED: no verify-sweep ran this turn (skills/design/references/verify.md, THE MECHANICAL FLOOR).')
    }
    if (ui === 0 && !tests) {
      lines.push(
        '[harness] UNVERIFIED: source changed and no test, typecheck, or build command ran ' +
          '(skills/code/references/verify.md: evidence is pasted output).',
      )
    }
  }
  return lines.join('\n')
}
