# Contract — <service | endpoint | schema | job name>

<!-- File: docs/contracts/<name>.md. One screen, approvable in one read.
Build only after the owner approves in one message; silence is not approval.
Changes after approval amend this file first, then the build. Reference:
skills/code/references/contract.md. -->

## 1. Blast radius

Data touched: <tables / stores>
Users affected: <who>
Worst case if wrong: <one sentence about someone else's data or money>
Does not hit: <the obvious neighbour that is NOT in scope>
Areas touched: <path — live | leftover | ghost>

## 2. Trust boundaries

| Input enters at | Validated by (at that boundary) |
|---|---|
| <request body / query / header / webhook / queue / upload / LLM output> | <the exact check> |

## 3. Data & secrets inventory

| Table | RLS posture (policy per command) |
|---|---|
| <table> | <SELECT: … / INSERT: WITH CHECK … / …> |

Secrets: <env var — where it lives — never bundled to a client>

## 4. Failure & rollback

Fails by: <mode>
Revert: `<exact command>`
Down migration: <file / "n/a">

Destructive steps (all of them, upfront):
```
Action:       <what will run>
Impact:       <what it touches and what is lost>
Recovery:     <how to undo — or "NOT RECOVERABLE">
Alternatives: <the safer path, if one exists>
```

## 5. Proof plan

```
1. <Step> → verify: <check that fails today and passes after>
2. <Step> → verify: <check>
```

## 6. Model & budget plan

| step | tier | est tokens | why this tier (silent-failure risk) |
|---|---|---|---|
| <step> | <haiku/sonnet/opus/inline> | <est> | <reason> |

## 7. Model in the loop  <!-- delete when the build calls no LLM -->

Rung: <single call | chain | workflow | agent | multi-agent> — one below fails because <measured reason>
Done: <what ends a run> — checked by <test / schema / grounding check>, not the model's say-so
Limits (in code): max steps <n> · tokens/cost <ceiling> · timeout <s> · on limit returns <partial + flag>
Evals: <n> cases · split <dev / held-out> · <k> runs per case, pass^k · gate <what blocks a regression>
Cost per success target: <spend ÷ passing answers>
Trifecta leg removed: <private data | untrusted content | outbound channel> — how
