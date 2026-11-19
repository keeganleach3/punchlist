#!/usr/bin/env node
// leak-guard — stop client or project names reaching a public repo without
// publishing the names. Every word and every adjacent word pair in every text
// file is lowercased and SHA-256 hashed; a hit is any hash listed in
// scripts/leak-guard.hashes.json (an array of hex strings). Output names
// file:line and the first 8 hex characters, never the word.
//   node scripts/leak-guard.mjs [root] [--hashes <file>]
//   node scripts/leak-guard.mjs --add "<term>" [--hashes <file>]
//   node scripts/leak-guard.mjs --self-test
// Exit 1 on any hit. Fails closed: a missing or empty hash file exits 2.

import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|bmp|pdf|zip|gz|tgz|7z|woff2?|ttf|otf|eot|mp[34]|mov|webm|wav|ogg|glb|gltf|bin|lockb)$/i;
const DEFAULT_HASHES = join(dirname(fileURLToPath(import.meta.url)), 'leak-guard.hashes.json');

const sha = (s) => createHash('sha256').update(s).digest('hex');
const words = (text) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Hash of a term as the scanner sees it: lowercased words joined by one space. */
export const hashTerm = (term) => sha(words(term).join(' '));

/** The hash-file entry for a term: its hash and the length of its normalised form. */
export const termEntry = (term) => ({ hash: hashTerm(term), len: words(term).join(' ').length });

export const toGuard = (entries) => ({ hashes: new Set(entries.map((e) => e.hash)), lens: new Set(entries.map((e) => e.len)) });

export function loadHashes(path) {
  let list;
  try {
    list = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`hash file unreadable: ${path} (${e.code ?? e.message})`);
  }
  if (!Array.isArray(list)) throw new Error(`hash file must be an array of {hash, len} entries: ${path}`);
  if (!list.length) throw new Error(`hash file is empty: ${path}`);
  if (!list.every((e) => e && /^[0-9a-f]{64}$/.test(e.hash) && Number.isInteger(e.len) && e.len > 0)) {
    throw new Error(`hash file is in the old format (bare hashes) or malformed: ${path} — re-add each term with --add "<term>"`);
  }
  return toGuard(list);
}

/** Hits on whole words, adjacent word pairs, and any substring of a word whose length is a listed len. */
export function scanText(text, { hashes, lens }) {
  const hits = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const w = words(line);
    const seen = new Set();
    const check = (cand) => {
      const h = sha(cand);
      if (hashes.has(h) && !seen.has(h)) {
        seen.add(h);
        hits.push({ line: i + 1, hash8: h.slice(0, 8) });
      }
    };
    for (const t of w) {
      for (const len of lens) for (let s = 0; s + len <= t.length; s++) check(t.slice(s, s + len));
    }
    w.slice(1).forEach((x, j) => check(`${w[j]} ${x}`));
  });
  return hits;
}

export function scan(root, hashes) {
  const hits = [];
  const walk = (dir, rel) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), path);
      } else if (e.isFile() && !BINARY.test(e.name)) {
        for (const h of scanText(readFileSync(join(dir, e.name), 'utf8'), hashes)) hits.push({ file: path, ...h });
      }
    }
  };
  walk(root, '');
  return hits;
}

function selfTest() {
  const dir = mkdtempSync(join(tmpdir(), 'leak-guard-'));
  const planted = 'selftestplant';
  const guard = toGuard([termEntry(planted)]);
  writeFileSync(join(dir, 'dirty.txt'), `a line\nmentions fooSelftestplantCase here\n`);
  const dirty = scan(dir, guard);
  writeFileSync(join(dir, 'dirty.txt'), 'nothing to see\n');
  const clean = scan(dir, guard);
  if (dirty.length !== 1 || dirty[0].line !== 2 || clean.length !== 0) throw new Error('self-test failed: the guard did not catch a planted term or flagged a clean file');
  console.log('leak-guard: self-test ok');
}

const isMain = process.argv[1] && basename(process.argv[1]) === 'leak-guard.mjs';
if (isMain) {
  const argv = process.argv.slice(2);
  const take = (flag) => {
    const i = argv.indexOf(flag);
    return i < 0 ? null : argv.splice(i, 2)[1];
  };
  const hashFile = take('--hashes') ?? DEFAULT_HASHES;
  const add = take('--add');
  try {
    if (argv.includes('--self-test')) selfTest();
    else if (add !== null) {
      if (!words(add).length) throw new Error('--add needs a term');
      let list = [];
      try {
        list = JSON.parse(readFileSync(hashFile, 'utf8'));
      } catch {
        /* first term creates the file */
      }
      const entry = termEntry(add);
      if (!list.some((e) => e.hash === entry.hash)) list.push(entry);
      writeFileSync(hashFile, JSON.stringify(list, null, 2) + '\n', 'utf8');
      console.log(`leak-guard: ${list.length} hash(es) in ${basename(hashFile)}`);
    } else {
      const hashes = loadHashes(hashFile);
      const hits = scan(argv[0] ?? '.', hashes);
      for (const h of hits) console.log(`${h.file}:${h.line} ${h.hash8}`);
      console.log(`leak-guard: ${hits.length} hit(s)`);
      process.exit(hits.length ? 1 : 0);
    }
  } catch (e) {
    console.error(`leak-guard: ${e.message}`);
    process.exit(2);
  }
}
