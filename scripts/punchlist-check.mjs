#!/usr/bin/env node
// punchlist-check — a punchlist may not close with work silently dropped.
//   node scripts/punchlist-check.mjs <punchlist.md>
// Fails when an `## Ask` section has an unchecked `- [ ]` box whose text is not
// listed under `## Open at round end`, or has no line starting `Build:`.
// Exit 1 on any offender.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const norm = (t) => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** Sections keyed by their `## ` heading. */
function sections(md) {
  const out = [];
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('## ')) out.push({ title: line.slice(3).trim(), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

export function checkPunchlist(md) {
  const all = sections(md);
  const open = norm(all.filter((s) => /^open at round end/i.test(s.title)).flatMap((s) => s.lines).join(' '));
  const offenders = [];
  const asks = all.filter((s) => /^ask\b/i.test(s.title));
  for (const s of asks) {
    const name = s.title.match(/^ask\s+\S+/i)?.[0] ?? s.title;
    if (!s.lines.some((l) => l.startsWith('Build:'))) offenders.push(`${name}: no line starting "Build:"`);
    for (const l of s.lines) {
      const box = l.match(/^\s*- \[ \]\s*(.+)$/);
      if (box && !open.includes(norm(box[1]))) offenders.push(`${name}: unchecked and not under "Open at round end": ${box[1].trim()}`);
    }
  }
  return { offenders, asks: asks.length };
}

const isMain = process.argv[1] && basename(process.argv[1]) === 'punchlist-check.mjs';
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: punchlist-check.mjs <punchlist.md>');
    process.exit(2);
  }
  let md;
  try {
    md = readFileSync(file, 'utf8');
  } catch (e) {
    console.error(`punchlist-check: cannot read ${file} (${e.code ?? e.message})`);
    process.exit(2);
  }
  const { offenders, asks } = checkPunchlist(md);
  for (const o of offenders) console.log(o);
  console.log(`punchlist-check: ${offenders.length} offender(s) in ${asks} ask section(s)`);
  process.exit(offenders.length ? 1 : 0);
}
