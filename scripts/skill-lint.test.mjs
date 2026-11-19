import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyOf, frontmatter, hasToc, lintDocs, lintEntry, lintSkill, LIMITS } from './skill-lint.mjs';

const fm = (desc) => `---\nname: x\ndescription: ${desc}\n---\n`;
const fs = (files) => ({
  read: (p) => {
    const key = Object.keys(files).find((k) => p.replaceAll('\\', '/').endsWith(k));
    if (key === undefined) throw new Error('ENOENT ' + p);
    return files[key];
  },
  list: (d) => {
    const dir = d.replaceAll('\\', '/');
    return Object.keys(files)
      .filter((k) => (dir.endsWith('references') ? k.startsWith('references/') : !k.includes('/')))
      .map((k) => k.replace('references/', ''));
  },
});
const fails = (files) => {
  const { read, list } = fs(files);
  return lintSkill('/skills/demo', read, list).filter((r) => r.level === 'FAIL').map((r) => r.msg);
};

test('frontmatter parses name and description', () => {
  const f = frontmatter(fm('Use when testing'));
  assert.equal(f.fields.name, 'x');
  assert.equal(f.fields.description, 'Use when testing');
});

test('hasToc requires anchor-link list near the top', () => {
  assert.ok(hasToc('# T\n\n- [A](#a)\n- [B](#b)\n'));
  assert.ok(!hasToc('# T\n\n- plain bullet\n'));
  assert.ok(!hasToc('# T\n' + '\n'.repeat(LIMITS.tocWithin + 1) + '- [A](#a)\n'));
});

test('clean skill passes', () => {
  assert.deepEqual(fails({ 'SKILL.md': fm('Use when x') + 'See [references/a.md](references/a.md)\n', 'references/a.md': '# a\n' }), []);
});

test('SKILL.md over the line cap fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when x') + 'x\n'.repeat(LIMITS.skillLines + 1) });
  assert.ok(r.some((m) => /lines \(max/.test(m)));
});

test('long reference without TOC fails; with TOC passes', () => {
  const long = '# a\n' + 'line\n'.repeat(LIMITS.tocAbove + 5);
  const skill = fm('Use when x') + '[a](references/a.md)\n';
  assert.ok(fails({ 'SKILL.md': skill, 'references/a.md': long }).some((m) => /no table of contents/.test(m)));
  assert.deepEqual(fails({ 'SKILL.md': skill, 'references/a.md': '# a\n- [s](#s)\n' + long }), []);
});

test('reference not linked from SKILL.md fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when x') + 'body\n', 'references/a.md': '# a\n' });
  assert.ok(r.some((m) => /not linked from SKILL.md/.test(m)));
});

test('stray root file fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when x'), '=24': '' });
  assert.ok(r.some((m) => /stray file.*=24/.test(m)));
});

test('stale reference count fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when x') + 'Eight references, loaded on demand.\n' });
  assert.ok(r.some((m) => /count/.test(m)));
});

test('localhost port in prose fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when x') + 'open http://localhost:5173\n' });
  assert.ok(r.some((m) => /environment constant/.test(m)));
});

test('over-long description fails', () => {
  const r = fails({ 'SKILL.md': fm('Use when ' + 'x'.repeat(LIMITS.descriptionChars)) });
  assert.ok(r.some((m) => /description is/.test(m)));
});

