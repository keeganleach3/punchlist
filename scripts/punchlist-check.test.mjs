import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkPunchlist } from './punchlist-check.mjs';

const list = (body) => `# Punchlist\n\n${body}`;

test('a fully checked ask with a Build line passes', () => {
  assert.deepEqual(checkPunchlist(list('## Ask 1 — a\n\nBuild: inline\n\n- [x] done\n')), { offenders: [], asks: 1 });
});

test('an unchecked box fails unless the same text is listed under Open at round end', () => {
  const body = '## Ask 1 — a\n\nBuild: inline\n\n- [ ] ship the thing\n- [ ] write the docs\n\n## Open at round end\n\n- Docs: write the docs, owner decides\n';
  const { offenders } = checkPunchlist(list(body));
  assert.equal(offenders.length, 1);
  assert.match(offenders[0], /Ask 1.*ship the thing/);
});

test('an Ask section with no line starting Build: fails', () => {
  const { offenders } = checkPunchlist(list('## Ask 2 — b\n\n- [x] done\n'));
  assert.equal(offenders.length, 1);
  assert.match(offenders[0], /Ask 2.*Build:/);
});

test('only Ask sections are checked; boxes elsewhere are ignored', () => {
  const body = '## Ledger\n\n- [ ] not an ask\n\n## Ask 1 — a\n\nBuild: x\n\n- [x] ok\n';
  assert.deepEqual(checkPunchlist(list(body)).offenders, []);
});

test('an unchecked box in a later ask is not excused by text under another ask', () => {
  const body = '## Ask 1 — a\n\nBuild: x\n\n- [ ] same words\n\n## Ask 2 — b\n\nBuild: y\n\n- [x] same words\n\n## Open at round end\n\n- nothing\n';
  assert.equal(checkPunchlist(list(body)).offenders.length, 1);
});

test('CLI: prints offenders and a summary; exit 1 on offenders, 0 clean, 2 without a path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pc-'));
  const file = join(dir, 'p.md');
  const script = fileURLToPath(new URL('./punchlist-check.mjs', import.meta.url));
  writeFileSync(file, list('## Ask 1 — a\n\n- [ ] open box\n'));
  const bad = spawnSync('node', [script, file], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout.trim().split('\n').length, 3); // no Build, open box, summary
  assert.match(bad.stdout, /punchlist-check: 2 offender/);
  writeFileSync(file, list('## Ask 1 — a\n\nBuild: x\n\n- [x] ok\n'));
  assert.equal(spawnSync('node', [script, file]).status, 0);
  assert.equal(spawnSync('node', [script]).status, 2);
});
