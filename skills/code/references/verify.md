# verify — proof checks before a change is called done

**Run before claiming complete, fixed, or passing.** The hook reads the
incoming string; these checks read the *running* system. Process discipline is
`superpowers:verification-before-completion` — this file is the seven checks
that discipline is applied to.

Bounded: **one sweep, fix everything as one batch, confirm once, stop.**

**Evidence is pasted output.** "Should pass", "tests were passing", and "the
migration is straightforward" are not evidence. If it was not run in this
session, it was not verified.

## The sweep

1. **The test failed first** — paste the red run from *before* the fix. A test
   written after the code passes proves the test runs, not that it detects the
   bug. When the red run wasn't captured, take the pre-fix code from
   `git show HEAD:<path>` into a scratch directory or a separate worktree and
   run the new test there: it must fail, then pass on the fixed tree. Never
   stash or reset the working tree to get a baseline; that erases other
   people's uncommitted edits.

2. **Full suite green** — paste the run, including the summary line with the
   counts. Not the filtered single-file run used while iterating.
   ```bash
   npm test 2>&1 | tail -20     # or: pytest -q | tail -20
   ```

3. **Secret sweep clean** — the diff *and* anything this round added to
   history. A secret removed in a later commit is still in the repo.
   The hook only sees writes it intercepted — it never scans history, and a
   `git apply`, `sed`, or shell heredoc bypasses it entirely.
   ```bash
   git diff --cached; git log -p ${UPSTREAM:-$(git merge-base HEAD origin/HEAD 2>/dev/null || echo HEAD~10)}..HEAD |
     grep -nEi 'AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|(api[_-]?key|secret|token|password)[[:space:]]*[:=][[:space:]]*["'"'"'`]'
   ```
   (`@{u}` errors when no upstream is set — the fallback range above covers a
   fresh local branch.)
   Any hit that is real: rotate the credential. Removing the line is not
   remediation.

4. **RLS/authz proof** — per touched table: the policy exists, *and* a negative
   test proves an unauthorized reader gets zero rows. Enabled is not protected;
   a `USING (true)` policy passes "RLS enabled" and protects nothing.
   ```sql
   SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('<touched>');
   SELECT tablename, policyname, qual FROM pg_policies WHERE tablename IN ('<touched>');
   ```
   Paste the negative test asserting `rows == 0` for a foreign user. A positive
   test alone proves the happy path, which was never the risk.

5. **Migration reversibility** — the `down` actually ran and restored schema in
   this session. Not "a down migration exists."
   ```bash
   <migrate up> && <migrate down> && <migrate up>   # paste all three
   ```
   Then diff the schema dump against the pre-migration dump. A `down` that
   drops the column but leaves the constraint, index, or type is not a restore.

6. **Error paths exercised** — one test per failure mode named in the
   contract's Failure & rollback block. Untested error branches are where the
   swallowed exception and the leaked internal message live.

7. **Rollback rehearsed** — state the exact revert command, with the commit
   SHA or migration id filled in. If it cannot be stated as a runnable line,
   there is no rollback plan.

## Traceability

Every changed line traces to a contract line or a review note. Lines tracing to
neither are scope creep — revert them, don't justify them. Full protocol in
[review.md](review.md).
