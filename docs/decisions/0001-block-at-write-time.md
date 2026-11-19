# 0001 · Block at write time, not commit time

## Context

An agent writing code will sometimes put a real key in a file to make a test pass, create a table with no row-level
security, or build a SQL string by interpolation. Scanners that run at commit (git-secrets, gitleaks, pre-commit)
catch the first of these after it is already in the reflog. At that point the key has to be rotated whatever happens
next.

## Decision

Three checks run as a `PreToolUse` hook on the edit tools and deny the write before it lands: a credential literal,
`CREATE TABLE` without `ENABLE ROW LEVEL SECURITY` in the same content, and a SQL statement shape assembled by
template literal, f-string or concatenation. Three more run after the write and only advise.

A block clears one way: an annotation on the offending line naming the rule and a reason. No reason, no override.
Every block and every override is appended to a log by the hook.

## What it costs

- It guards one path. Shell redirects, `sed`, `git apply` and database tools that never write a file all go around
  it. These are listed in `skills/code/references/security.md` with the later check that backstops each.
- It reads only the incoming string. An edit that adds a table to a file which already enables RLS elsewhere is
  blocked, and has to be annotated.
- The override is granted by the same agent that was blocked. It is an audit trail, not a boundary.
- A hard gate that fires on correct code gets switched off. So `%s` formatting is deliberately not flagged (it is
  also the correct parameter syntax in psycopg2), and bare `exec` is not matched.

## How we would know it was wrong

The log gives a ratio of blocks to overrides. If overrides approach blocks, the rules are too broad and people are
annotating past them. If a secret reaches history anyway, the commit-range sweep in `verify.md` finds it and the
entry names which path it took. Counts to date are in `evidence/gate.json`.
