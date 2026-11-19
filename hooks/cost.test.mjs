import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audit, RISKY_PATH_RE } from './dispatch.mjs';
import { newNotes } from './scan.mjs';
import { TEXT } from './session-start.mjs';

const run = (editedPaths, ctx) => audit({ dispatches: [], editedPaths }, { punchlistExists: false, ledgerRows: 0, ...ctx });

// 1. paperwork findings only where the project keeps plans, or the edit is risky
test('a one-line edit with no plans folder gives no paperwork finding', () => {
  assert.deepEqual(run(['src/Button.tsx'], { plansDir: false }), []);
});
test('the same edit with a plans folder and no punchlist gives the finding', () => {
  assert.match(run(['src/Button.tsx'], { plansDir: true }).join('\n'), /no punchlist for today/);
});
test('a risky edit gives the finding even with no plans folder', () => {
  assert.match(run(['supabase/migrations/001.sql'], { plansDir: false }).join('\n'), /no punchlist for today/);
});
test('RISKY_PATH_RE matches the named areas and not a button', () => {
  for (const p of ['src/auth/x.ts', 'login.ts', 'session.ts', 'password.ts', 'payment.ts', 'billing.ts',
    'stripe.ts', 'checkout.ts', 'invoice.ts', 'db/migration.ts', 'a/migrations/b.ts', 'q.sql', 'api/x.ts', 'src/routes/y.ts', 'middleware.ts']) {
    assert.equal(RISKY_PATH_RE.test(p), true, p);
  }
  assert.equal(RISKY_PATH_RE.test('src/Button.tsx'), false);
});

// 2. each field note once per session
test('a note is injected once per session; a different note still gets through', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pl-notes-'));
  const a = '- 2026-01-01 · api · one';
  const b = '- 2026-01-02 · api · two';
  assert.deepEqual(newNotes([a], 's1', dir), [a]);
  assert.deepEqual(newNotes([a], 's1', dir), []);
  assert.deepEqual(newNotes([a, b], 's1', dir), [b]);
  assert.deepEqual(newNotes([a], 's2', dir), [a]);
});
test('no session id injects every time; a bad dir never throws', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pl-notes-'));
  assert.deepEqual(newNotes(['x'], undefined, dir), ['x']);
  assert.deepEqual(newNotes(['x'], undefined, dir), ['x']);
  assert.deepEqual(newNotes(['x'], 's9', join(dir, 'missing', 'deeper')), ['x']);
});

// 3. session-start points at dispatch.md
test('session-start item 4 cites shared/dispatch.md and stays within 160 words', () => {
  assert.match(TEXT, /Before dispatching a subagent: load `shared\/dispatch\.md` through either skill\./);
  assert.ok(TEXT.trim().split(/\s+/).length <= 160);
});
