# 0003 · Point at other skills instead of restating them

## Context

Good public skills already exist for process (test-first, debugging, planning), terse output, static design
audits, static security analysis, Postgres performance, and animation libraries. A personal skill that copies their
rules has two problems. Every copied rule is paid for in tokens whenever the skill loads. And the copy goes stale:
when the upstream skill changes, the local version now contradicts it and the agent has two answers.

## Decision

Each skill here opens by naming what it does not cover and who does. It carries only what none of the others do:

| Owned here | Routed elsewhere |
|---|---|
| A contract before any code | Process: test-first, debugging, planning |
| Write-time security gates | Deep static analysis, supply-chain review |
| Model routing and the dispatch ledger | Terse code and prose |
| Runtime verification of the built page | Static design audit |
| The owner's review language, mapped to fixes | Database performance and indexing |
| Usage and miss accounting | Animation and 3D library usage; component sourcing through MCP servers |

Inside the plugin the same rule applies. A rule lives in one file. The dispatch protocol, the review panel and the
usage report are shared by both skills and live once, in `shared/`.

Loading follows the same idea. The skill description is always in context. `SKILL.md` loads when the skill is
invoked. A reference loads only when its trigger fires. `scripts/skill-lint.mjs` caps the size of each layer, and
`npm run lint` fails when one grows past it.

## What it costs

- The plugin is not self-sufficient. Without the routed skills installed, the pointers lead nowhere, and the README
  has to say which ones are assumed.
- An upstream skill can change in a way that conflicts with a rule here. Nothing detects that automatically.
- A skill that is only described does not reliably load, so a session-start hook injects a short rule saying when
  to load each one, at a cost of about 136 estimated tokens in every session.
- Where two skills share a command name, the boundary has to be spelled out (see the scope note at the top of
  `skills/design/SKILL.md`).

## How we would know it was wrong

If agents keep missing a routed rule, the miss log shows it as `rule-not-loaded`: the rule existed and the routing
did not bring it in. Enough of those on one rule is the case for carrying a line locally after all.
