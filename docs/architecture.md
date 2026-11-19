# Architecture

Three pictures: how a round of work runs, what loads when, and how a miss becomes a check.

## 1. A round

The session model is the architect. It plans, hands out work by rule, and is the only one that calls anything done.

```mermaid
sequenceDiagram
    participant O as Owner
    participant A as Architect (session model)
    participant H as Hooks
    participant W as Worker
    participant R as Reviewer

    O->>A: asks for a change
    A->>O: contract (blast radius, rollback, proof plan)
    O->>A: approves
    A->>A: punchlist: one checklist per ask, with a Build line
    A->>H: dispatch (model, fence, punchlist pointer)
    H-->>A: refused if no model, or top tier with no reason
    H->>W: allowed, ledger row written
    W->>H: writes a file
    H-->>W: refused if key literal, table without RLS, or built SQL
    W->>A: report, with pasted test output
    A->>A: reruns the checks itself
    A->>R: reviewer, fresh context, read-only
    R->>A: findings with file and line
    A->>O: done, with every box checked or listed as open
```

Where each rule lives:

| Step | File |
|---|---|
| Contract | `skills/code/references/contract.md`, `skills/design/references/contract.md` |
| When to dispatch, builder is not reviewer | `shared/architect.md` |
| Dispatch prompts and the punchlist | `shared/dispatch.md` |
| Which model for which step | `skills/code/references/models.md` |
| Dispatch guard, ledger, Stop audit | `hooks/dispatch.mjs` |
| Write-time gate | `hooks/scan.mjs`, `hooks/detectors.mjs` |
| Checks before "done" | `skills/code/references/verify.md`, `skills/design/references/verify.md` |

## 2. What loads when

Nothing is loaded until it is needed. The sizes are in `evidence/sizes.json`.

```mermaid
flowchart TD
    D["Skill descriptions and a short routing rule<br/>always in context"] -->|task matches the rule| S["SKILL.md<br/>command table and standing rules"]
    S -->|a trigger fires| R["One reference<br/>for example security.md when a diff touches auth"]
    S -->|every round| SH["shared/architect.md<br/>used by both skills"]
    R -->|needs a check| SC["A script runs<br/>the model reads its last line"]
```

`scripts/skill-lint.mjs` caps `SKILL.md` and each reference in tokens. A file that grows past its cap fails
`npm run lint`, which CI runs, so the layers cannot drift into each other.

## 3. From a miss to a check

A miss is a step that had to be redone, or that the owner caught after it was called done.

```mermaid
flowchart LR
    M["Miss found"] --> L["One line in the punchlist<br/>cause, rule, who caught it, what changed"]
    L --> H["Stop hook copies it to misses.jsonl<br/>adds model and round from the ledger"]
    H --> S["misses.mjs prints a summary<br/>25 lines at most"]
    S --> Q{"Same rule,<br/>three misses?"}
    Q -- no --> C["Stays a count"]
    Q -- yes --> K{"Can a script<br/>check it?"}
    K -- yes --> N["New hook or sweep check, with a test"]
    K -- no --> P["One line in a reference,<br/>replacing the notes it came from"]
```

Two side branches stop a round from looping. A second miss on the same ask with nothing changed is flagged when the
session stops. A third miss on the same ask stops the work and sends the record to the owner.

The cause decides the fix. An ask that was ambiguous goes back to the owner, because a stronger model reads the same
ambiguity. A miss coded `under-tiered` is the evidence for moving that kind of work up a tier. The causes and what
each points to are in `shared/misses.md`.
