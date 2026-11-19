#!/usr/bin/env node
// check-evidence — committed evidence files must be what their generators print now.
//   node scripts/check-evidence.mjs <generators.json>
// The map is { "evidence/x.json": "evidence/x.mjs" }: each generator runs with node
// from the current directory (the repo root) and its stdout is compared with the
// committed file, line endings normalised. Exit 1 and the file named on any difference.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const lf = (t) => t.replace(/\r\n/g, '\n');
export const compareOutput = (committed, generated) => lf(committed) === lf(generated);

const isMain = process.argv[1] && basename(process.argv[1]) === 'check-evidence.mjs';
if (isMain) {
  const mapFile = process.argv[2];
  if (!mapFile) {
    console.error('usage: check-evidence.mjs <generators.json>');
    process.exit(2);
  }
  let map;
  try {
    map = JSON.parse(readFileSync(mapFile, 'utf8'));
  } catch (e) {
    console.error(`check-evidence: cannot read ${mapFile} (${e.code ?? e.message})`);
    process.exit(2);
  }
  let differ = 0;
  for (const [file, generator] of Object.entries(map)) {
    const r = spawnSync(process.execPath, [generator], { encoding: 'utf8' });
    let status;
    if (r.status !== 0) status = `FAIL ${file}: ${generator} exited ${r.status ?? r.signal}`;
    else {
      try {
        status = compareOutput(readFileSync(file, 'utf8'), r.stdout) ? `ok   ${file}` : `DIFF ${file}: differs from ${generator} output; regenerate and commit`;
      } catch {
        status = `DIFF ${file}: committed file is missing`;
      }
    }
    if (!status.startsWith('ok')) differ++;
    console.log(status);
  }
  console.log(`check-evidence: ${Object.keys(map).length} generator(s), ${differ} differ`);
  process.exit(differ ? 1 : 0);
}
