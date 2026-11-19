# Security

## What the write-time gate is

A `PreToolUse` hook that refuses three kinds of write from Claude Code's edit tools: a credential literal, a table
created without row-level security in the same content, and SQL assembled by interpolation.

It protects against an honest model being careless. It is not a boundary against an adversary.

## What it does not cover

- Writes that do not go through the edit tools: shell redirects, `sed -i`, `git apply`, heredocs.
- Database tools that apply a migration without writing a file.
- Secrets that are split, encoded, or built across lines.
- The rest of a file. An edit is scanned as the fragment being written.
- Its own override. The agent that was blocked can annotate past the block; the annotation needs a reason and is
  logged, which makes it an audit trail and nothing more.

Each of these has a later check that backstops it, listed in `skills/code/references/security.md` and
`skills/code/references/verify.md`. For real analysis of a codebase, use a static-analysis tool.

## What the hooks touch

The hooks are Node scripts that run with the user's own permissions. They read tool inputs and session
transcripts, and write to a notes file and, where a project already has one, a plans folder. They make no network
calls. The optional `mods/harness` module uses function hooks, which are not sandboxed.
