#!/usr/bin/env node
// misses — the only reader of misses.jsonl. Prints at most 25 lines; the cap is
// the point: the model reads this summary, never the file.
//   node scripts/misses.mjs <path/to/misses.jsonl> [--compact]
// --compact folds rows older than 90 days into monthly counts, rewriting the file.
// Every figure prints as k/N; a percentage only when N is at least 20.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

const MAX_LINES = 25;
const MAX_ITEMS = 8;
const MIN_N_FOR_PCT = 20;
const COMPACT_AFTER_DAYS = 90;

export function parseRows(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    try {
      const r = JSON.parse(line);
      if (r && typeof r === 'object' && !Array.isArray(r)) rows.push(r);
    } catch {
      /* blank or malformed */
    }
  }
  return rows;
}

const weight = (r) => (Number.isFinite(r.n) && r.n > 0 ? r.n : 1);
// round = this miss's number on its ask (1 = first); compacted rows carry a rework flag instead.
const hasRound = (r) => Number.isFinite(r.round) || typeof r.rework === 'boolean';
const isRework = (r) => r.rework === true || r.round > 1;

function tally(rows, key) {
  const t = new Map();
  for (const r of rows) t.set(key(r), (t.get(key(r)) ?? 0) + weight(r));
  return [...t].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const sum = (rows) => rows.reduce((n, r) => n + weight(r), 0);
const fig = (k, N) => `${k}/${N}${N >= MIN_N_FOR_PCT ? ` ${Math.round((100 * k) / N)}%` : ''}`;
const items = (pairs, N, max = MAX_ITEMS) =>
  pairs.slice(0, max).map(([name, k]) => `${name} ${fig(k, N)}`).join(' · ') + (pairs.length > max ? ` · +${pairs.length - max} more` : '');

export function aggregate(rows, label = 'misses') {
  const N = sum(rows);
  if (!N) return [`${label}: none recorded (N=0)`];
  const out = [`${label}: N=${N}`];
  out.push(`by cause: ${items(tally(rows, (r) => r.cause ?? 'unknown'), N)}`);
  out.push(`by rule: ${items(tally(rows, (r) => r.rule ?? 'none'), N)}`);

  const left = (n, what) => (n ? ` (${n} ${n === 1 ? 'row' : 'rows'} without ${what} left out)` : '');

  const withModel = rows.filter((r) => r.model);
  const models = tally(withModel, (r) => r.model);
  if (!withModel.length) out.push(`by cause × model: n/a (no model on ${N} rows)`);
  else {
    out.push(`by cause × model${left(N - sum(withModel), 'model')}:`);
    for (const [m, n] of models.slice(0, MAX_ITEMS)) {
      out.push(`  ${m} (N=${n}): ${items(tally(withModel.filter((r) => r.model === m), (r) => r.cause ?? 'unknown'), n, 5)}`);
    }
    if (models.length > MAX_ITEMS) out.push(`  +${models.length - MAX_ITEMS} more models`);
  }

  const withRound = rows.filter(hasRound);
  const K = sum(withRound);
  if (!K) {
    out.push(`first-pass: n/a (no round on ${N} rows)`);
    out.push(`rework: n/a (no round on ${N} rows)`);
  } else {
    const byModel = tally(withRound.filter((r) => r.model), (r) => r.model).map(([m, n]) => [m, sum(withRound.filter((r) => r.model === m && !isRework(r))), n]);
    const per = byModel.slice(0, MAX_ITEMS).map(([m, k, n]) => `${m} ${fig(k, n)}`).join(' · ');
    out.push(`first-pass: ${fig(sum(withRound.filter((r) => !isRework(r))), K)}${per ? ` · by model: ${per}` : ''}${left(N - K, 'round')}`);
    out.push(`rework: ${fig(sum(withRound.filter(isRework)), K)}`);
  }
  return out.slice(0, MAX_LINES);
}

/** Rows older than 90 days become one row per month and field combination, with a count `n`. */
export function compact(rows, now = Date.now()) {
  const cutoff = now - COMPACT_AFTER_DAYS * 86400_000;
  const keep = [];
  const groups = new Map();
  for (const r of rows) {
    const month = r.month ?? (typeof r.date === 'string' ? r.date.slice(0, 7) : null);
    const when = r.month ? Date.parse(`${r.month}-01`) : Date.parse(r.date);
    if (!month || !(when < cutoff)) {
      keep.push(r);
      continue;
    }
    const g = { month, cause: r.cause ?? 'unknown', rule: r.rule ?? 'none', caughtBy: r.caughtBy ?? 'unknown', changed: r.changed ?? 'none' };
    if (r.model) g.model = r.model;
    if (hasRound(r)) g.rework = isRework(r);
    const k = JSON.stringify(g);
    groups.set(k, { ...g, n: (groups.get(k)?.n ?? 0) + weight(r) });
  }
  return [...groups.values(), ...keep];
}

const isMain = process.argv[1] && basename(process.argv[1]) === 'misses.mjs';
if (isMain) {
  const [path, ...flags] = process.argv.slice(2);
  if (!path || path.startsWith('--')) {
    console.error('usage: misses.mjs <path/to/misses.jsonl> [--compact]');
    process.exit(2);
  }
  let rows;
  try {
    rows = parseRows(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`misses: cannot read ${path} (${e.code ?? e.message})`);
    process.exit(2);
  }
  if (flags.includes('--compact')) {
    const out = compact(rows);
    writeFileSync(path, out.map((r) => JSON.stringify(r)).join('\n') + (out.length ? '\n' : ''), 'utf8');
    console.log(`misses: compacted ${rows.length} rows to ${out.length}`);
  } else {
    console.log(aggregate(rows, basename(path)).join('\n'));
  }
}
