import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashTerm, loadHashes, scan, scanText, termEntry, toGuard } from './leak-guard.mjs';

const script = fileURLToPath(new URL('./leak-guard.mjs', import.meta.url));
const run = (args, opts = {}) => spawnSync('node', [script, ...args], { encoding: 'utf8', ...opts });
const TERM = 'zorblax';
const guard = (...terms) => toGuard(terms.map(termEntry));

test('hashTerm lowercases and normalises to the tokenizer: a two-word term is one hash', () => {
  assert.equal(hashTerm('Acme  Corp'), hashTerm('acme corp'));
  assert.notEqual(hashTerm('acme'), hashTerm('acme corp'));
  assert.match(hashTerm('x'), /^[0-9a-f]{64}$/);
});

test('termEntry carries the hash and the normalised length', () => {
  assert.deepEqual(termEntry('Acme  Corp'), { hash: hashTerm('acme corp'), len: 9 });
});

test('scanText hits on a word and on a two-word pair, case-insensitively, with line numbers', () => {
  const hits = scanText(`clean line\nthe ${TERM.toUpperCase()} project\nfor Big-Client work`, guard(TERM, 'big client'));
  assert.deepEqual(hits.map((h) => h.line), [2, 3]);
  assert.equal(hits[0].hash8, hashTerm(TERM).slice(0, 8));
});

test('a term inside camelCase, snake_case, a run-together word, and as a plain word is caught', () => {
  const g = guard(TERM);
  for (const text of [`const foo${TERM[0].toUpperCase()}${TERM.slice(1)}Case = 1`, `${TERM}_backup`, `my_${TERM}`, `x${TERM}y`, `plain ${TERM} word`]) {
    assert.equal(scanText(text, g).length, 1, text);
  }
});

test('a clean file passes, including words that merely share letters with a term', () => {
  assert.deepEqual(scanText('const fooBarCase = 1; zorb lax orblax', guard(TERM)), []);
});

test('a hit never carries the word', () => {
  const hits = scanText(`about ${TERM}`, guard(TERM));
  assert.ok(!JSON.stringify(hits).includes(TERM));
});

test('loadHashes fails closed: missing, empty, malformed, or the old string-array shape is an error', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lg-'));
  assert.throws(() => loadHashes(join(dir, 'nope.json')), /hash file/);
  writeFileSync(join(dir, 'empty.json'), '[]');
  assert.throws(() => loadHashes(join(dir, 'empty.json')), /empty/);
  writeFileSync(join(dir, 'bad.json'), '{"a":1}');
  assert.throws(() => loadHashes(join(dir, 'bad.json')), /array/);
  writeFileSync(join(dir, 'old.json'), JSON.stringify([hashTerm('x')]));
  assert.throws(() => loadHashes(join(dir, 'old.json')), /old format.*--add/s);
  writeFileSync(join(dir, 'ok.json'), JSON.stringify([termEntry('x')]));
  assert.equal(loadHashes(join(dir, 'ok.json')).hashes.size, 1);
});

test('scan walks text files, skips .git, node_modules and binary extensions', () => {
  const root = mkdtempSync(join(tmpdir(), 'lg-'));
  mkdirSync(join(root, 'docs'));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'docs', 'a.md'), `ok\n${TERM}\n`);
  writeFileSync(join(root, '.git', 'x'), TERM);
  writeFileSync(join(root, 'node_modules', 'x.js'), TERM);
  writeFileSync(join(root, 'logo.png'), TERM);
  assert.deepEqual(scan(root, guard(TERM)).map((h) => `${h.file}:${h.line}`), ['docs/a.md:2']);
});

test('the shipped hash file is non-empty, valid, and in the new shape', () => {
  const p = fileURLToPath(new URL('./leak-guard.hashes.json', import.meta.url));
  assert.ok(loadHashes(p).hashes.size >= 1);
  const [first] = JSON.parse(readFileSync(p, 'utf8'));
  assert.match(first.hash, /^[0-9a-f]{64}$/);
  assert.ok(Number.isInteger(first.len) && first.len > 0);
});

test('CLI: exit 1 with file:line and 8 hex chars, never the word; exit 0 when clean', () => {
  const root = mkdtempSync(join(tmpdir(), 'lg-'));
  const hashes = join(root, 'h.json');
  writeFileSync(hashes, JSON.stringify([termEntry(TERM)]));
  writeFileSync(join(root, 'a.txt'), `fine\nwe met fooZorblaxCase today\n`);
  const bad = run([root, '--hashes', hashes]);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /a\.txt:2 [0-9a-f]{8}\b/);
  assert.ok(!bad.stdout.toLowerCase().includes(TERM) && !bad.stderr.toLowerCase().includes(TERM));
  writeFileSync(join(root, 'a.txt'), 'all clean\n');
  assert.equal(run([root, '--hashes', hashes]).status, 0);
  assert.equal(run([root, '--hashes', join(root, 'missing.json')]).status, 2);
});

test('CLI --add writes the {hash, len} shape, once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lg-'));
  const hashes = join(dir, 'h.json');
  writeFileSync(hashes, JSON.stringify([termEntry('x')]));
  run(['--add', 'Some Client', '--hashes', hashes]);
  run(['--add', 'some client', '--hashes', hashes]);
  const list = JSON.parse(readFileSync(hashes, 'utf8'));
  assert.equal(list.length, 2);
  assert.deepEqual(list[1], { hash: hashTerm('some client'), len: 11 });
});

test('CLI --self-test passes', () => {
  const r = run(['--self-test']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /self-test ok/);
});
