import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkClaims, countGlob, parseMarkers, valueAt } from './check-claims.mjs';

const marker = (id, text) => `<!--claim:${id}-->${text}<!--/claim-->`;

test('parseMarkers finds every marker with its text', () => {
  const m = parseMarkers(`We saw ${marker('opus', '212')} rows and ${marker('tok', '5,907,439')} tokens.`);
  assert.deepEqual(m, [{ id: 'opus', text: '212' }, { id: 'tok', text: '5,907,439' }]);
});

test('valueAt walks a dot path; a missing path is undefined', () => {
  assert.equal(valueAt({ a: { b: 4 } }, 'a.b'), 4);
  assert.equal(valueAt({ a: {} }, 'a.b'), undefined);
});

test('countGlob counts files for a one-star pattern', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-'));
  for (const d of ['code', 'design', 'empty']) mkdirSync(join(root, 'skills', d), { recursive: true });
  writeFileSync(join(root, 'skills', 'code', 'SKILL.md'), '');
  writeFileSync(join(root, 'skills', 'design', 'SKILL.md'), '');
  writeFileSync(join(root, 'skills', 'design', 'other.md'), '');
  assert.equal(countGlob(root, 'skills/*/SKILL.md'), 2);
  assert.equal(countGlob(root, 'skills/design/*.md'), 2);
  assert.equal(countGlob(root, 'nothing/*/x'), 0);
});

const resolve = (src) => (src.value !== undefined ? src.value : undefined);
const results = (markers, claims) => checkClaims(markers, claims, resolve);

test('a marker with no source fails', () => {
  const r = results([{ id: 'x', text: '5' }], {});
  assert.equal(r[0].ok, false);
  assert.match(r[0].msg, /no source/);
});

test('a source with no marker fails', () => {
  const r = results([], { y: { value: 3 } });
  assert.equal(r[0].ok, false);
  assert.match(r[0].msg, /no marker/);
});

test('text must match the value, digits only: 5,907,439 equals 5907439', () => {
  assert.equal(results([{ id: 'a', text: '5,907,439' }], { a: { value: 5907439 } })[0].ok, true);
  const bad = results([{ id: 'a', text: '212' }], { a: { value: 213 } })[0];
  assert.equal(bad.ok, false);
  assert.match(bad.msg, /212.*213/);
});

test('a source that resolves to nothing fails; a marker with no digits fails', () => {
  assert.equal(results([{ id: 'a', text: '5' }], { a: { value: undefined, file: 'f' } })[0].ok, false);
  assert.equal(results([{ id: 'a', text: 'many' }], { a: { value: 5 } })[0].ok, false);
});

test('CLI: exit 0 when every claim holds, 1 when one differs; one line per claim and a summary', () => {
  const root = mkdtempSync(join(tmpdir(), 'cc-'));
  mkdirSync(join(root, 'evidence'));
  mkdirSync(join(root, 'skills', 'code'), { recursive: true });
  writeFileSync(join(root, 'skills', 'code', 'SKILL.md'), '');
  writeFileSync(join(root, 'evidence', 'l.json'), JSON.stringify({ opus: { without: 212 } }));
  writeFileSync(join(root, 'evidence', 'claims.json'), JSON.stringify({ opus: { file: 'evidence/l.json', path: 'opus.without' }, skills: { count: 'skills/*/SKILL.md' } }));
  const script = fileURLToPath(new URL('./check-claims.mjs', import.meta.url));
  const run = (readme) => {
    writeFileSync(join(root, 'README.md'), readme);
    return spawnSync('node', [script, 'README.md', 'evidence/claims.json'], { cwd: root, encoding: 'utf8' });
  };
  const good = run(`${marker('opus', '212')} and ${marker('skills', '1')}`);
  assert.equal(good.status, 0);
  assert.equal(good.stdout.trim().split('\n').length, 3);
  const bad = run(`${marker('opus', '211')} and ${marker('skills', '1')}`);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /1 failing/);
  assert.equal(spawnSync('node', [script], { cwd: root }).status, 2);
});
