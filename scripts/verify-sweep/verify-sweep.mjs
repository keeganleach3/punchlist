#!/usr/bin/env node
// verify-sweep — the mechanical floor of the design skill's `verify`, canonical
// in the skill. A project carries only verify-sweep.config.json (base URL,
// routes, theme, selectors, per-check toggles, optional `extend` module) and
// verify-sweep.ignore.json. Never copy this file into a project.
//
//   node <plugin root>/scripts/verify-sweep/verify-sweep.mjs [route ...]
//   (Git Bash: MSYS_NO_PATHCONV=1, or a leading-slash route becomes a path.)
//
// Findings are DISCLOSURES for architect triage: intentional design gets an
// ignore entry with a reason, never a silent script edit. Exit 1 on any FAIL
// not covered by the ignore file.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ALL_CHECKS, launch, loadConfig, loadIgnores, partition, settle } from './lib.mjs';
import { aaContrast, gradientColorAt, heroFill, occlusion, stickyChrome, textHosts, typeCensus, viewportRects } from './type-contrast-chrome.mjs';
import { clippedText, tapDesktop, tapMobile, trailingVoid, voidMid } from './clip-tap-void.mjs';
import { neverVisible, neverVisibleFindings } from './never-visible.mjs';
import { copyLength, ctaIntent, ctaWords, eyebrows, findingsFor, grainLayer, radiusScale } from './layout-rules.mjs';

const cwd = process.cwd();
const cfg = loadConfig(cwd);
const argRoutes = process.argv.slice(2).filter((a) => a.startsWith('/'));
const ROUTES = argRoutes.length ? argRoutes : cfg.routes;
const findings = [];
const fail = (id, msg) => findings.push({ id, msg });
const on = (id) => cfg.enabled(id);
const cpu = process.env.SWEEP_CPU ? Number(process.env.SWEEP_CPU) : 0;

const browser = await launch(cwd);
async function open(width, height, colorScheme) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme });
  const p = await ctx.newPage();
  if (cfg.initScript) await p.addInitScript(cfg.initScript);
  if (cpu) (await ctx.newCDPSession(p)).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  return [ctx, p];
}
async function visit(p, route, beat) {
  await p.goto(cfg.url(route), { waitUntil: 'networkidle', timeout: 60000 });
  await settle(p, cfg, beat);
}
const extend = cfg.extend ? (await import(pathToFileURL(resolve(cwd, cfg.extend)).href)).default : null;

