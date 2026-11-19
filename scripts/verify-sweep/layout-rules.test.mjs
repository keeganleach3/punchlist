import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from './lib.mjs';
import * as P from './layout-rules.mjs';
import { ctaIntentFindings, ctaWordsFindings, copyLengthFindings, eyebrowsFindings, grainLayerFindings, radiusScaleFindings } from './layout-rules.mjs';

test('eyebrowsFindings: over the 1-per-ratio-sections cap fails, at the cap passes', () => {
  assert.equal(eyebrowsFindings(4, 9, 3).length, 1); // max ceil(9/3)=3, count 4
  assert.equal(eyebrowsFindings(3, 9, 3).length, 0);
});

test('ctaWordsFindings: long or wrapped labels fail, short unwrapped pass', () => {
  assert.equal(ctaWordsFindings([{ label: 'Get Started Today Now', wrapped: false, styled: true }], 3).length, 1);
  assert.equal(ctaWordsFindings([{ label: 'Get Started', wrapped: false, styled: true }], 3).length, 0);
});

test('ctaIntentFindings: one destination with 2 labels fails, one label passes', () => {
  assert.equal(ctaIntentFindings([{ dest: '/contact', label: 'Contact' }, { dest: '/contact', label: 'Get in touch' }]).length, 1);
  assert.equal(ctaIntentFindings([{ dest: '/contact', label: 'Contact' }, { dest: '/contact', label: 'Contact' }]).length, 0);
});

test('radiusScaleFindings: more than max distinct radii fails, at max passes', () => {
  assert.equal(radiusScaleFindings([4, 8, 12, 16, 20], 4).length, 1);
  assert.equal(radiusScaleFindings([4, 8, 12, 16], 4).length, 0);
});

test('copyLengthFindings: over-length heading warns (prefixed), under-length passes', () => {
  const long = 'one two three four five six seven eight nine';
  const out = copyLengthFindings({ heading: long, para: '', headingMax: 8, paraMax: 25 });
  assert.equal(out.length, 1);
  assert.ok(out[0].startsWith('warn:'));
  assert.equal(copyLengthFindings({ heading: 'Short heading here', para: '', headingMax: 8, paraMax: 25 }).length, 0);
});

test('grainLayerFindings: grain layer not fixed+inert fails, fixed+inert passes', () => {
  assert.equal(grainLayerFindings({ isGrainy: true, position: 'absolute', pointerEvents: 'auto', label: 'div.grain' }).length, 1);
  assert.equal(grainLayerFindings({ isGrainy: true, position: 'fixed', pointerEvents: 'none', label: 'div.grain' }).length, 0);
});

test('the six layout checks are opt-in like scale-twin: default off, on only when explicitly true', () => {
  const ids = ['eyebrows', 'cta-words', 'cta-intent', 'radius-scale', 'copy-length', 'grain-layer'];
  const off = loadConfig('/p', () => '{}', () => false);
  for (const id of ids) assert.equal(off.enabled(id), false);
  const on = loadConfig('/p', () => JSON.stringify({ checks: Object.fromEntries(ids.map((id) => [id, true])) }), () => true);
  for (const id of ids) assert.equal(on.enabled(id), true);
});

// 2026-09-21, caught by the architect on a live page: every probe called its
// *Findings helper INSIDE page.evaluate, where module scope does not exist —
// all six threw ReferenceError while every unit test passed. Probes return
// data; decisions run in Node. This guard keeps it that way.
test('in-page probes reference nothing from module scope', () => {
  for (const fn of [P.eyebrows, P.ctaWords, P.ctaIntent, P.radiusScale, P.copyLength, P.grainLayer]) {
    assert.ok(!/Findings\s*\(|findingsFor\s*\(/.test(String(fn)), `${fn.name} calls a Node-side helper inside the page`);
  }
});

test('findingsFor routes raw probe data to the right decision', () => {
  const cfg = { eyebrowRatio: 3, ctaWordsMax: 3, radiusMax: 4, copyHeadingMax: 8, copyParaMax: 25 };
  assert.equal(P.findingsFor('eyebrows', { count: 3, sections: 3 }, cfg).length, 1);
  assert.equal(P.findingsFor('cta-words', [{ label: 'one two three four', wrapped: false, styled: true }], cfg).length, 1);
  assert.equal(P.findingsFor('cta-intent', [{ dest: '/c', label: 'A' }, { dest: '/c', label: 'B' }], cfg).length, 1);
  assert.equal(P.findingsFor('radius-scale', [2, 4, 6, 8, 10], cfg).length, 1);
  assert.match(P.findingsFor('copy-length', [{ heading: 'a b c d e f g h i', para: 'x' }], cfg)[0], /^warn:/);
  assert.equal(P.findingsFor('grain-layer', [{ position: 'absolute', pointerEvents: 'auto', label: 'div.g' }], cfg).length, 1);
  assert.deepEqual(P.findingsFor('grain-layer', [{ position: 'fixed', pointerEvents: 'none', label: 'div.g' }], cfg), []);
});

// 2026-09-21, first real run (9 routes): 48 cta-words and 21
// cta-intent findings, nearly all false — whole "NEXT page" cards read as
// buttons, the ↗ glyph counted as a word, a fixed-height flex button read as
// wrapped. These pin the decisions; the DOM side is proven by the live run.
test('ctaWordsFindings: glyph tokens are not words; only button-styled items count', () => {
  const item = (label, extra = {}) => ({ label, wrapped: false, styled: true, ...extra });
  assert.deepEqual(P.ctaWordsFindings([item('SEE IT LIVE ↗'), item('Send an email →')], 3), []);
  assert.equal(P.ctaWordsFindings([item('READ THE FULL WORKFLOW ↗')], 3).length, 1);
  assert.deepEqual(P.ctaWordsFindings([item('a plain text link with many words', { styled: false })], 3), []);
  assert.equal(P.ctaWordsFindings([item('Go', { wrapped: true })], 3).length, 1);
});

test('ctaIntentFindings: labels compare normalised; genuinely different wording still fails', () => {
  assert.deepEqual(P.ctaIntentFindings([{ dest: '/work', label: 'Work' }, { dest: '/work', label: 'WORK ↗' }]), []);
  assert.equal(P.ctaIntentFindings([{ dest: 'mailto:x', label: 'Email' }, { dest: 'mailto:x', label: 'Send an email ↗' }]).length, 1);
});
