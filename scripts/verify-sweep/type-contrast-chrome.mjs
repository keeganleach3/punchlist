// In-page probes for verify-sweep.mjs. Each is a plain function passed to
// page.evaluate — no closures over Node scope; everything it needs arrives
// as its single argument. Ported from the first project that used it, with
// project-specific selectors lifted into config.

/** Four rendered text sizes per top-level block, never more (CLAUDE.md hard rule). */
export function typeCensus({ chromeSelectors }) {
  const skip = 'svg, .sr-only, [data-chart-chrome]' + (chromeSelectors ? ', ' + chromeSelectors : '');
  const blocks = [...document.querySelectorAll('section, footer, [data-page-head]')].filter(
    (s) => !s.parentElement.closest('section, footer, [data-page-head]'),
  );
  const out = [];
  for (const s of blocks) {
    const sizes = new Map();
    for (const t of s.querySelectorAll('*')) {
      if (t.closest(skip)) continue;
      if (![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!t.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const px = parseFloat(getComputedStyle(t).fontSize);
      const key = [...sizes.keys()].find((k) => Math.abs(k - px) <= 1) ?? px;
      sizes.set(key, (sizes.get(key) ?? 0) + 1);
    }
    if (sizes.size > 4) {
      const label = s.getAttribute('aria-label') || s.id || s.tagName.toLowerCase() + '.' + ((s.className + '').trim().split(/\s+/)[0] || '-');
      out.push(`${label}: ${sizes.size} sizes (${[...sizes.keys()].sort((a, b) => a - b).map((k) => Math.round(k)).join(',')})`);
    }
  }
  return out.slice(0, 8);
}

/** The head owns the first viewport: nothing outside it visible above the fold; its floor on screen. */
export function heroFill({ headSelector, chromeSelectors }) {
  const head = document.querySelector(headSelector);
  if (!head) return { missing: true };
  const hr = head.getBoundingClientRect();
  const skip = headSelector + ', svg, .sr-only' + (chromeSelectors ? ', ' + chromeSelectors : '');
  const leaks = [];
  for (const t of document.querySelectorAll('main *, footer *')) {
    if (t.closest(skip)) continue;
    if (![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!t.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const y = t.getBoundingClientRect().top;
    if (y < innerHeight - 1) leaks.push(`"${t.textContent.trim().slice(0, 32)}" y=${Math.round(y)}`);
  }
  const cue = head.lastElementChild?.getBoundingClientRect();
  return { headH: Math.round(hr.height), leaks: leaks.slice(0, 4), cue: cue ? [Math.round(cue.top), Math.round(cue.bottom)] : null };
}

/** Viewport-fraction rects of every settled text element in the first viewport (scale-twin). */
export function viewportRects({ chromeSelectors }) {
  const skip = 'svg, .sr-only' + (chromeSelectors ? ', ' + chromeSelectors : '');
  const out = {};
  for (const t of document.querySelectorAll('main *')) {
    if (t.closest(skip)) continue;
    if (![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!t.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    const cs = getComputedStyle(t);
    if (Number(cs.opacity) < 1) continue;
    if (cs.transform !== 'none' && cs.transform !== 'matrix(1, 0, 0, 1, 0, 0)') continue;
    const r = t.getBoundingClientRect();
    if (r.top >= innerHeight || r.bottom <= 0 || r.width < 2) continue;
    const key = t.textContent.trim().slice(0, 40);
    if (out[key]) continue;
    out[key] = [r.left / innerWidth, r.top / innerHeight, r.right / innerWidth, r.bottom / innerHeight];
  }
  return out;
}

/** Every element with a non-empty text node of its own, leaf or mixed ("Hello <b>x</b> world" yields the p and the b).
 *  Duck-typed on nodeType/childNodes so it unit-tests without a browser; the sweep inlines its source into aaContrast. */
export function textHosts(root) {
  const out = [];
  const walk = (n) => {
    if (n !== root && [...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) out.push(n);
    for (const c of n.childNodes) if (c.nodeType === 1) walk(c);
  };
  walk(root);
  return out;
}

/** WCAG AA on every rendered text node, compositing fg alpha and ancestor opacity over the effective ground. */
/** The colour a CSS linear-gradient paints at (x, y) of a w×h box, from a computed background-image: [r, g, b, a].
 *  Topmost gradient layer; stops interpolated in sRGB as CSS does for legacy colours. Radial, conic and repeating
 *  gradients (textures such as hatches) return null and the caller falls back to background-color.
 *  Pure — the sweep inlines its source into aaContrast (2026-09-29: text on a tinted AI panel failed AA while the
 *  sweep, reading only background-color, measured it against the white card underneath). */
export function gradientColorAt(image, w, h, x, y) {
  const split = (str) => { const out = []; let d = 0, cur = '';
    for (const ch of str) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    return cur.trim() ? [...out, cur.trim()] : out; };
  const layer = split(image || '').find((l) => /gradient\(/.test(l));
  const m = layer?.match(/^linear-gradient\((.*)\)$/s);
  if (!m) return null;
  const args = split(m[1]);
  let deg = 180;
  const head = args[0];
  const unit = head.match(/^(-?[\d.]+)(deg|turn|rad|grad)$/);
  const sides = { top: 0, right: 90, bottom: 180, left: 270 };
  if (unit) { deg = +unit[1] * { deg: 1, turn: 360, rad: 180 / Math.PI, grad: 0.9 }[unit[2]]; args.shift(); }
  else if (head.startsWith('to ')) {
    const k = head.slice(3).split(/\s+/).map((w2) => sides[w2]);
    deg = k.length === 1 ? k[0] : (k.includes(0) ? (k.includes(90) ? 45 : 315) : k.includes(90) ? 135 : 225);
    args.shift();
  }
  const a = (deg * Math.PI) / 180, L = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a)) || 1;
  const stops = args.map((arg) => {
    const c = arg.match(/(rgba?|color)\([^)]*\)/)?.[0];
    if (!c) return null;
    const n = c.match(/-?[\d.]+/g).map(Number);
    const rgba = c.startsWith('color(') ? [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1] : [n[0], n[1], n[2], n[3] ?? 1];
    const p = arg.replace(c, '').trim().split(/\s+/)[0];
    return { rgba, at: !p ? null : p.endsWith('%') ? parseFloat(p) / 100 : p.endsWith('px') ? parseFloat(p) / L : null };
  });
  if (stops.length < 2 || stops.includes(null)) return null;
  stops[0].at ??= 0; stops.at(-1).at ??= 1;
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].at != null) { stops[i].at = Math.max(stops[i].at, stops[i - 1].at); continue; }
    let j = i; while (stops[j].at == null) j++;
    for (let k = i; k < j; k++) stops[k].at = stops[i - 1].at + ((stops[j].at - stops[i - 1].at) * (k - i + 1)) / (j - i + 1);
  }
  const t = 0.5 + ((x - w / 2) * Math.sin(a) - (y - h / 2) * Math.cos(a)) / L;
  if (t <= stops[0].at) return stops[0].rgba;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].at) {
      const f = (t - stops[i - 1].at) / (stops[i].at - stops[i - 1].at || 1);
      return stops[i].rgba.map((v, k) => stops[i - 1].rgba[k] + (v - stops[i - 1].rgba[k]) * f);
    }
  }
  return stops.at(-1).rgba;
}

