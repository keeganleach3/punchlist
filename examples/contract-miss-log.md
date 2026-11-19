# Contract — miss log

A filled contract, written before the miss log in this repo was built. The template is
`skills/code/templates/contract.md`.

## 1. Blast radius

Data touched: the day's punchlist (read), the day's dispatch ledger (read), `misses.jsonl` (append).
Users affected: the one person running the session.
Worst case if wrong: the log grows until agents stop reading the files next to it, or a miss is recorded against the
wrong model and the owner moves work to a more expensive tier on bad evidence.
Does not hit: skill files. A miss never edits a rule.
Areas touched: `hooks/dispatch.mjs` — live. `scripts/` — live.

## 2. Trust boundaries

| Input enters at | Validated by (at that boundary) |
|---|---|
| A `Miss:` line typed by an agent into the punchlist | The Stop hook: five fields required; cause, caught-by and changed must each be in a fixed list; the note is cut to twelve words. A line that fails is reported and not written |
| The ledger row joined by ask id | Read as JSON; a row that fails to parse is skipped, and the miss is still written with empty model fields |

## 3. Data & secrets inventory

No tables. No secrets. One file, `docs/superpowers/plans/misses.jsonl`, written only where that folder already exists.

## 4. Failure & rollback

Fails by: writing nothing. A hook error is swallowed, because bookkeeping must never stop a session.
Revert: delete `misses.jsonl`. The punchlist lines are the source and the file can be rebuilt from them.
Down migration: n/a.

Destructive steps:
```
Action:       misses.mjs --compact folds rows older than 90 days into monthly counts
Impact:       per-miss notes and ask ids for those rows are lost
Recovery:     NOT RECOVERABLE from the file; the punchlists still hold the original lines
Alternatives: do not compact; the file stays small for a single user
```

## 5. Proof plan

```
1. Parse and validate a Miss line        → verify: unit tests for each bad shape, each failing before the code
2. Sync is idempotent                    → verify: run the Stop pass twice, row count unchanged
3. Second miss with nothing changed      → verify: Stop reports it once, and not again on rerun
4. Summary never exceeds 25 lines        → verify: unit test with 500 rows across every cause and model
5. No rate printed without its data      → verify: rows with no round print "n/a", not a percentage
```

## 6. Model & budget plan

| step | tier | est tokens | why this tier |
|---|---|---|---|
| Hook sync and findings | middle | 60k | covered by tests; a wrong sync fails them |
| Summary script | middle | 60k | same |

## 7. Model in the loop

Not applicable. The log calls no model: an agent writes one line, code does the rest.
