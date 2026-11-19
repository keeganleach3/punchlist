# 0004 · Code moves data; the model writes one line and reads one summary

## Context

Three things in this plugin keep records: the dispatch ledger, the usage report, and the miss log. The cheap way to
build any of them is to have the agent write each record and read the file back when it needs an answer. That makes
cost grow with the size of the log, and a log an agent re-reads eventually crowds out the task.

## Decision

- **Writes are done by hooks.** The dispatch hook appends a ledger row from the tool call itself. For a miss, the
  agent writes one short line in the punchlist it is already editing; the Stop hook copies it to `misses.jsonl` and
  fills in model, effort, worker type and round from the ledger.
- **Reads are done by scripts.** No agent opens a ledger or `misses.jsonl`. `scripts/usage.mjs` and
  `scripts/misses.mjs` print a summary, and the summary is what gets read. The miss summary is capped at 25 lines.
- **Files are bounded.** Miss rows older than 90 days fold into monthly counts.
- **A record never goes straight into a skill file.** A rule needs three misses before it is a candidate for a
  change, and a promoted line replaces the notes it came from.

## What it costs

- The fixed vocabulary (eight causes) loses detail. A miss that fits none is still forced to pick, or is left out.
- The cause is assigned by the agent that was just wrong, so the label can be self-serving. Each row records who
  assigned it, and the owner can correct one.
- Hooks that write files can write them in the wrong place. The ledger is written only where a project already has
  its plans folder.

## How we would know it was wrong

If the summary stops being enough and agents start opening the raw files, the design has failed and the summary
needs a new line, not a longer read. The Stop auditor already flags any read over 20 KB that is not a plan file.
