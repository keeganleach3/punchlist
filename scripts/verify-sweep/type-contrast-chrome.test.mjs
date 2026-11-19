import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradientColorAt as g } from './type-contrast-chrome.mjs';

const near = (got, want) => assert.deepEqual(got.slice(0, 3).map(Math.round), want);

test('gradientColorAt: default 180deg with px stops samples by y (the Ask wash)', () => {
  const img = 'linear-gradient(rgb(201, 220, 247) 0px, rgb(220, 232, 250) 130px, rgb(255, 255, 255) 360px)';
  near(g(img, 800, 600, 400, 0), [201, 220, 247]);
  near(g(img, 800, 600, 400, 130), [220, 232, 250]);
  near(g(img, 800, 600, 10, 500), [255, 255, 255]);
});

test('gradientColorAt: angle and "to" keywords follow the gradient line', () => {
  const img = 'linear-gradient(to right, rgb(0, 0, 0), rgb(200, 200, 200))';
  near(g(img, 400, 100, 200, 50), [100, 100, 100]);
  near(g('linear-gradient(90deg, rgb(0, 0, 0) 0%, rgb(200, 200, 200) 100%)', 400, 100, 0, 99), [0, 0, 0]);
  near(g('linear-gradient(165deg, rgb(201, 220, 247) 0%, rgb(237, 243, 253) 100%)', 400, 300, 400, 300), [237, 243, 253]);
});

test('gradientColorAt: stops without positions spread evenly; alpha is kept', () => {
  near(g('linear-gradient(90deg, rgb(0, 0, 0), rgb(100, 100, 100), rgb(200, 200, 200))', 400, 10, 200, 5), [100, 100, 100]);
  assert.equal(g('linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5))', 10, 10, 5, 5)[3], 0.5);
});

test('gradientColorAt: textures and non-linear gradients return null', () => {
  assert.equal(g('repeating-linear-gradient(-45deg, rgb(0, 0, 0) 0px 1.5px, rgba(0, 0, 0, 0) 1.5px 5px)', 10, 10, 5, 5), null);
  assert.equal(g('radial-gradient(rgb(0, 0, 0), rgb(255, 255, 255))', 10, 10, 5, 5), null);
  assert.equal(g('none', 10, 10, 5, 5), null);
});

// aa must read text that sits beside child elements ("Hello <b>x</b> world"), not only leaf elements.
import { textHosts, aaContrast } from './type-contrast-chrome.mjs';
const T = (text) => ({ nodeType: 3, textContent: text });
const E = (tagName, ...childNodes) => ({ nodeType: 1, tagName, childNodes });

test('textHosts: leaf, mixed, and wrapper elements', () => {
  const b = E('B', T('bold'));
  const p = E('P', T('Hello '), b, T(' world'));
  const wrapper = E('DIV', p, E('SPAN', T('   ')));
  const empty = E('DIV', E('IMG'));
  const hosts = textHosts(E('BODY', wrapper, empty));
  assert.deepEqual(hosts.map((h) => h.tagName), ['P', 'B']); // mixed P is read; wrapper, whitespace-only span and empty div are not
});

test('aaContrast takes the node walk as its second argument and never references module scope', () => {
  assert.match(String(aaContrast), /hostsOf/);
  assert.ok(!/textHosts/.test(String(aaContrast)));
});
