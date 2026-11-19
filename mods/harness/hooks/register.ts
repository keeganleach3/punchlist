// punchlist-harness: the process rules of the code and design skills that command
// hooks could not see, as function hooks. Three jobs:
//   agent.spawn    spawn-tier cap by the parent's model; the honey worker
//                  directive and the standing lines injected into every prompt.
//   turn.complete  a worker that reported without its evidence is stamped into
//                  the architect's conversation; the architect's own "done" gets
//                  a truthful audit line beneath it, plus UNVERIFIED when the
//                  look / sweep / test gate did not run this turn.
// What it does not do: the ledger and the generic-type model guard stay in
// hooks/dispatch.mjs. Taste stays with the architect's eyes.
import type { Register } from 'claude-code'
import { fresh, inject, mainStamp, note, tierDeny, workerGaps, type Tally } from './rules'

type Loop = { t: Tally; type: string }

export const register: Register = on => {
  let main = fresh()
  let userText = '' // the owner's latest own message: naming a model in it voids the tier cap
  const loops = new Map<string, Loop>()
  const loop = (id: string): Loop => {
    let l = loops.get(id)
    if (!l) {
      l = { t: fresh(), type: 'agent' }
      loops.set(id, l)
    }
    return l
  }

  on('prompt.submit', ($, e, next) => {
    if (['composer', 'bridge', 'sdk'].includes(e.origin.kind) && !e.isMeta) userText = e.text
    return next(e)
  })

  on('turn.start', ($, e, next) => {
    main = fresh()
    return next(e)
  })

  on('skill.prompt', ($, e, next) => {
    main.skills.push(e.skill)
    return next(e)
  })

  on('tool.call', ($, e, next) => {
    const t = e.agentId ? loop(e.agentId).t : main
    note(t, String(e.tool), e as unknown as { file_path?: unknown; command?: unknown })
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    if (e.workflow || e.fork || e.isTeammate) return next(e)
    const deny = tierDeny(e.parentModel, e.model, e.prompt, userText)
    if (deny) {
      main.denies += 1
      return { deny }
    }
    const res = await next({ ...e, prompt: inject(e.prompt, e.subagentType, e.description) })
    if (res.deny === undefined) {
      main.workers += 1
      if (res.agentId) loop(res.agentId).type = e.subagentType
    }
    return res
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) {
      const l = loops.get(e.agentId)
      loops.delete(e.agentId)
      if (!l) return next(e)
      const fw = main.fromWorkers
      fw.source += l.t.source
      fw.ui += l.t.ui
      fw.sweep ||= l.t.sweep
      fw.tests ||= l.t.tests
      const gaps = workerGaps(l.t)
      if (gaps.length > 0) {
        const text =
          `[harness] worker ${l.type} (${e.agentId}) reported without its evidence: ${gaps.join('; ')}. ` +
          'Its punchlist boxes stay open until the architect runs the gate and pastes the output.'
        try {
          await $.session.append({ message: { type: 'user', content: [{ type: 'text', text }] } })
        } catch {
          // the stamp is advisory; a refused row never breaks the turn
        }
        try {
          await $.ui.toast(text.slice(0, 160))
        } catch {
          // no surface to toast on
        }
      }
      return next(e)
    }
    const res = await next(e)
    if (e.reason !== 'answer') return res
    const stamp = mainStamp(main, e.answer)
    return stamp ? { text: stamp, usage: res.usage } : res
  })
}
