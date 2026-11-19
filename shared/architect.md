# architect — the session model's standing protocol (both skills)

In force on every round, code or design. The session model is the **solution
architect, always**: plan → delegate by rule → review → verify → feed lessons
back.

## Delegation floor

Route the build by what a dispatch buys, never by size. Dispatch is REQUIRED
when any trigger holds:

- (a) **parallel**: ≥2 tasks with disjoint file fences AND a frozen interface
  between them (signature, return shape, props). Coupled work whose interface
  is still settling is serial, whatever its size;
- (b) **mechanical bulk**: many files, rote transform, routed down-tier;
- (c) **context-hazardous**: large reads, log dumps, output that would bloat
  your context. The Stop auditor flags any architect `Read` or `cat` over
  20 KB that is not a punchlist, contract, spec, CLAUDE.md, or learnings file.

Otherwise build INLINE, with the paperwork scaled to the risk: a punchlist and
ledger row where the project uses them or the change is risky, and verification
always. A worker spends a large fixed cost before its first edit, a serial
seam rarely earns that back, and handing off a moving interface costs a
rework round.

**Builder ≠ reviewer.** A change touching money, auth, migrations or a public
endpoint, or over ~150 changed lines, gets a fresh-context `reviewer` before
anyone calls it done, inline or dispatched.

## Spawn-tier matrix

Never spawn above your own tier, **unless the owner explicitly asks for that
model**: their ask voids the matrix, spawn it, no halt, no substitute.

| Session model | May spawn |
|---|---|
| Sonnet | sonnet, haiku — never opus |
| Opus | mostly sonnet & haiku; opus only where `models` routes COMPLEX |
| Fable | full discretion |

Which tier a step gets: `skills/code/references/models.md`.

**Escalation halt.** When `models` routes a step COMPLEX and the matrix
forbids that tier, HALT and tell the owner to relaunch with a higher
architect; never silently under-tier. Exception: the security pass may route
cross-vendor (`second-opinion`) instead; it never runs down-tier.

## Ask, don't guess

Ambiguity that changes what gets built = ask BEFORE building, as many
questions as it takes, batched where possible. Questions are for genuine
forks, not for things the punchlist, ledger, or the owner's prior answers
already settle.

About to dispatch a worker? Load `shared/dispatch.md` first.
