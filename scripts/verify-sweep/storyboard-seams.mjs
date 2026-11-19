#!/usr/bin/env node
// storyboard-seams: flags "zoom in, then cut away" in a film STORYBOARD.md shot table (film rules, product.md).
// A row whose exit (last) column pushes or zooms, followed by a row that enters on a plain cut, fails.
// An early push that lands and holds is fine, so only the exit column is read.
//   node storyboard-seams.mjs STORYBOARD.md   → exit 1 on any finding
import { readFileSync } from 'node:fs';

const rows = readFileSync(process.argv[2] || 'STORYBOARD.md', 'utf8').split('\n')
  .filter((l) => /^\|\s*[a-z]?\d+/i.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const zoomOut = (r) => /\b(push(es|ing)?|zoom(s|ing)?|fills? (the )?frame|dive)\b/i.test(r.at(-1));
const matchIn = (r) => /match|continuous|exact|same/i.test(r.join(' '));
const bad = [];
rows.forEach((r, i) => {
  const n = rows[i + 1];
  if (n && zoomOut(r) && !matchIn(n) && !/match/i.test(r.at(-1))) bad.push(`${r[0]} → ${n[0]}: exits on a push/zoom into a plain cut`);
});
for (const b of bad) console.log('FAIL  ' + b);
console.log(`storyboard-seams: ${bad.length} finding(s) across ${rows.length} shots`);
process.exit(bad.length ? 1 : 0);
