# usage — token report, efficiency grade, improvements

Run the numbers, then grade them. The script is deterministic; the judgment
is applied here. Serves **both** skills — design rounds and code rounds.

```bash
node scripts/usage.mjs --days 7
```

The script path is relative to the plugin root. Run it with the project as the
working directory: the cost-per-verified-item line reads that project's
`docs/superpowers/plans/`. For why rounds missed, run `scripts/misses.mjs`
(see `shared/misses.md`); never read `misses.jsonl` directly.

## The quality floor (non-negotiable)

Every recommendation must survive honey's never-cut list: input validation at
trust boundaries, error handling preventing data loss, security, accessibility
basics, visual/UX polish when the deliverable is user-facing, and anything
the owner explicitly asked for. review.md's over-simplification brake applies to
the recommendations themselves — an efficiency win that costs clarity,
correctness, or design quality is graded as a **regression**, not a saving.
Recommend routing and process changes, never quality cuts.

## Grade dimensions (A–F each, then overall)

| Dimension | Measured by | A looks like |
|---|---|---|
| **Routing** | Output-token share per model tier vs task mix | mechanical/verifiable work visibly on cheaper tiers; Opus share concentrated in architecture, review, contracts |
| **Ledger discipline** | `\| step \| tier \| effort \| est \| actual \|` rows present in the round's punchlist | every dispatch has a row; est vs actual within ~2× |
| **Gate efficiency** | blocked : override ratio from the hook's notes file | blocks trend down over time (rules teach); overrides stay rare and reasoned |
| **Loop hygiene** | learnings line counts vs last report | files shrink about as often as they grow; promotions logged |
| **Cache leverage** | cacheRead vs fresh input | long sessions reusing cached context, not re-reading files already in context |
| **Dispatch weight** | subagent count × verbosity of their reports | workers return aggregates, not transcripts; honey directive present in every prompt |
| **Cost per verified item** | `cost per verified item` line: dispatched `actualTokens` ÷ items the architect verified (`- [x] Architect…`, `- [V]`, or ☑ in an Architect column) across the window's punchlists — run from the project root | falls or holds round over round while escapes don't rise. A cheaper tier whose number climbs is misrouted: the redo costs more than the saving. Denominator is successes, never dispatches |
| **Escape rate** | `Caught by: owner` entries in the learnings files vs catches by earlier layers (test / hook / sweep / reviewer / architect) | escapes trend toward zero; every escape has a learnings entry naming which gate should have caught it and what changed so it will next time |

## Report format

1. **Numbers** — script output, pasted.
2. **Grade** — one letter per dimension + overall, each with its one-line
   evidence. No dimension graded without a number behind it.
3. **Top 3 improvements** — each names the mechanism (route X down-tier, batch
   Y, stop re-reading Z), its estimated saving, and **why quality holds** (the
   check that catches a wrong answer already exists). An improvement that
   can't state its quality argument doesn't ship.
4. **Escapes since last report** — each mistake the owner called out or that
   shipped wrong, with its learnings entry and the gate change that answers
   it. An escape without a gate change is an open item, not a lesson.
5. One line: what changed since the last report. Trend beats snapshot.

**Capture rule for escapes:** the moment the owner calls out a mistake or a
shipped defect surfaces, it gets a learnings entry in the standard schema
with `Caught by: owner`, same round, not retrospectively. That tag is what
the escape counter and the report's section 4 read.

## Known reading traps

- Output tokens dwarf input in cost per token — grade output first.
- A high Opus share is not automatically bad: contracts, audits, and security
  passes *belong* there (models.md). Grade misrouting, not model presence.
- cacheRead is nearly free — a huge cacheRead number is the system working,
  not waste. The waste signal is fresh `in` re-reading what cache already held.
- `<synthetic>` rows are harness noise; ignore.
- Cost per verified item undercounts when ledger rows are unreported (the
  line prints `N of M unreported`) and ignores inline work. Grade its trend
  within one project, never its absolute value or across projects. A punchlist
  in none of the three shapes counts zero verified — fix the punchlist to the
  template, not the parser.
