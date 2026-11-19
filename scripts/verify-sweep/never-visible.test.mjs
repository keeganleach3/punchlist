import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, ALL_CHECKS } from './lib.mjs';
import { neverVisible, neverVisibleFindings } from './never-visible.mjs';

const row = (extra = {}) => ({ label: 'p.lede', text: 'Hello', height: 20, opacity: 1, visibility: 'visible', ...extra });

test('neverVisibleFindings: opacity 0 or hidden after scroll fails; visible, flat, and partly faded pass', () => {
  assert.equal(neverVisibleFindings([row({ opacity: 0 })]).length, 1);
  assert.equal(neverVisibleFindings([row({ visibility: 'hidden' })]).length, 1);
  assert.deepEqual(neverVisibleFindings([row(), row({ opacity: 0.4 }), row({ opacity: 0, height: 0 }), row({ opacity: 0, text: '  ' })]), []);
});

test('neverVisibleFindings: names the text and cause; dedupes; caps at 8', () => {
  const [m] = neverVisibleFindings([row({ opacity: 0, text: 'Reveal me' }), row({ opacity: 0, text: 'Reveal me' })]);
  assert.match(m, /"Reveal me"/);
  assert.match(m, /opacity 0/);
  const many = Array.from({ length: 20 }, (_, i) => row({ opacity: 0, text: 't' + i }));
  assert.equal(neverVisibleFindings(many).length, 8);
});

test('never-visible is a listed check and on by default', () => {
  assert.ok(ALL_CHECKS.includes('never-visible'));
  assert.equal(loadConfig('/p', () => '{}', () => false).enabled('never-visible'), true);
  assert.equal(loadConfig('/p', () => JSON.stringify({ checks: { 'never-visible': false } }), () => true).enabled('never-visible'), false);
});

test('the in-page probe references nothing from module scope', () => {
  assert.ok(!/Findings\s*\(/.test(String(neverVisible)));
});
