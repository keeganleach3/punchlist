import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compareOutput } from './check-evidence.mjs';

const script = fileURLToPath(new URL('./check-evidence.mjs', import.meta.url));

test('compareOutput ignores line-ending differences only', () => {
  assert.equal(compareOutput('a\r\nb\r\n', 'a\nb\n'), true);
  assert.equal(compareOutput('a\nb\n', 'a\nc\n'), false);
});

function repo(committed, generated) {
  const root = mkdtempSync(join(tmpdir(), 'ce-'));
  mkdirSync(join(root, 'evidence'));
  writeFileSync(join(root, 'evidence', 'gen.mjs'), `process.stdout.write(${JSON.stringify(generated)});`);
  writeFileSync(join(root, 'evidence', 'out.json'), committed);
  writeFileSync(join(root, 'evidence', 'generators.json'), JSON.stringify({ 'evidence/out.json': 'evidence/gen.mjs' }));
  return root;
}
const run = (root, args = ['evidence/generators.json']) => spawnSync('node', [script, ...args], { cwd: root, encoding: 'utf8' });

test('exit 0 when the generator reproduces the committed file (CRLF tolerated)', () => {
  const r = run(repo('{"a":1}\r\n', '{"a":1}\n'));
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 generator.*0 differ/);
});

test('exit 1 and the file named when the committed file is stale', () => {
  const r = run(repo('{"a":1}\n', '{"a":2}\n'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /DIFF evidence\/out\.json/);
});

test('a generator that fails is a difference, not a pass', () => {
  const root = repo('x', 'x');
  writeFileSync(join(root, 'evidence', 'gen.mjs'), 'process.exit(3)');
  const r = run(root);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL evidence\/out\.json/);
});

test('a missing committed file is a difference; no argument or unreadable map exits 2', () => {
  const root = repo('x', 'x');
  writeFileSync(join(root, 'evidence', 'generators.json'), JSON.stringify({ 'evidence/nope.json': 'evidence/gen.mjs' }));
  assert.equal(run(root).status, 1);
  assert.equal(run(root, []).status, 2);
  assert.equal(run(root, ['missing.json']).status, 2);
});