/** Text vs. what is painted behind it — background-color, or a linear-gradient sampled at the text's left, centre and
 *  right (the worst of the three counts). Called with gradientColorAt's source inlined (verify-sweep). */
export function aaContrast(gradientAt, hostsOf) {
  const lum = (r, g, b) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = s.match(/[\d.]+/g)?.map(Number);
    if (!m) return null;
    if (s.startsWith('color(')) return m.slice(0, 3).map((v) => v * 255).concat(m.length > 3 ? [m[3]] : []);
    return m;
  };
  const root = () => parse(getComputedStyle(document.documentElement).backgroundColor) ?? [255, 255, 255];
  const over = (c, under) => c.slice(0, 3).map((v, i) => v * (c[3] ?? 1) + under[i] * (1 - (c[3] ?? 1)));
  // one background per sample point: walk up to the first opaque paint; a gradient with alpha blends onto what's below
  const bgsOf = (el, pts) => {
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const c = parse(cs.backgroundColor);
      const solid = c && (c.length < 4 || c[3] > 0.9);
      if (gradientAt && cs.backgroundImage.includes('gradient(')) {
        const r = n.getBoundingClientRect();
        const g = pts.map(([x, y]) => gradientAt(cs.backgroundImage, r.width, r.height, x - r.left, y - r.top));
        if (g.every(Boolean)) {
          const under = solid ? pts.map(() => c) : n.parentElement ? bgsOf(n.parentElement, pts) : pts.map(root);
          return g.map((col, i) => over(col, under[i]));
        }
      }
      if (solid) return pts.map(() => c);
    }
    return pts.map(root);
  };
  const opacityOf = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) o *= +getComputedStyle(n).opacity;
    return o;
  };
  const out = [];
  for (const el of hostsOf(document.body)) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (el.closest('[aria-hidden=true], svg')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim();
    const fg = parse(cs.color);
    if (!fg || (fg.length === 4 && fg[3] < 0.05)) continue;
    if (opacityOf(el) < 0.05) continue;
    const cy = r.top + r.height / 2;
    const a = (fg.length === 4 ? fg[3] : 1) * opacityOf(el);
    const ratio = Math.min(...bgsOf(el, [[r.left + 2, cy], [r.left + r.width / 2, cy], [r.right - 2, cy]]).map((bg) => {
      const c = fg.slice(0, 3).map((v, i) => v * a + bg[i] * (1 - a));
      const L1 = lum(...c), L2 = lum(...bg.slice(0, 3));
      return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    }));
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 600);
    const need = large ? 3 : 4.5;
    if (ratio < need - 0.03)
      out.push(`${el.tagName}.${(el.className + '').slice(0, 30)} "${own.slice(0, 25)}" ${ratio.toFixed(2)}:1 (need ${need})`);
  }
  return [...new Set(out)].slice(0, 12);
}

