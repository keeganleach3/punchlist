import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, chromePath, keyHits, loadConfig, partition } from './lib.mjs';

test('loadConfig merges the project file over defaults and builds urls', () => {
  const cfg = loadConfig('/p', () => JSON.stringify({ base: 'http://localhost:3000', routes: ['/a'], hashRouting: true, checks: { focus: false } }), () => true);
  assert.equal(cfg.url('/a'), 'http://localhost:3000/#/a');
  assert.deepEqual(cfg.widths, DEFAULTS.widths);
  assert.equal(cfg.enabled('focus'), false);
  assert.equal(cfg.enabled('hscroll'), true);
});

test('scale-twin is opt-in; everything else opt-out', () => {
  const off = loadConfig('/p', () => '{}', () => false);
  assert.equal(off.enabled('scale-twin'), false);
  const onCfg = loadConfig('/p', () => JSON.stringify({ checks: { 'scale-twin': true } }), () => true);
  assert.equal(onCfg.enabled('scale-twin'), true);
});

test('no config file → defaults', () => {
  const cfg = loadConfig('/p', () => { throw new Error('should not read'); }, () => false);
  assert.equal(cfg.url('/'), 'http://localhost:5173/');
});

test('keyHits: substring, regex, linux-scoped', () => {
  assert.ok(keyHits('void-mid /about', 'void-mid /about @1920x1080 scrollY=2160 300px'));
  assert.ok(keyHits('/^bench .* 2[0-3]\\dpx/', 'bench / room5 only 219px tall'));
  assert.ok(!keyHits('/^bench/', 'clipped bench'));
  assert.ok(keyHits('linux:bench', 'bench x', 'linux'));
  assert.ok(!keyHits('linux:bench', 'bench x', 'win32'));
});

test('partition splits active from ignored', () => {
  const f = [{ id: 'aa /', msg: 'x 3:1' }, { id: 'tap /', msg: 'y' }];
  const { active, ignored } = partition(f, { 'aa / x': 'sanctioned' }, 'win32');
  assert.equal(active.length, 1);
  assert.equal(ignored, 1);
  assert.equal(active[0].id, 'tap /');
});

test('DEFAULTS carry no personal viewport', () => {
  assert.ok(!('ownerViewport' in DEFAULTS));
  assert.ok(!JSON.stringify(DEFAULTS).includes('2558'));
});

test('chromePath: env wins, then the per-OS list, then null (bundled)', () => {
  const yes = () => true;
  assert.equal(chromePath({ PW_CHROME: '/x/chrome' }, 'linux', yes), '/x/chrome');
  assert.equal(chromePath({ CHROME_PATH: '/y/chrome' }, 'linux', yes), '/y/chrome');
  assert.throws(() => chromePath({ PW_CHROME: '/nope' }, 'linux', () => false), /PW_CHROME/);
  assert.match(chromePath({}, 'darwin', yes), /Google Chrome\.app/);
  assert.match(chromePath({}, 'linux', (p) => p.endsWith('chromium')), /chromium$/);
  assert.match(chromePath({}, 'win32', yes), /chrome\.exe$/);
  assert.equal(chromePath({}, 'linux', () => false), null);
});
