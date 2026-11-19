# security — the hard gates

Trail of Bits owns deep analysis. This file owns the three things that are
denied at write time, the mistakes the model makes on the way there, the one
escape hatch, and the prompt-injection rules no write-time gate can catch.

- [Hard-blocked (PreToolUse deny — the write never lands)](#hard-blocked-pretooluse-deny-the-write-never-lands)
- [Advisory (PostToolUse — reports, does not block)](#advisory-posttooluse-reports-does-not-block)
- [Mistake table](#mistake-table)
- [Model calls — prompt injection](#model-calls-prompt-injection)
- [Override protocol](#override-protocol)
- [Threat model and known limitations](#threat-model-and-known-limitations)
- [Delegation](#delegation)

## Hard-blocked (PreToolUse deny — the write never lands)

| id | Denies |
|---|---|
| `secret` | A credential literal: vendor key formats, private-key blocks, connection strings with a password, and `key = "value"` assignments, including a quoted key name as in JSON. A quoted value that contains a space is not treated as a secret. |
| `rls` | `CREATE TABLE` in a `.sql` migration with no `ENABLE ROW LEVEL SECURITY` for that table in the same content (SQL comments are ignored). A policy in a later migration is a window, not a guard. |
| `sql-interp` | A statement shape (`SELECT…FROM`, `UPDATE…SET`, `INSERT INTO`, `DELETE FROM`, `DROP TABLE`) built by template literal, f-string or concatenation. `%`-formatting is not flagged: `%s` is also psycopg2's correct parameter syntax. |

## Advisory (PostToolUse — reports, does not block)

`definer-search-path` · `eval` (and `new Function`; bare `exec` is deliberately
not matched — `regex.exec(` and `stmt.exec(` would fire constantly) ·
`rls-permissive` (`CREATE POLICY … USING (true)`). Advisory findings still
append to the hook's notes file, so ignoring one is recorded. That file lives
in the folder named by the `PUNCHLIST_NOTES_DIR` environment variable,
default `~/.claude`.

## Mistake table

Each row names **the model's own failure pattern**, not the correct answer. A
reference that only shows the right pattern still permits the wrong one. RLS
and `SECURITY DEFINER` mistakes live in [data.md](data.md#mistake-table).

| Rule | The model's error pattern |
|---|---|
| Parameterize SQL | reaches for string interpolation specifically when the query is built *conditionally* — the fixed query gets a placeholder, the `WHERE` clause assembled across an `if` or a loop does not |
| Secrets | writes a real key "temporarily" to make a test pass, intending to remove it |
| Authorize at the query | checks ownership in the route handler, then issues a query not scoped by owner — the check and the fetch drift apart on the very next edit |
| Validate on the server | ships the schema/regex check in the client component only, treating a disabled submit button as the guard |
| Guard every new route | copies a neighbouring handler as the template, carries over its body, and drops the middleware or `requireUser` wrapper that surrounded it |
| Errors at the boundary | returns the caught exception straight to the caller, leaking table names, file paths, driver versions, and the failing query |

Where a rule is version-dependent, add a third column for the version floor.

## Model calls — prompt injection

Applies when the diff calls a model (`anthropic`, `openai`, an AI SDK, a CLI
wrapper around one). No write-time gate exists for this class — it is a
design property, not a string pattern — so the contract and the review carry
it. Anyone who can put text in front of the model can steer it: a retrieved
chunk, a fetched page, an email, a tool result, a user's upload.

**The lethal trifecta** (Simon Willison, 2025): private data + untrusted
content + a way to send data out. All three in one agent makes it an
exfiltration tool. The contract names which leg is removed; "the system prompt
tells it not to" removes none.

| Rule | The model's error pattern |
|---|---|
| Retrieved and tool text is data | splices retrieved chunks or tool output into the instruction block, unfenced, so a sentence inside a document reads as a rule |
| Remove a trifecta leg | gives one loop private data, untrusted input, and an outbound channel — a send tool, a fetch of a model-chosen URL, or rendered markdown images whose URLs carry query strings |
| Secrets stay in the tool | passes an API key or user token into the prompt so the model can "call the API itself" |
| Model output is untrusted input | renders it as HTML/markdown unsanitised, or feeds it to SQL, shell, `eval`, or a file path — it crosses the same boundary as a request body |
| Gate destructive tools | exposes a write/delete/send tool with no confirmation or allow list because the prompt says "only when asked" |
| Limits live in code | caps steps, tokens, or spend in the prompt instead of the loop; the model ignores a prompt limit exactly when the run has gone wrong |

**Proof:** a red-team set — injected instructions inside a retrieved document
and inside a tool result — runs with the eval suite; pass means ignored or
refused.

## Override protocol

A hard block clears **only** via an annotation on the offending line (for
`rls`, anywhere in the content). `—` or `--` both work; the reason is
**mandatory** — an annotation with no reason does not suppress:

```
// punchlist:allow <rule-id> — <reason>
```

Rule ids are exactly `secret`, `rls`, `sql-interp`. Every override — rule,
reason, file — is appended to the notes file automatically, so
the blocked-vs-override ratio in its header is computable, and every override
is reviewable later.

Writing a real key into `.env`/`.env.local` is also blocked — annotate it
(`# punchlist:allow secret — local env, gitignored`) when that's genuinely
where it belongs. `.env.example` and lockfiles are skipped entirely.

Valid reasons name why the flagged thing is *not* the risk: a fixture that is
not a live credential, an analytics rollup holding no user rows, an identifier
that is a validated enum rather than user input. "To make the test pass" and
"will remove later" are the exact patterns the gate exists to catch — fix the
cause instead.

**Why a hard gate is not a taste call.** The owner's request outranks a
skill's taste call, but broken builds, security issues, and factually
impossible asks still get flagged and fixed, not shipped silently. A gate with no escape hatch gets disabled within a week; a gate
with a frictionless one is decoration. The annotation is the narrowest hatch
available — per-rule, per-site, reasoned, logged.

## Threat model and known limitations

One sentence, honestly: **this gate protects against an honest model's
carelessness on the Edit/Write/MultiEdit/NotebookEdit path — not against an
adversary.** Named limitations, on purpose rather than discovered later:

- **Bash bypasses it** — `echo > file`, heredocs, `sed -i`, `git apply` write
  without interception. Backstop: verify.md check 3's git-history sweep.
- **MCP tools bypass it** — `apply_migration` reaches the database without a
  file write; the RLS gate covers `.sql` files, so migrations applied directly
  need verify.md check 4's live `pg_policies` proof.
- **The override is self-granted** — the same agent that wrote the secret can
  annotate past the block. It is a speed bump with a mandatory, machine-logged
  reason — an audit trail, not an enforcement boundary. The blocked:override
  ratio in the notes file is how abuse would surface.
- **The Edit path scans only the fragment it is given**, not the resulting
  file. A credential completed by text already in the file is missed, and the
  `rls` check cannot see an `ENABLE ROW LEVEL SECURITY` elsewhere in the file.
  Backstop: verify.md checks 3 and 4.
- **Obfuscation defeats it** — split concatenation, base64, cross-line query
  assembly (`q += …` in a loop). Deep analysis is Trail of Bits' job, below.

## Delegation

Anything past these gates goes to Trail of Bits rather than being restated
here — they ship runnable CodeQL/Semgrep/SARIF with tests and evals:

| Need | Skill |
|---|---|
| Scan a codebase or a diff for vulnerability classes | `static-analysis` |
| Framework/library defaults that are unsafe out of the box | `insecure-defaults` |
| A new or bumped dependency | `supply-chain-risk-auditor` |
| What changed between two versions of a dependency or service | `differential-review` |

This file does not restate OWASP. If a finding needs a taxonomy, it needs one
of the above.