/** Fixed chrome covering headings at 400px scroll steps. */
export async function occlusion() {
  const parse = (s) => {
    const m = s.match(/[\d.]+/g)?.map(Number);
    return m && m.length === 4 ? m : m ? [...m, 1] : null;
  };
  const fixed = [...document.querySelectorAll('body *')].filter((e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return cs.position === 'fixed' && r.width > 80 && r.height > 24 && cs.visibility !== 'hidden' && +cs.opacity > 0.5 && cs.pointerEvents !== 'none' && parse(cs.backgroundColor)?.[3] !== 0;
  });
  if (!fixed.length) return [];
  const hits = [];
  const H = document.documentElement.scrollHeight;
  for (let y = 0; y < H - innerHeight; y += 400) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
    for (const f of fixed) {
      const fr = f.getBoundingClientRect();
      if (fr.height < 24) continue;
      for (const h of document.querySelectorAll('h1,h2,h3,.nums,[class*=headline]')) {
        const hr = h.getBoundingClientRect();
        const ox = Math.min(fr.right, hr.right) - Math.max(fr.left, hr.left);
        const oy = Math.min(fr.bottom, hr.bottom) - Math.max(fr.top, hr.top);
        if (ox > 30 && oy > 10 && h.textContent.trim()) hits.push(`y=${y} "${h.textContent.trim().slice(0, 30)}" under fixed .${(f.className + '').slice(0, 25)}`);
      }
    }
  }
  scrollTo(0, 0);
  return [...new Set(hits)].slice(0, 8);
}

/** Sticky/fixed plates taller than 12% of the viewport, or parked over a visible control. */
export async function stickyChrome() {
  const alpha = (s) => {
    const m = s.match(/[\d.]+/g)?.map(Number);
    return !m ? 0 : m.length === 4 ? m[3] : 1;
  };
  const isChrome = (e) => {
    const cs = getComputedStyle(e);
    if (cs.position !== 'sticky' && cs.position !== 'fixed') return false;
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity <= 0.5) return false;
    return alpha(cs.backgroundColor) > 0.5 || cs.backdropFilter !== 'none';
  };
  const name = (e) => e.tagName.toLowerCase() + '.' + ((e.className + '').trim().split(/\s+/)[0] || '');
  const chrome = [...document.querySelectorAll('body *')].filter(isChrome);
  const hits = [];
  const MAXY = document.documentElement.scrollHeight - innerHeight;
  for (let y = 0; y < MAXY; y += 400) {
    const covered = [];
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
    const controls = [...document.querySelectorAll('button, a[href], [role=button], input')].filter((e) => e.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
    for (const c of chrome) {
      if (!isChrome(c)) continue;
      const r = c.getBoundingClientRect();
      if (r.height <= 0 || r.bottom <= 0 || r.top >= innerHeight) continue;
      if (r.height > innerHeight * 0.12) {
        hits.push(`y=${y} ${name(c)} is ${Math.round(r.height)}px, ${Math.round((r.height / innerHeight) * 100)}% of the viewport`);
        continue;
      }
      for (const el of controls) {
        if (c === el || c.contains(el)) continue;
        const er = el.getBoundingClientRect();
        if (er.width < 4 || er.height < 4) continue;
        const cx = er.left + er.width / 2, cy = er.top + er.height / 2;
        if (cy < 0 || cy > innerHeight) continue;
        const over = document.elementFromPoint(cx, cy);
        if (over !== c && !c.contains(over)) continue;
        if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom)
          covered.push({ el, top: er.top, msg: `y=${y} ${name(c)} covers "${(el.textContent || el.ariaLabel || el.tagName).trim().slice(0, 20)}"` });
      }
    }
    // Parked, not passing: nudge the page; a control in flow moves, a parked one does not.
    if (covered.length) {
      const d = y + 120 <= MAXY ? 120 : -120;
      scrollTo(0, y + d);
      await new Promise((r) => setTimeout(r, 200));
      for (const c of covered) if (Math.abs(c.top - c.el.getBoundingClientRect().top - d) > 12) hits.push(c.msg);
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  scrollTo(0, 0);
  return [...new Set(hits)].slice(0, 8);
}
