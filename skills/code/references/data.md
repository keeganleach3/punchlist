# data — policy and reversibility

Performance, pooling, indexing, and JSONB belong to `supabase/agent-skills`
(installed third-party). This file is policy and reversibility only.

- [RLS — enabled ≠ protected](#rls-enabled-protected)
- [SECURITY DEFINER](#security-definer)
- [Least-privilege grants](#least-privilege-grants)
- [Zero-downtime migration ladder](#zero-downtime-migration-ladder)
- [Every migration ships its down](#every-migration-ships-its-down)
- [Mistake table](#mistake-table)

## RLS — enabled ≠ protected

- `ENABLE ROW LEVEL SECURITY` with no policy denies `anon`/`authenticated` and
  nothing else. `service_role`, any `BYPASSRLS` role, and **the table owner**
  still read everything — owner bypass persists until `FORCE ROW LEVEL SECURITY`.
  Enabling is not the finish line; the policy is.
- `USING (true)` is the default failure mode. It satisfies the linter, the
  Tier-1 `rls` hook check, and every "is RLS on?" question, while permitting
  every row to every caller. A policy body with no `auth.uid()`, no join to an
  ownership column, and no explicit role check is not an authz policy.
- **One policy per command.** `FOR ALL` collapses read and write authorization
  into one predicate; the read predicate is almost never the correct write
  predicate. `INSERT` is gated by `WITH CHECK`, not `USING` — an `INSERT` policy
  written with only `USING` applies nothing and fails open on write.
- Ownership is proven by a column on the row. `USING (auth.uid() = user_id)` is
  checkable. `USING (true)` plus `.eq('user_id', uid)` in the caller is a
  client-side filter wearing a policy's name — any other client omits it.
- Every touched table ships a **negative test**: an unauthorized reader gets
  zero rows, asserted. "The policy exists" is not proof (`verify.md` check 4).

## `SECURITY DEFINER`

- The body runs as the definer, resolving unqualified names through the
  **caller's** `search_path` — so a caller who can create objects can shadow a
  function or table the body calls. Pin it: `SET search_path = ''` and
  schema-qualify every identifier. Supabase's advisor names this
  `function_search_path_mutable`.
- `SECURITY DEFINER` is the sanctioned way to *bypass* RLS. Every definer
  function is therefore an authz decision: do the check inside the body, because
  the policy no longer will.
- Postgres grants `EXECUTE` on new functions to `PUBLIC` by default. A definer
  function is callable by everyone until you `REVOKE EXECUTE ... FROM public`
  and grant back to the one role that needs it.
- **Views** (version floor PG ≥ 15): a view runs with its owner's rights and
  bypasses the querier's RLS unless created `WITH (security_invoker = true)`.
  Below 15 there is no invoker option — the RLS has to live in the view's own
  predicate. Advisor name: `security_definer_view`.

## Least-privilege grants

- Supabase's default privileges hand `anon` and `authenticated` broad table
  rights in `public`. RLS is the only thing between them and the rows — a table
  that should never be client-reachable gets an explicit `REVOKE`, not just a
  policy.
- Sequences and functions carry separate grants. Revoking on the table covers
  neither.
- The `service_role` key bypasses RLS entirely. Server-side only — never in
  anything bundled to a client (`NEXT_PUBLIC_*`, `VITE_*`), never in an edge
  function reachable without auth.

## Zero-downtime migration ladder

Every column addition on a live table runs this ladder. Steps 1–5 are separate
migrations wherever a deploy sits between them.

1. **Add nullable, no default.** (PG ≥ 11 makes a non-volatile default fast, but
   a volatile default or an older server rewrites the whole table under
   `ACCESS EXCLUSIVE`.)
2. **Deploy code that writes both** old and new paths.
3. **Backfill in bounded batches**, committing each. One unbounded `UPDATE`
   holds row locks for its full duration and, when it times out, records no
   progress at all.
4. **`SET NOT NULL`** — precede it with `CHECK (col IS NOT NULL) NOT VALID`
   then `VALIDATE CONSTRAINT` (PG ≥ 12), so the enforcement scan takes a weak
   lock instead of blocking the table.
5. **Add the default.**
6. **Drop the old column in a later migration**, after no deployed reader
   references it.

- Never put a schema change and a data backfill in the same migration.
- A rename is a drop+add to every already-deployed reader. Expand/contract
  instead.
- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block, and most
  migration runners wrap every file in one — that wrapper is the actual failure,
  not the SQL.

## Every migration ships its `down`

- The `down` is authored with the `up`, not after, and is executed once against
  a copy before the `up` counts as done.
- A `down` that recreates a dropped column without its data is not a rollback.
  Say so: irreversible steps use the destructive-op template with
  `Recovery: NOT RECOVERABLE` when that is the truth.
- Within a release, prefer rename-to-`_deprecated` over `DROP` — reversibility
  costs one migration and buys the rollback back.

## Mistake table

Named as the model's failure pattern, not the correct answer — a rule that only
shows the right pattern still permits the wrong one.

| Rule | The model's error pattern | Version floor |
|---|---|---|
| RLS on every table | enables RLS, writes a `USING (true)` policy, calls it done | — |
| One policy per command | writes a single `FOR ALL` policy, then a `USING` clause on `INSERT` that never executes | — |
| Ownership in the predicate | leaves the policy permissive and filters by user id in the client call | — |
| `SECURITY DEFINER` | omits `SET search_path`, leaving the function hijackable | — |
| Function grants | relies on the default, which is `EXECUTE` to `PUBLIC` | — |
| Views and RLS | assumes a view inherits the querier's RLS | PG 15 |
| service_role | when a policy blocks a query, swaps in the service-role key instead of fixing the policy | — |
| Migration ladder | adds the column `NOT NULL DEFAULT` in one step and rewrites the live table | PG 11 |
| Backfill | issues one unbounded `UPDATE`, in the same migration as the DDL | — |
| Concurrent index | emits `CREATE INDEX CONCURRENTLY` into a runner that wraps files in a transaction | — |
| Every migration ships a `down` | mirrors the DDL and calls an emptied column a rollback | — |

SQL built by interpolation, secrets, and the other write-time mistakes are in
[security.md](security.md#mistake-table).
