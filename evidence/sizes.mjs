#!/usr/bin/env node
// sizes — what each layer of the plugin costs to load, in estimated tokens.
// Same estimate skill-lint uses (words × 1.33), so the README table and the
// lint caps agree. Usage, from the repo root: node evidence/sizes.mjs > evidence/sizes.json
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const tokens = (text) => Math.round(text.split(/\s+/).filter(Boolean).length * 1.33);
const read = (p) => readFileSync(p, 'utf8');
const mdIn = (dir) => readdirSync(dir).filter((f) => f.endsWith('.md')).sort();

const out = { method: 'words x 1.33, rounded; the estimate scripts/skill-lint.mjs uses', skills: {}, shared: {} };

for (const skill of readdirSync('skills').sort()) {
  const md = read(join('skills', skill, 'SKILL.md'));
  const description = md.match(/^description:\s*(.*)$/m)?.[1] ?? '';
  const refs = mdIn(join('skills', skill, 'references')).map((f) => tokens(read(join('skills', skill, 'references', f))));
  out.skills[skill] = {
    description_tokens: tokens(description),
    skill_md_tokens: tokens(md),
    references: refs.length,
    reference_tokens_min: Math.min(...refs),
    reference_tokens_max: Math.max(...refs),
    reference_tokens_total: refs.reduce((a, b) => a + b, 0),
  };
}

const shared = mdIn('shared').map((f) => [f, tokens(read(join('shared', f)))]);
out.shared = { files: shared.length, tokens_min: Math.min(...shared.map(([, n]) => n)), tokens_max: Math.max(...shared.map(([, n]) => n)) };

const s = Object.values(out.skills);
const agentFiles = mdIn('agents');
const agentDescriptions = agentFiles.map((f) => tokens(read(join('agents', f)).match(/^description:\s*(.*)$/m)?.[1] ?? ''));
const skillDescriptions = s.reduce((a, x) => a + x.description_tokens, 0);
// On-demand files: every reference, and every shared file except architect.md (that one loads every round).
const sharedOnDemand = shared.filter(([f]) => f !== 'architect.md').map(([, n]) => n);
const loadable = [...s.flatMap((x) => [x.reference_tokens_min, x.reference_tokens_max]), ...sharedOnDemand];
// The routing rule the SessionStart hook injects into every session.
const { TEXT: sessionStartText } = await import(pathToFileURL(resolve('hooks', 'session-start.mjs')).href);
const sessionStart = tokens(sessionStartText);
out.totals = {
  skill_description_tokens: skillDescriptions,
  agent_description_tokens: agentDescriptions.reduce((a, b) => a + b, 0),
  session_start_tokens: sessionStart,
  // In context in every session: both skill descriptions, all worker descriptions, and the routing rule.
  always_on_tokens: skillDescriptions + agentDescriptions.reduce((a, b) => a + b, 0) + sessionStart,
  skill_md_tokens_max: Math.max(...s.map((x) => x.skill_md_tokens)),
  // shared/architect.md is the one file loaded on every round of work.
  every_round_tokens: tokens(read(join('shared', 'architect.md'))),
  on_demand_tokens_min: Math.min(...loadable),
  on_demand_tokens_max: Math.max(...loadable),
  everything_tokens: s.reduce((a, x) => a + x.skill_md_tokens + x.reference_tokens_total, 0) + shared.reduce((a, [, n]) => a + n, 0),
  agents: agentFiles.length,
};

console.log(JSON.stringify(out, null, 2));
