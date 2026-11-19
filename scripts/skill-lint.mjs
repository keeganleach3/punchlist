#!/usr/bin/env node
// skill-lint — the mechanical floor for skill files (2026-09-10 audit).
// Checks a skill directory against the authoring bars that were previously
// prose only: SKILL.md length, frontmatter shape, TOCs on long references,
// references reachable from SKILL.md, no stray files, no stale counts, no
// environment constants in prose. Usage:
//   node scripts/skill-lint.mjs [--skill-tokens N] [--ref-tokens N] <skill-dir | docs-dir | entry.md> [...]
// A directory with a SKILL.md is a skill; one without is a folder of docs (shared/):
// every .md in it gets the reference checks. A path ending in .md is an
// always-loaded entry file (CLAUDE.md): size cap only.
// Exit 1 on any FAIL. WARN lines never fail the run.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export const LIMITS = {
  skillLines: 200,
  tocAbove: 100,
  descriptionChars: 500,
  frontmatterChars: 1024,
  tocWithin: 25,
  skillTokens: 1200, // SKILL.md loads on every trigger
  refTokens: 2800, // each reference, loaded on demand
  // Always-loaded entry file: it routes, it does not hold catalogs (2026-09-21;
  // 23k -> 17.8k chars after the skills inventory moved out). Ratchet, not a target.
  entryChars: 20000,
};

const ROOT_ALLOW = new Set([
  'SKILL.md', 'README.md', 'package.json', 'package-lock.json', '.gitignore', '.git',
  'references', 'scripts', 'hooks', 'templates', 'node_modules',
]);
const COUNT_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\s+(references|commands)\b/i;
// Ports are per-project (Vite 5173, Next 3000); viewports are design standards and stay.
const ENV_RE = /localhost:\d+/;

const lf = (t) => t.replace(/\r\n/g, '\n');
const tokens = (t) => Math.round(t.split(/\s+/).filter(Boolean).length * 1.33);

export function frontmatter(md) {
  const m = lf(md).match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { raw: m[1], fields, end: m[0].length };
}

/** Everything after the closing fence (the whole text when there is no frontmatter). */
export function bodyOf(md) {
  const t = lf(md);
  const fm = frontmatter(t);
  return fm ? t.slice(fm.end) : t;
}

/** A TOC is a list of in-page anchor links inside the first `within` lines. */
export function hasToc(md, within = LIMITS.tocWithin) {
  return md.split('\n').slice(0, within).some((l) => /^\s*[-*]\s+\[.+\]\(#.+\)/.test(l));
}

const PLUGIN_ROOT = '${CLAUDE_PLUGIN_ROOT}/';

/** A reference passes only if SKILL.md has a markdown link whose target resolves to it; the plugin-root variable resolves against root. */
function linked(skill, dir, file, root) {
  const target = resolve(dir, 'references', file);
  return [...skill.matchAll(/\]\(([^)\s]+)\)/g)].some(([, href]) => {
    const p = href.split('#')[0];
    return (p.startsWith(PLUGIN_ROOT) ? resolve(root, p.slice(PLUGIN_ROOT.length)) : resolve(dir, p)) === target;
  });
}

