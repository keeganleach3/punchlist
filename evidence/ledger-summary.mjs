// Usage: node ledger-summary.mjs <ledger-folder>   (reads *-ledger.jsonl, prints JSON)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node ledger-summary.mjs <ledger-folder>'); process.exit(2); }

const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
const pct = (xs, p) => xs[Math.max(0, Math.ceil((p / 100) * xs.length) - 1)] ?? null; // nearest rank

const files = readdirSync(dir).filter((f) => f.endsWith('-ledger.jsonl')).sort();
const byModel = {}, opusByMonth = {}, tokens = [];
let rows = 0, unparsable = 0, missingTokens = 0;

for (const f of files) {
  for (const line of readFileSync(join(dir, f), 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let r;
    try { r = JSON.parse(line); } catch { unparsable++; continue; }
    if (r === null || typeof r !== 'object' || Array.isArray(r)) { unparsable++; continue; }
    rows++;
    const model = typeof r.model === 'string' ? r.model : '(none)';
    byModel[model] = (byModel[model] || 0) + 1;
    if (typeof r.actualTokens === 'number') tokens.push(r.actualTokens); else missingTokens++;
    if (model === 'opus') {
      const month = typeof r.ts === 'string' && /^\d{4}-\d{2}/.test(r.ts) ? r.ts.slice(0, 7) : 'unknown';
      const m = (opusByMonth[month] ||= { with_reason: 0, without_reason: 0 });
      if (typeof r.complexReason === 'string' && r.complexReason.trim()) m.with_reason++; else m.without_reason++;
    }
  }
}
tokens.sort((a, b) => a - b);
const opus = Object.values(opusByMonth);
console.log(JSON.stringify({
  files: files.length,
  rows,
  rows_unparsable: unparsable,
  rows_by_model: sorted(byModel),
  opus_rows: {
    with_reason: opus.reduce((s, m) => s + m.with_reason, 0),
    without_reason: opus.reduce((s, m) => s + m.without_reason, 0),
    by_month: sorted(opusByMonth),
  },
  rows_missing_actualTokens: missingTokens,
  actualTokens: { n: tokens.length, p50: pct(tokens, 50), p90: pct(tokens, 90) },
}, null, 2));
