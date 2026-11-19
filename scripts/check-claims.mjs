#!/usr/bin/env node
// check-claims — every number the README states is checked against its source.
//   node scripts/check-claims.mjs <README.md> <claims.json>
// README numbers are wrapped: <!--claim:ID-->212<!--/claim-->. The claims file maps
// each ID to {"file": "evidence/x.json", "path": "a.b"} or {"count": "skills/*/SKILL.md"}
// (one-star glob, counts files). Paths resolve against the current directory.
// Exit 1 when a marker has no source, a source has no marker, or the digits differ.

import { readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export function parseMarkers(md) {
  return [...md.matchAll(/<!--claim:([\w.-]+)-->([\s\S]*?)<!--\/claim-->/g)].map(([, id, text]) => ({ id, text }));
}

export function valueAt(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/** Files matching a glob whose only wildcard is `*` within one path segment. */
export function countGlob(root, pattern) {
  const segs = pattern.split('/');
  const walk = (dir, i) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return 0;
    }
    const re = new RegExp(`^${segs[i].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
    let n = 0;
    for (const e of entries.filter((e) => re.test(e.name))) {
      if (i === segs.length - 1) n += e.isFile() ? 1 : 0;
      else if (e.isDirectory()) n += walk(join(dir, e.name), i + 1);
    }
    return n;
  };
  return walk(root, 0);
}

const digits = (v) => String(v).replace(/\D/g, '');

/** resolve(source) returns the value, or undefined when it cannot. */
export function checkClaims(markers, claims, resolve) {
  const out = [];
  for (const { id, text } of markers) {
    const src = claims[id];
    if (!src) out.push({ id, ok: false, msg: `marker has no source in the claims file ("${text}")` });
    else {
      const value = resolve(src);
      if (value === undefined) out.push({ id, ok: false, msg: `source did not resolve (${JSON.stringify(src)})` });
      else if (!digits(text) || digits(text) !== digits(value)) out.push({ id, ok: false, msg: `README says "${text}", source says ${value}` });
      else out.push({ id, ok: true, msg: `${text} = ${value}` });
    }
  }
  for (const id of Object.keys(claims)) {
    if (!markers.some((m) => m.id === id)) out.push({ id, ok: false, msg: 'source has no marker in the README' });
  }
  return out;
}

const isMain = process.argv[1] && basename(process.argv[1]) === 'check-claims.mjs';
if (isMain) {
  const [readme, claimsFile] = process.argv.slice(2);
  if (!readme || !claimsFile) {
    console.error('usage: check-claims.mjs <README.md> <claims.json>');
    process.exit(2);
  }
  let markers, claims;
  try {
    markers = parseMarkers(readFileSync(readme, 'utf8'));
    claims = JSON.parse(readFileSync(claimsFile, 'utf8'));
  } catch (e) {
    console.error(`check-claims: ${e.message}`);
    process.exit(2);
  }
  const root = process.cwd();
  const resolve = (src) => {
    try {
      if (src.count) return countGlob(root, src.count);
      return valueAt(JSON.parse(readFileSync(join(root, src.file), 'utf8')), src.path);
    } catch {
      return undefined;
    }
  };
  const results = checkClaims(markers, claims, resolve);
  for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.id}: ${r.msg}`);
  const failing = results.filter((r) => !r.ok).length;
  console.log(`check-claims: ${results.length} claims, ${failing} failing`);
  process.exit(failing ? 1 : 0);
}