export function lintSkill(dir, read = (p) => readFileSync(p, 'utf8'), list = readdirSync, opts = {}) {
  const { root = process.cwd(), skillTokens = LIMITS.skillTokens, refTokens = LIMITS.refTokens } = opts;
  const out = [];
  const fail = (msg) => out.push({ level: 'FAIL', msg });
  const warn = (msg) => out.push({ level: 'WARN', msg });
  const name = basename(dir);

  for (const f of list(dir)) {
    if (!ROOT_ALLOW.has(f)) fail(`${name}: stray file at skill root: ${f}`);
  }

  let skill;
  try {
    skill = lf(read(join(dir, 'SKILL.md')));
  } catch {
    fail(`${name}: SKILL.md missing`);
    return out;
  }
  const lines = skill.split('\n');
  if (lines.length > LIMITS.skillLines) fail(`${name}: SKILL.md is ${lines.length} lines (max ${LIMITS.skillLines})`);
  const words = skill.split(/\s+/).filter(Boolean).length;
  const skillTok = tokens(skill);
  out.push({ level: 'INFO', msg: `${name}: SKILL.md ${lines.length} lines, ${words} words, ~${skillTok} tokens` });
  if (skillTok > skillTokens) fail(`${name}: SKILL.md is ~${skillTok} tokens (max ${skillTokens})`);

  const fm = frontmatter(skill);
  if (!fm) fail(`${name}: SKILL.md has no YAML frontmatter`);
  else {
    if (!fm.fields.name) fail(`${name}: frontmatter missing name`);
    const d = fm.fields.description ?? '';
    if (!d) fail(`${name}: frontmatter missing description`);
    if (d.length > LIMITS.descriptionChars) fail(`${name}: description is ${d.length} chars (max ${LIMITS.descriptionChars})`);
    if (d && !/^Use when\b/.test(d)) warn(`${name}: description should start with "Use when"`);
    if (fm.raw.length > LIMITS.frontmatterChars) fail(`${name}: frontmatter is ${fm.raw.length} chars (max ${LIMITS.frontmatterChars})`);
  }

  const body = bodyOf(skill);
  const stale = body.match(COUNT_RE);
  if (stale) fail(`${name}: SKILL.md states a count ("${stale[0]}") that goes stale — describe, don't count`);

  const refDir = join(dir, 'references');
  let refs = [];
  try {
    refs = list(refDir).filter((f) => f.endsWith('.md'));
  } catch {
    /* no references dir */
  }
  for (const f of refs) {
    const md = lf(read(join(refDir, f)));
    const tok = tokens(md);
    if (tok > refTokens) fail(`${name}: references/${f} is ~${tok} tokens (max ${refTokens})`);
    const n = md.split('\n').length;
    if (n > LIMITS.tocAbove && !hasToc(md)) fail(`${name}: references/${f} is ${n} lines with no table of contents`);
    if (!linked(skill, dir, f, root)) fail(`${name}: references/${f} is not linked from SKILL.md with a resolving markdown link (references must be one level deep)`);
    const env = md.match(ENV_RE);
    if (env) fail(`${name}: references/${f} carries an environment constant in prose ("${env[0]}") — move it to config`);
  }
  const envSkill = body.match(ENV_RE);
  if (envSkill) fail(`${name}: SKILL.md carries an environment constant in prose ("${envSkill[0]}") — move it to config`);

  return out;
}

/** A folder of docs with no SKILL.md (shared/): each .md gets the reference checks. */
export function lintDocs(dir, read = (p) => readFileSync(p, 'utf8'), list = readdirSync, opts = {}) {
  const { refTokens = LIMITS.refTokens } = opts;
  const out = [];
  const fail = (msg) => out.push({ level: 'FAIL', msg });
  const name = basename(dir);
  const walk = (d, rel) => {
    for (const f of list(d)) {
      const path = rel ? `${rel}/${f}` : f;
      if (f.endsWith('.md')) {
        const md = lf(read(join(d, f)));
        const n = md.split('\n').length;
        const tok = tokens(md);
        if (tok > refTokens) fail(`${name}: ${path} is ~${tok} tokens (max ${refTokens})`);
        if (n > LIMITS.tocAbove && !hasToc(md)) fail(`${name}: ${path} is ${n} lines with no table of contents`);
        const env = md.match(ENV_RE);
        if (env) fail(`${name}: ${path} carries an environment constant in prose ("${env[0]}") — move it to config`);
      } else if (!f.includes('.')) {
        walk(join(d, f), path);
      }
    }
  };
  walk(dir, '');
  return out;
}

export function lintEntry(file, read = (p) => readFileSync(p, 'utf8')) {
  const n = read(file).length;
  const name = basename(file);
  return n > LIMITS.entryChars
    ? [{ level: 'FAIL', msg: `${name}: ${n} chars (max ${LIMITS.entryChars}) — move catalog content to a file it points at` }]
    : [{ level: 'INFO', msg: `${name}: ${n} chars, ~${Math.round(n / 4)} tokens always-on` }];
}

const isMain = process.argv[1] && statSync(process.argv[1]).isFile() && basename(process.argv[1]) === 'skill-lint.mjs';
if (isMain) {
  const dirs = [];
  const opts = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = { '--skill-tokens': 'skillTokens', '--ref-tokens': 'refTokens' }[argv[i]];
    if (!key) dirs.push(argv[i]);
    else if (Number(argv[i + 1]) > 0) opts[key] = Number(argv[++i]);
    else {
      console.error(argv[i] + ' needs a positive number');
      process.exit(2);
    }
  }
  if (!dirs.length) {
    console.error('usage: skill-lint.mjs [--skill-tokens N] [--ref-tokens N] <skill-dir | docs-dir | entry.md> [...]');
    process.exit(2);
  }
  let fails = 0;
  for (const d of dirs) {
    const results = d.endsWith('.md')
      ? lintEntry(d)
      : existsSync(join(d, 'SKILL.md')) ? lintSkill(d, undefined, undefined, opts) : lintDocs(d, undefined, undefined, opts);
    for (const { level, msg } of results) {
      console.log(level + ' ' + msg);
      if (level === 'FAIL') fails++;
    }
  }
  console.log('\nskill-lint: ' + fails + ' failing across ' + dirs.length + ' target(s)');
  process.exit(fails ? 1 : 0);
}
