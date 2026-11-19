# dispatch — how to hand work to a worker

Loaded when about to dispatch. The decision to dispatch (floor, matrix,
reviewer rule) is in `shared/architect.md`; this file is the mechanics.

- [Receipt](#receipt)
- [Dispatch prompts](#dispatch-prompts)
- [The four standing lines](#the-four-standing-lines)
- [Model and reason](#model-and-reason)
- [Punchlist protocol](#punchlist-protocol)
- [Mechanism over memory](#mechanism-over-memory)

## Receipt

**Before the first source edit**, each ask in the punchlist carries one line:
`Build: inline | dispatch <worker> — <trigger a/b/c or none>; fences <n>; interface <frozen|settling>; est <n> lines; review <reviewer|none: why>`.
The Stop auditor flags source edits when today's punchlist has no `Build:`
line. A route that differs from an approved contract's model plan is told to
the owner in the same message; it never only gets amended in the file.

## Dispatch prompts

- **Typed workers first.** Implementation goes to the worker whose exit check
  fits: `ui-implementer`, `motion-implementer`, `data-implementer`,
  `service-implementer` (`agents/`). Their definitions carry the model and the
  standing rules (git, fencing, foreground verify, the sweep, looking at the
  render), so the prompt carries only the punchlist pointer, the fence, the
  port, step deltas, and the plugin root path. Generic dispatch is for work no
  worker fits. A new worker type earns a file only when its tools, model,
  preloaded knowledge, or exit check differ from an existing one, never for a
  job title.
- **After builders finish, dispatch `reviewer`** (read-only) on the diff
  against the contract or punchlist. The Stop auditor flags a round where
  workers edited source and no reviewer ran. Start a prompt with `READ-ONLY`
  when the worker builds nothing; it then owes no `SOURCE:` line.
- **An escape past the reviewer adds a cross-vendor critic.** When a
  `Caught by: owner` miss lands in a diff the reviewer passed, reviews of that
  change class also run `second-opinion` until the class goes three rounds
  without an escape. A same-vendor critic shares the builder's blind spots;
  the escape is the evidence that it did.
- **Size the fence to finish lean.** The Stop auditor flags workers that end
  above 300k tokens; split the task rather than let one worker run deep.
- **Measure outcomes, not reads.** Workers do not load taste skills; the
  architect distils the few rules a task needs into the punchlist, and the
  Stop auditor checks that UI workers ran the sweep: the output, not the
  reading list.
- Never restate the spec. The punchlist file is the single source of truth;
  the prompt points at it and carries only the worker directive (the one from
  the separately installed `honey-superpowers` skill, or the standing lines
  below when it is absent), the file fence, and step deltas. Quote the
  contract lines a prompt implements.
- The fence covers reads too: one `Do NOT load:` line naming what an eager
  agent would wrongly pull in (other tasks' files, prior rounds' plans, the
  whole learnings file). Write fences stop collisions; read fences stop
  context bloat.
- Every UI dispatch carries one gate line: "run the project's verify-sweep
  and paste its output". Checks travel to agents mechanically, never as
  briefs from memory.
- Every motion or section dispatch carries a `SOURCE:` line naming the
  reference's source file (see the `design` skill).

## The four standing lines

Written out so the rule works without the external skill:

1. Edit only files inside your fence; a unique preview filename and port.
2. Never run `git stash`, `checkout`, `reset`, or `clean` (a baseline is
   `git show HEAD:path` into scratch or a separate worktree).
3. Never kill a process you did not start.
4. Run every verify step in the foreground and paste its last line; never
   background one, never end a turn waiting on a run.

## Model and reason

A typed worker's definition carries its default model. A generic dispatch
always passes an explicit `model`, because unset inherits the architect's tier
and silently violates the spawn-tier matrix from Opus/Fable sessions; the
dispatch hook blocks one without it. A worker defaulting to opus needs no
reason; an explicit `model: opus` needs a `COMPLEX:` line at the start of a
line in the prompt (`skills/code/references/models.md`, "Worker defaults and
overrides"). The dispatch hook allows a model above the session tier when the
owner's latest message names it; when the ask came earlier, put
`TIER-OVERRIDE: owner approved` in the prompt.

## Punchlist protocol

Every individual ask (each review line, each requested change) gets its own
**checklist** before any build starts: the steps to solve it AND the
verification that proves it, one box each. Checklists live in
`docs/superpowers/plans/<date>-punchlist.md` (template:
[templates/punchlist.md](templates/punchlist.md)) and are the working state of
the round.

- A box is checked only when the step is DONE: never when dispatched, never
  on an agent's say-so alone.
- Each ask's final box is always "architect verified": pasted command output
  or observed runtime behaviour. An agent's typecheck, build, or reasoning
  never checks that box.
- Each ask carries a ledger row: `| step | tier | effort | est tokens | actual |`.
  Routing savings are provable or they are not claimed.
- Each miss gets one `Miss:` line under its ask; format and causes in
  `shared/misses.md`.
- Dispatch prompts name the checklist items they implement; agent reports map
  to boxes; unchecked boxes at round end are reported open, never dropped.
- Repeat feedback = process failure: if the owner raises the same item twice,
  the fix being layered is wrong. Stop patching and rebuild the mechanic.

## Mechanism over memory

The dispatch hook (`hooks/dispatch.mjs`) enforces the architect protocol in
every session, design rounds included: it blocks generic dispatches with no
explicit `model`, appends dispatch rows to the ledger
(`skills/code/references/models.md`, "Budget ledger"), and audits on Stop:
source edits without a punchlist, fat prompts without a punchlist reference,
ledger gaps, opus rows without a `COMPLEX:` reason, unsourced motion
dispatches, oversized architect reads. Manual ledger rows are only for
`inline` steps. A lesson that recurs after being written down becomes a hook
check or a hard rule the same day, and the prose entry is deleted.

The harness mod (`mods/harness/`, function hooks) covers what a command hook
cannot see. At `agent.spawn` it refuses a model above the session's tier and
injects the honey worker (or reviewer) directive plus the standing lines into
every prompt, so the prompt need not paste them. At a worker's
`turn.complete` it stamps the architect's conversation when the worker edited
UI without the sweep or route-shots, or source without a typecheck, build, or
test. At the architect's `turn.complete` it writes the audit line beneath the
answer from the record (skills loaded, edits, workers, sweep, route-shots,
PNGs opened, tests, denies) and marks the answer UNVERIFIED when it claims done
after edits with no look, sweep, or test this turn.
