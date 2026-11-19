// In-page probes, part 3: the six opt-in layout.md checks (2026-09-21
// punchlist — rules 1-6, previously prose-only, marked [check]). Same
// contract as type-contrast-chrome.mjs/clip-tap-void.mjs — one argument in, JSON-serialisable
// result out. A probe runs INSIDE the page (page.evaluate serialises the
// function alone), so it may reference nothing from this module: it returns
// raw data, and `findingsFor` turns that into findings in Node, where the
// pure `*Findings` helpers live and are unit-tested (layout-rules.test.mjs).

/** Small uppercase tracked labels that introduce a heading: at most 1 per `ratio` sections. */
export function eyebrows() {
  // The hero counts (layout.md) even when it is a <header data-page-head>, as typeCensus already assumes.
  const sel = 'section, [data-page-head]';
  const sections = [...document.querySelectorAll(sel)].filter((s) => !s.parentElement.closest(sel));
  let count = 0;
  for (const s of sections) {
    for (const el of s.querySelectorAll('*')) {
      if (el.children.length || !el.textContent.trim() || el.closest(sel) !== s) continue;
      const cs = getComputedStyle(el);
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
      if (!(parseFloat(cs.fontSize) <= 14 && cs.textTransform === 'uppercase' && ls > 0)) continue;
      // "Introduces a heading" = the next thing in reading order is one, even a wrapper deep on
      // either side (some labels sit one div in; the strict sibling test saw none of 7).
      let n = el;
      while (n && n !== s && !n.nextElementSibling) n = n.parentElement;
      const next = n && n !== s ? n.nextElementSibling : null;
      const h = next && (/^H[1-6]$/.test(next.tagName) ? next : next.querySelector('h1,h2,h3,h4,h5,h6'));
      if (h && next.textContent.trim().startsWith(h.textContent.trim())) count++;
    }
  }
  return { count, sections: sections.length };
}

export function eyebrowsFindings(count, sections, ratio) {
  const max = Math.ceil(sections / ratio);
  return count > max ? [`${count} eyebrows across ${sections} sections, max ${max} (1 per ${ratio})`] : [];
}

/**
 * Every link/button that is a LABEL, not a card: one collector feeds both
 * cta-words and cta-intent. First real run (2026-09-21) flagged 69
 * things, nearly all false: whole "NEXT page" cards read as buttons, and a
 * fixed-height flex button read as wrapped. So: skip anything holding block
 * content or matching `ctaExclude` (chips, tags), and count real text lines
 * from the text nodes' own rects — never from the box height.
 */
export function ctaItems({ ctaExclude }) {
  const items = [];
  for (const el of document.querySelectorAll('a[href], button')) {
    if (!el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue;
    if (ctaExclude && el.closest(ctaExclude)) continue;
    if (el.querySelector('h1,h2,h3,h4,h5,h6,p,ul,ol,li,img,picture,video,figure')) continue; // a card, not a label
    // ...and so is anything with two or more worded parts ("Work" + "14 pieces, each with…"); an arrow span is not a part.
    if ([...el.children].filter((c) => /[\p{L}\p{N}]/u.test(c.textContent)).length > 1) continue;
    const label = (el.textContent || el.ariaLabel || '').trim().replace(/\s+/g, ' ');
    if (!label || label.length > 60) continue;
    const cs = getComputedStyle(el);
    const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
    const hasPadding = parseFloat(cs.paddingTop) > 0 || parseFloat(cs.paddingLeft) > 0;
    const styled = hasPadding && (hasBg || parseFloat(cs.borderTopWidth) > 0);
    const tops = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0) tops.push(r.top);
    }
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    const wrapped = tops.length > 0 && Math.max(...tops) - Math.min(...tops) > lineH * 0.6;
    const dest = el.tagName === 'A' ? el.getAttribute('href') : `button:${label.toLowerCase()}`;
    items.push({ label, dest, styled, wrapped });
  }
  return items;
}
export const ctaWords = ctaItems;
export const ctaIntent = ctaItems;

// Arrows and other glyphs are not words: "SEE IT LIVE ↗" is three.
const wordsOf = (label) => label.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));

/** Button-styled labels only: 3 words max, never wrapping at 1440. */
export function ctaWordsFindings(items, max) {
  const out = [];
  for (const { label, wrapped, styled } of items) {
    if (!styled) continue;
    const n = wordsOf(label).length;
    if (n > max) out.push(`"${label.slice(0, 30)}" is ${n} words (max ${max})`);
    else if (wrapped) out.push(`"${label.slice(0, 30)}" wraps to 2+ lines at 1440`);
  }
  return out;
}

