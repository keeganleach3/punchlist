// Usage: node gate-count.mjs <CODE-LEARNINGS.md> <DESIGN-LEARNINGS.md>   (prints counts only)
import { readFileSync } from 'node:fs';

const hookRow = /^- \d{4}-\d{2}-\d{2} · (BLOCKED|override|advisory) · /;
const out = { blocked: 0, override: 0, advisory: 0, caught_by_entries: 0 };

for (const file of process.argv.slice(2)) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  const starts = lines.flatMap((l, i) => (/^(- |#{1,4} )/.test(l) ? [i] : []));
  starts.forEach((a, s) => {
    const text = lines.slice(a, starts[s + 1] ?? lines.length).join(' ');
    const m = lines[a].match(hookRow);
    if (m) out[m[1] === 'BLOCKED' ? 'blocked' : m[1]]++;
    if (/Caught by/i.test(text) && !text.includes('Caught by: <')) out.caught_by_entries++;
  });
}
console.log(JSON.stringify(out, null, 2));
