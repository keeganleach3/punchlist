---
name: code
description: Use when doing non-frontend work — backends, APIs, data layers, CLIs, infra, migrations, services; before writing code on a new service, endpoint, or schema; when a change touches auth, money, migrations, or a public endpoint; when a change is being called done; when the owner gives code feedback in their own words; and whenever work can be routed to a cheaper model.
user-invocable: true
argument-hint: "[architect | contract | security | data | models | verify | review | usage | panel | misses | dispatch]"
---

Code discipline for non-frontend work. References load on a detection signal,
never all at once, never speculatively. Paths in the references are relative
to the plugin root, `${CLAUDE_PLUGIN_ROOT}`.

**Scope.** Process (TDD, debugging, planning, worktrees, review request and
receipt) belongs to `superpowers`. Terseness and YAGNI belong to `honey`. Deep
static analysis belongs to Trail of Bits: route to it, do not reimplement
CodeQL, Semgrep, or OWASP. Database performance, pooling, indexing, and JSONB
belong to `supabase/agent-skills`. Anything visual belongs to the `design`
skill. Stack, connectors, and subagent fencing live in the user's CLAUDE.md;
field notes live in the project's learnings file. This file carries only what
none of those do.

| Command | Use for — detection signal | Reference |
|---|---|---|
| `architect` | **Every round, automatically** — delegation floor, spawn-tier matrix, builder-is-not-reviewer, ask-don't-guess. Shared with `design` | [shared/architect.md](../../shared/architect.md) |
| `dispatch` | About to dispatch a worker: prompt rules, standing lines, receipt, punchlist protocol | [shared/dispatch.md](../../shared/dispatch.md) |
| `contract` | **Before any code** on a new service, endpoint, schema, or job with no existing pattern in the repo. Section 7, "Model in the loop", applies when the build calls an LLM | [references/contract.md](references/contract.md) |
| `security` | The change touches auth, sessions, money, secrets, a publicly reachable endpoint, or calls a model (prompt injection) — or the hook just blocked a write | [references/security.md](references/security.md) |
| `data` | A migration, `CREATE TABLE`/`ALTER TABLE`, RLS policy, or `SECURITY DEFINER` function is in the diff | [references/data.md](references/data.md) |
| `models` | The round spans many files mechanically, a cost budget was named, or subagents are about to be dispatched | [references/models.md](references/models.md) |
| `verify` | About to say done / fixed / passing, or about to commit or open a PR | [references/verify.md](references/verify.md) |
| `review` | Reviewing a diff, yours or an agent's, running the security pass, or the owner reacts to code in their own words | [references/review.md](references/review.md) |
| `usage` | Asked where tokens went, for an efficiency grade, or for cost improvements; covers design rounds too | [shared/usage.md](../../shared/usage.md) |
| `panel` | "Grill it" / "audit this", or anything about to ship externally: harsh top-of-field review, covers design too | [shared/panel.md](../../shared/panel.md) |
| `misses` | Writing or reading a `Miss:` line, or asked why rounds are failing | [shared/misses.md](../../shared/misses.md) |

Templates for the artifacts these references ask for (contract, reference
file, standing rule) live in [templates/](templates/); the punchlist template
is `shared/templates/punchlist.md`.

## The one rule above all of them

> **Name the blast radius before writing the code.**
> What data it touches, what breaks if it's wrong, and the test that would
> catch it. "Add an endpoint" is not a description. "Add an endpoint reading
> `orders` for the owning user only; wrong means one tenant reads another's
> rows; the negative test asserts a foreign user gets zero rows" is.

**Boundary split rule:** split along *ownership*, *change cadence*, and
*recovery* boundaries. Where those three differ, split the module, service, or
migration.

> **Every change is correct AND reversible**, never one at the expense of the
> other. Working code you cannot roll back is a defect, not a shortcut.

The architect protocol is in force on every round: the session model plans,
owns the punchlist, delegates by rule, reviews every diff, verifies with
pasted output.

## What earns a line

Every line in this skill prevents a specific failure or tells the model
something it would not know. When a failure recurs, add targeted lines for
*that* failure, never broad expansion. `scripts/skill-lint.mjs` caps SKILL.md
and each reference in tokens, so growth fails CI.

## Self-improvement

Field notes go in the project's learnings file, not here; the hook appends its
own catches to its notes file (see `references/security.md`). An entry that recurs across two projects becomes a rule in
the matching reference, or a detector in `hooks/detectors.mjs` when
mechanically checkable, and the notes it came from are deleted.