/** One label per destination. "Work" and "WORK ↗" are one label; "Email" and "Send an email" are two. */
export function ctaIntentFindings(items) {
  const byDest = new Map();
  for (const { dest, label } of items) {
    if (!dest) continue;
    const key = wordsOf(label).join(' ').toLowerCase();
    if (!byDest.has(dest)) byDest.set(dest, new Map());
    if (!byDest.get(dest).has(key)) byDest.get(dest).set(key, label);
  }
  const out = [];
  for (const [dest, labels] of byDest) if (labels.size >= 2) out.push(`"${dest}" reached with ${labels.size} labels: ${[...labels.values()].join(' / ')}`);
  return out;
}

/** Distinct non-zero corner radii on the page (pills/circles exempt): at most `max` values. */
export function radiusScale({ chromeSelectors }) {
  const values = [];
  for (const el of document.querySelectorAll('body *')) {
    if (chromeSelectors && el.closest(chromeSelectors)) continue;
    if (!el.checkVisibility?.({ opacityProperty: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(el);
    const raw = cs.borderTopLeftRadius;
    if (!raw || raw === '0px' || raw.includes('%')) continue;
    const px = parseFloat(raw);
    const r = el.getBoundingClientRect();
    if (!px || px >= 9999 || px >= Math.min(r.width, r.height) / 2 - 0.5) continue; // pill/circle
    values.push(Math.round(px));
  }
  return values;
}

export function radiusScaleFindings(values, max) {
  const distinct = [...new Set(values)].sort((a, b) => a - b);
  return distinct.length > max ? [`${distinct.length} distinct border-radius values (${distinct.join(', ')}px), max ${max}`] : [];
}

/** Default section copy budget (warn only): first heading <=8 words, first paragraph <=25. */
export function copyLength() {
  const out = [];
  for (const s of document.querySelectorAll('section')) {
    if (s.parentElement.closest('section')) continue;
    const heading = s.querySelector('h1,h2,h3,h4,h5,h6')?.textContent;
    const para = s.querySelector('p')?.textContent;
    out.push({ heading, para });
  }
  return out;
}

export function copyLengthFindings({ heading, para, headingMax, paraMax }) {
  const words = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;
  const out = [];
  if (heading && words(heading) > headingMax) out.push(`warn: heading "${heading.trim().slice(0, 40)}" is ${words(heading)} words (max ${headingMax})`);
  if (para && words(para) > paraMax) out.push(`warn: paragraph "${para.trim().slice(0, 40)}" is ${words(para)} words (max ${paraMax})`);
  return out;
}

/** Grain/noise layers only on a fixed, pointer-events:none layer — never a repainting scroller. */
export function grainLayer() {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    const isGrainy = /feTurbulence|noise/i.test(cs.backgroundImage) || /turbulence|noise/i.test(cs.filter);
    if (!isGrainy) continue;
    const label = el.tagName.toLowerCase() + '.' + ((el.className + '').trim().split(/\s+/)[0] || '-');
    out.push({ position: cs.position, pointerEvents: cs.pointerEvents, label });
  }
  return out.slice(0, 8);
}

export function grainLayerFindings({ isGrainy, position, pointerEvents, label }) {
  if (!isGrainy) return [];
  return position === 'fixed' && pointerEvents === 'none' ? [] : [`${label} has a grain/noise layer but is position:${position}, pointer-events:${pointerEvents} (needs fixed + pointer-events:none)`];
}

/** Node side: raw probe data → findings. The only place a probe's result meets its decision. */
export function findingsFor(id, raw, cfg) {
  switch (id) {
    case 'eyebrows': return eyebrowsFindings(raw.count, raw.sections, cfg.eyebrowRatio);
    case 'cta-words': return ctaWordsFindings(raw, cfg.ctaWordsMax);
    case 'cta-intent': return ctaIntentFindings(raw);
    case 'radius-scale': return radiusScaleFindings(raw, cfg.radiusMax);
    case 'copy-length': return raw.flatMap((r) => copyLengthFindings({ ...r, headingMax: cfg.copyHeadingMax, paraMax: cfg.copyParaMax }));
    case 'grain-layer': return [...new Set(raw.flatMap((r) => grainLayerFindings({ isGrainy: true, ...r })))];
    default: return [];
  }
}
