# misses — one line per miss

A miss is a round step that had to be redone or that the owner caught. The
model writes one short line; code moves and counts the data.

**Never read `misses.jsonl`. Run `node scripts/misses.mjs <path to misses.jsonl>`.**
It prints at most 25 lines, every figure with its N, no percentage under N 20.

## The line

Write it under the ask in the punchlist, where the architect already is:

```
Miss: <cause> · rule <id|none> · caught by <who> · changed <what> · <note, 12 words max>
```

- **rule**: the id of the rule that applied (a hook detector id, a sweep check
  id, or a reference heading), `none` if nothing covers it.
- **caught by**: `test`, `hook`, `sweep`, `reviewer`, `architect`, `owner`.
- **changed**: `tier`, `spec`, `mechanism`, `brief`, `none`.

The Stop hook copies new `Miss:` lines into `docs/superpowers/plans/misses.jsonl`
and joins them to the ledger by ask id. An unknown cause is a finding.

## The eight causes

Pick the first row whose "how you can tell" holds.

| Cause | How you can tell | The fix it points to |
|---|---|---|
| `ambiguous-ask` | Two readings were both reasonable and the asker picked the other one | `spec`: ask before building; write the fork into the contract |
| `missing-context` | The worker lacked a fact that existed (a file, a prior decision) and answered from the fragment | `brief`: add the pointer or read fence |
| `under-tiered` | The wrong output was silent and the tier was below what `models.md` routes it to | `tier`: route up; record the signal that was missed |
| `no-check` | Nothing existed that could have failed on this error | `mechanism`: add the test, hook check, or sweep check |
| `rule-ignored` | The rule was in the worker's context and the output broke it | `mechanism`: prose did not hold, so make it a check |
| `rule-not-loaded` | The rule exists but its reference was not in context for the task | `brief`, or sharpen the detection signal that loads it |
| `environment` | A tool, OS, network, or dependency failure unrelated to the instructions | `none`, unless it repeats: then `mechanism` |
| `taste` | The output met the spec and every check; the owner prefers otherwise | `spec`: record the preference; not a rule until it recurs |

## Escalation

- A second miss on one ask with `changed none` is a Stop finding: something
  must change before a third try.
- A third miss on one ask: stop and take the record to the owner.
- A rule id needs 3 misses before it is a candidate for a new line in a skill
  file. A promoted line replaces the notes it came from, and skill-lint caps
  file size, so growth fails CI instead of accumulating.