for (const scheme of cfg.colorSchemes) {
  const tag = cfg.colorSchemes.length > 1 ? ` ${scheme}` : '';
  for (const route of ROUTES) {
    const R = route + tag;
    if (on('hscroll')) {
      for (const w of cfg.widths) {
        const [ctx, p] = await open(w, w < 800 ? 844 : 950, scheme);
        await visit(p, route, 1500);
        const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (over > 0) fail(`hscroll ${R} @${w}`, `scrollWidth exceeds clientWidth by ${over}px`);
        await ctx.close();
      }
    }

    const [ctx, p] = await open(1440, 900, scheme);
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await visit(p, route, 2000);
    if (on('console') && errors.length) fail(`console ${R}`, errors.slice(0, 3).join(' | '));
    // Review sheets and pages alike: a frame that renders blank is a failed hand-off (verify.md, 2026-09-29).
    if (on('broken-media'))
      for (const m of await p.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => `img ${(i.currentSrc || i.src).slice(0, 80)}`)
        .concat([...document.querySelectorAll('video')].filter((v) => v.error).map((v) => `video ${(v.currentSrc || v.src).slice(0, 80)}`)))) fail(`broken-media ${R}`, m);
    if (on('type-census')) for (const m of await p.evaluate(typeCensus, { chromeSelectors: cfg.chromeSelectors })) fail(`type-census ${R}`, m);
    // string form: gradientColorAt's source travels inlined (page.evaluate can't pass a function argument)
    if (on('aa')) for (const m of await p.evaluate(`(${aaContrast})(${gradientColorAt}, ${textHosts})`)) fail(`aa ${R}`, m);
    if (on('never-visible')) for (const m of neverVisibleFindings(await p.evaluate(neverVisible))) fail(`never-visible ${R}`, m);
    if (on('occlusion')) for (const m of await p.evaluate(occlusion)) fail(`occlusion ${R}`, m);
    if (on('sticky-chrome')) for (const m of await p.evaluate(stickyChrome)) fail(`sticky-chrome ${R}`, m);
    if (on('clipped-text'))
      for (const m of await p.evaluate(clippedText, { maskSelectors: cfg.maskSelectors, pinnedSelector: cfg.headSelector })) fail(`clipped-text ${R}`, m);
    // Probes return raw data from the page; findingsFor decides in Node (layout-rules.mjs).
    for (const [id, probe] of [['eyebrows', eyebrows], ['cta-words', ctaWords], ['cta-intent', ctaIntent], ['radius-scale', radiusScale], ['copy-length', copyLength], ['grain-layer', grainLayer]]) {
      if (on(id)) for (const m of findingsFor(id, await p.evaluate(probe, { chromeSelectors: cfg.chromeSelectors, ctaExclude: cfg.ctaExclude }), cfg)) fail(`${id} ${R}`, m);
    }
    if (on('focus')) {
      // Real Tab presses: programmatic .focus() does not match :focus-visible.
      await p.evaluate(() => scrollTo(0, 0));
      const bad = [];
      for (let i = 0; i < 12; i++) {
        await p.keyboard.press('Tab');
        const r = await p.evaluate(() => {
          let el = document.activeElement;
          if (!el || el === document.body) return null;
          // A date/time input takes several Tab stops inside ONE element; only its first stop is a focus event.
          if (window.__sweepLastFocus === el) return null;
          window.__sweepLastFocus = el;
          // sr-only input: the ring belongs to its <label> (focus-within).
          if (el.matches('input') && el.getBoundingClientRect().width <= 1 && el.closest('label')) el = el.closest('label');
          const cs = getComputedStyle(el);
          const ring = (parseFloat(cs.outlineWidth) >= 2 && cs.outlineStyle !== 'none') || cs.boxShadow !== 'none';
          return ring ? null : el.tagName + ' "' + (el.textContent || el.ariaLabel || '').trim().slice(0, 20) + '"';
        });
        if (r) bad.push(r);
      }
      for (const f of [...new Set(bad)].slice(0, 6)) fail(`focus ${R}`, `no designed ring: ${f}`);
    }
    if (extend) await extend({ page: p, route, scheme, cfg, fail: (id, m) => fail(`${id} ${R}`, m), open, visit });
    await ctx.close();

    if (on('hero-fill') && cfg.headSelector && !cfg.headExempt.includes(route)) {
      for (const [w, h] of cfg.heroViewports) {
        const [c, pg] = await open(w, h, scheme);
        await visit(pg, route, 2000);
        const r = await pg.evaluate(heroFill, { headSelector: cfg.headSelector, chromeSelectors: cfg.chromeSelectors });
        if (r.missing) fail(`hero-fill ${R} @${w}x${h}`, `no ${cfg.headSelector} on this route`);
        else if (r.leaks.length) fail(`hero-fill ${R} @${w}x${h}`, `head ${r.headH}px; visible above the fold: ${r.leaks.join(' | ')}`);
        if (r.cue && (r.cue[1] > h + 1 || r.cue[0] < -1))
          fail(`hero-fill-cue ${R} @${w}x${h}`, `the head's floor sits ${r.cue[1] > h ? `${r.cue[1] - h}px under` : `${-r.cue[0]}px above`} the fold`);
        await c.close();
      }
    }

    if (on('scale-twin')) {
      const grab = async (w, h) => {
        const [c, pg] = await open(w, h, scheme);
        await visit(pg, route, 2500);
        const rects = await pg.evaluate(viewportRects, { chromeSelectors: cfg.chromeSelectors });
        await c.close();
        return rects;
      };
      const a = await grab(1920, 1080), b = await grab(2560, 1440);
      for (const [k, ra] of Object.entries(a)) {
        const rb = b[k];
        if (!rb) fail(`scale-twin ${R}`, `"${k}" present at 1920, not in view at 2560`);
        else {
          const d = Math.max(...ra.map((v, i) => Math.abs(v - rb[i])));
          if (d > 0.025) fail(`scale-twin ${R}`, `"${k}" drifts ${(d * 100).toFixed(1)}% of the viewport`);
        }
      }
    }

    if (on('tap')) {
      const [c, pg] = await open(390, 844, scheme);
      await visit(pg, route, 1500);
      for (const t of await pg.evaluate(tapMobile, { min: cfg.tapMin })) fail(`tap ${R}`, `target < ${cfg.tapMin}px: ${t}`);
      await c.close();
    }
    if (on('tap-desktop')) {
      const [c, pg] = await open(1920, 1080, scheme);
      await visit(pg, route, 1500);
      for (const t of await pg.evaluate(tapDesktop, { min: cfg.tapMin })) fail(`tap-desktop ${R}`, `WCAG 2.5.8 @1920: ${t}`);
      await c.close();
    }
    if (on('void-mid')) {
      for (const [w, h] of cfg.voidViewports) {
        const [c, pg] = await open(w, h, scheme);
        await visit(pg, route, 2000);
        for (const b of await pg.evaluate(voidMid, { band: cfg.voidBand, headSelector: cfg.headSelector })) fail(`void-mid ${R} @${w}x${h}`, b);
        await c.close();
      }
    }
    if (on('void')) {
      const [c, pg] = await open(1440, 900, scheme);
      await visit(pg, route, 1500);
      for (const v of await pg.evaluate(trailingVoid)) fail(`void ${R}`, v);
      await c.close();
    }
  }
}
await browser.close();

const { active, ignored } = partition(findings, loadIgnores(cwd, cfg));
// copy-length findings are prefixed warn: — printed, never counted as a failure (layout.md rule 5).
const warns = active.filter((f) => f.msg.startsWith('warn:'));
const fails = active.filter((f) => !f.msg.startsWith('warn:'));
// After the label, the line is exactly `${id} ${msg}`, the text ignore keys match (lib.mjs partition), so a printed
// finding can be pasted into verify-sweep.ignore.json as-is.
for (const f of warns) console.log(`WARN  ${f.id} ${f.msg}`);
for (const f of fails) console.log(`FAIL  ${f.id} ${f.msg}`);
const ran = ALL_CHECKS.filter(on);
console.log(
  `\nverify-sweep: ${fails.length} failing, ${warns.length} warn, ${ignored} ignored · ${ROUTES.length} routes × ${cfg.colorSchemes.length} scheme(s)` +
    ` · h-scroll ${cfg.widths.join('/')} · checks: ${ran.join(', ')}${extend ? ' + ' + cfg.extend : ''}`,
);
process.exit(fails.length ? 1 : 0);
