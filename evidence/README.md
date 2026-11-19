# evidence

Every number the README cites comes from a file here, and `npm run check` compares the two.

| File | Produced by |
|---|---|
| `sizes.json` | `node evidence/sizes.mjs > evidence/sizes.json`. What each layer of the plugin costs to load, estimated as words × 1.33. `npm run check` re-runs it and fails if the committed file is stale. |
| `ledger-summary.json` | `node evidence/ledger-summary.mjs <ledger folder>`. Counts from one project's dispatch ledgers, one row per subagent dispatch. The ledgers themselves are private. |
| `gate.json` | `node evidence/gate-count.mjs <code notes> <design notes>`. How many writes the gate blocked, overrode or advised on. The notes files are private. |

Counts only. No entry text, names or paths from the private inputs.
