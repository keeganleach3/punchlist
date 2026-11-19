# models — tier routing by silent-failure risk

> **Route by whether a wrong call is silently wrong — not by whether the work
> looks rote.**

Volume, file count, and "this feels mechanical" are not routing signals. The
only question is: **if the delegate gets this wrong, does anything tell you?**

- [The worked example the naive rule gets backwards](#the-worked-example-the-naive-rule-gets-backwards)
- [Tiers](#tiers)
- [Worker defaults and overrides](#worker-defaults-and-overrides)
- [Hard rules](#hard-rules)
- [Cost discipline per dispatch](#cost-discipline-per-dispatch)
- [Budget ledger](#budget-ledger)

## The worked example the naive rule gets backwards

A simplification or cleanup pass looks mechanical; it is a taste call carrying
behavior-preservation risk, and a bad one compiles, passes the smoke test, and
fails quietly six weeks later. It routes up.

A 200-file mechanical rename looks large and expensive. It is trivially
verifiable: the build breaks, or it doesn't. It routes down.

Size is not risk. Verifiability is.

## Tiers

| Tier | Class | Examples |
|---|---|---|
| **Haiku** | ROUTINE — wrong is loudly, immediately wrong | bulk renames, test scaffolding from an approved spec, log/grep sweeps, changelog and doc updates, formatting, data extraction |
| **Sonnet** | MODERATE — wrong is caught by the test suite | feature code against an approved plan, bug fixes with a repro, test authoring, bounded diff review |
| **Opus** | COMPLEX — wrong is silently wrong | architecture, contract authoring, adversarial security review, root-cause on non-obvious bugs, simplification passes, anything touching auth/money/migrations |

**Effort is the second axis** and follows the same rule: high where a wrong
answer is silent (`reviewer`, `data-implementer`), medium where typecheck,
build, and the sweep catch it loudly (`ui-`, `motion-`, `service-implementer`),
low for haiku bulk. The Agent tool's `effort` param overrides per dispatch and
the ledger row records it, so the usage report can grade it.

Down-tier only where the check that catches a wrong answer **already exists**.
"The suite would catch it" is a Sonnet claim only when the suite is green and
covers the path; otherwise the work is COMPLEX by default.

## Worker defaults and overrides

Each worker definition in `agents/` carries a default tier. Implementers
default to `sonnet`; `reviewer` and `data-implementer` default to `opus`. The
dispatch overrides the default per task by silent-failure risk:

- A dispatch whose worker definition defaults to opus needs no reason.
- An explicit `model: opus` on a dispatch needs a `COMPLEX: <why a wrong
  answer would be silent>` line **at the start of a line** in the prompt. The
  ledger records it and the Stop auditor flags opus rows without one. Writing
  the reason down is what makes the routing checkable.
- An override **down** needs nothing.
- A generic (untyped) dispatch always sets `model` explicitly; unset inherits
  the architect's tier. The ledger records the effective model and whether it
  was explicit, default, or inherited.

## Hard rules

1. **The security gate never delegates down-tier.** The adversarial reviewer is
   Opus or a cross-vendor model, always: a cheaper security pass is an absent
   one. When the spawn-tier matrix forbids Opus (Sonnet architect), route
   cross-vendor (`second-opinion` → Codex/Gemini CLIs) or halt for a higher
   architect. Those are the only two moves.
2. **Never delegate a task needing more context than the delegate can hold.** A
   truncated delegate does not report truncation; it answers confidently from
   the fragment it got.
3. **Every dispatch carries a worker directive**: the one from the separately
   installed `honey-superpowers` skill, or the four standing lines in
   `shared/dispatch.md` when it is absent. Subagents inherit none of the
   session's output discipline; without it they emit full-fat code and prose,
   which is where the multiplied cost is.
4. Fencing, foreground verification, the spawn-tier matrix cap, and never
   restating the spec: `shared/architect.md` (Spawn-tier matrix) and
   `shared/dispatch.md` (Dispatch prompts).

## Cost discipline per dispatch

Most of a dispatch's tokens go to verification, not the change. Standing rules:

- **Return the summary, write the report.** An agent's final message is at
  most ten lines: what changed, gate output pasted (the sweep's one line),
  what it could not do. Anything longer goes to a file under `docs/` and the
  message names the path.
- **Screenshots are for the frame in question.** DOM measurement first (sizes,
  opacity, ink coverage, `scrollWidth`); one screenshot per route at 1920 as
  the visual gate; extra frames only where a finding names one. Every
  screenshot is image tokens on every later turn of that agent.
- **Gates run once, at the end.** tsc, build, smoke, sweep: one pass after the
  last edit, not after each.
- **Resumes over respawns.** A stalled agent gets a `SendMessage` with a
  git-status reorientation; a fresh agent repeats every read the old one did.

## Budget ledger

Every routed step appends one row to the round's punchlist:

```
| step | tier | effort | est tokens | actual |
```

`actual` gets filled in after the step, not estimated twice.

Dispatch rows write themselves: the dispatch hook (`hooks/dispatch.mjs`,
PostToolUse on Agent|Task) appends `docs/superpowers/plans/<date>-ledger.jsonl`
with model, agent type, prompt size, punchlist reference, COMPLEX reason, and
tool-use id. The punchlist table carries estimates plus `inline` rows the hook
cannot see. `actualTokens` arrives late: background agents return before they
finish, so the Stop pass back-fills rows from the task notifications by
tool-use id. A row still null at end of day means the agent never reported,
which is itself a finding.

No price table lives in this file: prices go stale, so read them from the
vendor at routing time if a number is needed.