test('entry file over the char cap fails; under it passes', () => {
  const big = lintEntry('/home/CLAUDE.md', () => 'x'.repeat(LIMITS.entryChars + 1));
  assert.ok(big.some((r) => r.level === 'FAIL' && /chars \(max/.test(r.msg)));
  assert.ok(!lintEntry('/home/CLAUDE.md', () => 'routes only').some((r) => r.level === 'FAIL'));
});

const link = '[a](references/a.md)\n';

test('bodyOf starts exactly after the closing fence', () => {
  assert.equal(bodyOf('---\nname: x\ndescription: Use when x\n---\nEight references here.\n'), '\nEight references here.\n');
  assert.equal(bodyOf('no frontmatter'), 'no frontmatter');
});

test('CRLF files lint the same as LF', () => {
  const crlf = (t) => t.replaceAll('\n', '\r\n');
  assert.deepEqual(fails({ 'SKILL.md': crlf(fm('Use when x') + link), 'references/a.md': crlf('# a\n') }), []);
  const r = fails({ 'SKILL.md': crlf(fm('Use when x') + link + 'open http://localhost:5173\n'), 'references/a.md': '# a\n' });
  assert.ok(r.some((m) => /environment constant/.test(m)));
});

test('reference check needs a resolving link, not a mention', () => {
  const ref = { 'references/a.md': '# a\n' };
  assert.ok(fails({ 'SKILL.md': fm('Use when x') + 'we do not use references/a.md anywhere\n', ...ref }).some((m) => /not linked/.test(m)));
  assert.ok(fails({ 'SKILL.md': fm('Use when x') + '[a](references/other.md)\n', ...ref }).some((m) => /not linked/.test(m)));
  assert.deepEqual(fails({ 'SKILL.md': fm('Use when x') + '[a](./references/a.md#top)\n', ...ref }), []);
});

test('a ${CLAUDE_PLUGIN_ROOT}/ link resolves against the repo root', () => {
  const { read, list } = fs({ 'SKILL.md': fm('Use when x') + '[a](${CLAUDE_PLUGIN_ROOT}/skills/demo/references/a.md)\n', 'references/a.md': '# a\n' });
  const out = lintSkill('/repo/skills/demo', read, list, { root: '/repo' }).filter((r) => r.level === 'FAIL');
  assert.deepEqual(out, []);
  const wrong = lintSkill('/repo/skills/demo', read, list, { root: '/elsewhere' }).filter((r) => r.level === 'FAIL');
  assert.ok(wrong.some((r) => /not linked/.test(r.msg)));
});

test('token caps: SKILL.md 1200 and each reference 2800 by default; both configurable', () => {
  const words = (n) => 'word '.repeat(n) + '\n';
  const skill = (n) => fm('Use when x') + link + words(n);
  assert.deepEqual(fails({ 'SKILL.md': skill(800), 'references/a.md': '# a\n' }), []); // ~1065 tokens
  assert.ok(fails({ 'SKILL.md': skill(1000), 'references/a.md': '# a\n' }).some((m) => /SKILL.md.*tokens \(max 1200\)/.test(m)));
  assert.ok(fails({ 'SKILL.md': skill(1), 'references/a.md': words(2200) }).some((m) => /references\/a.md.*tokens \(max 2800\)/.test(m)));
  const { read, list } = fs({ 'SKILL.md': skill(1000), 'references/a.md': words(2200) });
  const cfg = lintSkill('/skills/demo', read, list, { skillTokens: 2000, refTokens: 4000 }).filter((r) => r.level === 'FAIL');
  assert.deepEqual(cfg, []);
});

test('lintDocs lints a folder without SKILL.md: tokens, TOC, environment constants, nested files', () => {
  const files = { 'architect.md': '# a\n', 'big.md': 'word '.repeat(2200), 'env.md': 'http://localhost:3000\n', 'templates/p.md': 'x '.repeat(3000) };
  const norm = (p) => p.replaceAll('\\', '/');
  const lsDocs = (d) => (norm(d).endsWith('templates') ? ['p.md'] : Object.keys(files).filter((k) => !k.includes('/')).concat('templates'));
  const rd = (p) => files[norm(p).split('/shared/')[1]];
  const out = lintDocs('/repo/shared', rd, lsDocs).filter((r) => r.level === 'FAIL').map((r) => r.msg);
  assert.ok(out.some((m) => /big.md.*tokens/.test(m)));
  assert.ok(out.some((m) => /env.md.*environment constant/.test(m)));
  assert.ok(out.some((m) => /templates\/p.md.*tokens/.test(m)));
  assert.ok(!out.some((m) => /architect.md/.test(m)));
});
