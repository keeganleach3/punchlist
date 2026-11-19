# contract — the pre-build gate

**Write this before any code on a new service, endpoint, schema, or job. One
screen, approvable in one read. Build only after the owner approves.**

`superpowers:brainstorming` owns the spec; `writing-plans` owns the plan.
Neither asks for these six things (seven when the build calls a model), and
all of them are invisible once building starts.

Write to `docs/contracts/<name>.md` (template: [templates/contract.md](../templates/contract.md)); design contracts keep `docs/design/`:

1. **Blast radius** — data touched, users affected, worst case if wrong. State
   the worst case as a sentence about *someone else's data or money*, not as
   "the endpoint 500s." A blast radius that only describes your own request
   failing hasn't been thought about yet. Close it with **Does not hit** — the
   obvious neighbour (table, module, route) that is NOT in scope — so nobody
   widens the change "to be safe." In a repo with rounds behind it, tag each
   area touched **live** (in force), **leftover** (present, off the main
   path), or **ghost** (named or filed, never wired): never build against a
   ghost, touch a leftover only when that path is in scope.

2. **Trust boundaries** — every point untrusted input enters (request body,
   query string, headers, webhook payload, queue message, upload, another
   service's response, an LLM's output) and what validates it **there**. A
   boundary named without its validator is an unfinished row. Validation that
   happens one layer up does not count — name the check at the boundary.

3. **Data & secrets inventory** — every table touched, with its RLS posture
   stated per table; every env var and secret needed, and where it lives. A
   table that cannot state its posture doesn't ship.

4. **Failure & rollback** — how it fails, the exact revert command, the `down`
   migration. Every destructive or irreversible step is reported in this shape
   *before it runs*:

   ```
   Action:       what will run
   Impact:       what it touches and what is lost
   Recovery:     how to undo — or "NOT RECOVERABLE"
   Alternatives: the safer path, if one exists
   ```

   `NOT RECOVERABLE` is an allowed value and must be used when true — forcing
   the admission beats hand-waving a rollback plan into existence.

   **Chain detection:** when a script or migration contains multiple
   destructive operations, warn about **all of them upfront**, never one at a
   time. Incremental warnings are how you get consented into a disaster one
   approval at a time.

5. **Proof plan** — the test that fails today and passes after. Verification is
   bound per step, never deferred to a trailing QA phase:

   ```
   1. [Step] → verify: [check]
   ```

6. **Model & budget plan** — which steps route to which tier and the estimated
   cost, per [models.md](models.md). This is the opening entry of the ledger.

7. **Model in the loop** — only when the build calls an LLM. The model knows
   the patterns; what it skips unprompted is choosing the simplest one and
   putting the limits in code.
   - **Rung.** Single call → prompt chain → workflow → agent → multi-agent.
     Name the rung and why the one below it fails. Climbing needs a measured
     failure of the lower rung, not an impressive demo.
   - **Done.** What ends a run, and the check that confirms it without the
     model's say-so — a test, a schema, a grounding check against retrieved ids.
   - **Limits in code.** Max steps, token or cost ceiling, timeout per run,
     and what a run returns when it hits one: a partial result with a flag,
     never a crash. Prompt-only limits don't count.
   - **Evals.** Case count and split (dev, plus a held-out set the prompt
     author never tunes against), runs per case, and the gate that blocks a
     regression. Reliability is pass^k — every one of k runs passes — not
     best-of-k.
   - **Cost per success.** Target spend ÷ passing answers, not ÷ calls; a
     cheaper model that fails more can cost more.
   - **Trifecta leg removed** — per [security.md](security.md#model-calls-prompt-injection).

## Rules

- Approval is one message from the owner; silence is not approval.
- Changes after approval amend the contract first, then the build.
- Subagent dispatch prompts quote the contract lines they implement.
- The finish review verifies against the contract, not against taste.
