// In-page probes, part 2: clipped text, tap targets, voids. Same contract as
// type-contrast-chrome.mjs — one argument in, JSON-serialisable result out.

/** No line of type is cut off by the box that clips it (masks and travelling text exempt). */
export async function clippedText({ maskSelectors, pinnedSelector }) {
  const TOL = 2;
  const maskSel = maskSelectors.length ? maskSelectors.join(', ') : null;
  const isMask = (el) => (maskSel && el.matches(maskSel)) || (el.style.overflow === 'hidden' && el.style.whiteSpace === 'nowrap' && el.style.display === 'block');
  const clipperOf = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const cx = /hidden|clip|auto|scroll/.test(cs.overflowX), cy = /hidden|clip|auto|scroll/.test(cs.overflowY);
      if (cx || cy) return { n, cs, cx, cy };
    }
    return null;
  };
  const hits = [];
  const H = document.documentElement.scrollHeight;
  for (let y = 0; y < H - innerHeight; y += 400) {
    const cands = [];
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 600));
    const pinned = pinnedSelector ? document.querySelector(pinnedSelector) : null;
    const snap = () => `${scrollY}|${pinned ? Math.round(pinned.getBoundingClientRect().top) : 0}`;
    for (let k = 0, last = snap(); k < 20; k++) {
      await new Promise((r) => setTimeout(r, 150));
      const now = snap();
      if (now === last) break;
      last = now;
    }
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg, .sr-only' + (maskSel ? ', ' + maskSel : ''))) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight) continue;
      const c = clipperOf(el);
      if (c && isMask(c.n)) continue;
      if (c) {
        let masked = false;
        for (let n = el; n && n !== c.n.parentElement; n = n.parentElement) {
          const s = getComputedStyle(n);
          if ((s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none')) masked = true;
        }
        if (masked) continue;
      }
      const box = c ? c.n.getBoundingClientRect() : { left: 0, right: innerWidth, top: -Infinity, bottom: Infinity };
      const scrollable = (axis) =>
        c && /auto|scroll/.test(axis === 'x' ? c.cs.overflowX : c.cs.overflowY) && (axis === 'x' ? c.n.scrollWidth > c.n.clientWidth + 1 : c.n.scrollHeight > c.n.clientHeight + 1);
      const over = [];
      if ((!c || c.cx) && !scrollable('x')) {
        if (box.left - r.left > TOL) over.push(`${Math.round(box.left - r.left)}px past its left edge`);
        if (r.right - box.right > TOL) over.push(`${Math.round(r.right - box.right)}px past its right edge`);
      }
      if (c && c.cy && !scrollable('y')) {
        if (box.top - r.top > TOL) over.push(`${Math.round(box.top - r.top)}px above its top edge`);
        if (r.bottom - box.bottom > TOL) over.push(`${Math.round(r.bottom - box.bottom)}px below its bottom edge`);
      }
      if (over.length) {
        const tag = (e) => e.tagName.toLowerCase() + '.' + ((e.className + '').trim().split(/\s+/)[0] || '-');
        cands.push({ el, box: c ? c.n : null, at: r.left - box.left, msg: `y=${y} ${tag(el)} "${el.textContent.trim().slice(0, 24)}" runs ${over.join(' and ')} (clipped by ${c ? tag(c.n) : 'the viewport'})` });
      }
    }
    // Travelling text (marquee, mid-reveal) is not cut off; text that is holds still.
    if (cands.length) {
      await new Promise((r) => setTimeout(r, 200));
      for (const c of cands) {
        const b = c.box ? c.box.getBoundingClientRect().left : 0;
        if (Math.abs(c.el.getBoundingClientRect().left - b - c.at) <= 2) hits.push(c.msg);
      }
    }
  }
  scrollTo(0, 0);
  return [...new Set(hits)].slice(0, 8);
}

/** Tap targets under MIN px at the mobile width; ::after inset inflation counts, scaled exhibits exempt. */
export function tapMobile({ min }) {
  return [...document.querySelectorAll('a[href],button')]
    .map((e) => ({ e, r: e.getBoundingClientRect(), t: (e.textContent || e.ariaLabel || '').trim().slice(0, 16) }))
    .map((x) => {
      const ps = getComputedStyle(x.e, '::after');
      const inset = ps.content !== 'none' ? Math.min(parseFloat(ps.top) || 0, parseFloat(ps.left) || 0) : 0;
      const grow = -2 * Math.min(0, inset);
      return { ...x, w: x.r.width + grow, h: x.r.height + grow };
    })
    .filter(({ w, h }) => w > 0 && h > 0 && (w < min || h < min))
    .filter(({ e, r }) => !(e.offsetWidth > 0 && r.width / e.offsetWidth < 0.7))
    .map(({ w, h, t }) => `"${t}" ${Math.round(w)}x${Math.round(h)}`)
    .slice(0, 8);
}

/** WCAG 2.5.8 in the desktop tab order: size clause, then the spacing clause for inflated controls. */
export function tapDesktop({ min }) {
  const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[tabindex]';
  return [...document.querySelectorAll(FOCUSABLE)]
    .filter((e) => !e.hasAttribute('disabled') && e.getAttribute('tabindex') !== '-1' && !e.closest('[inert]'))
    .filter((e) => e.checkVisibility?.({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true }) ?? true)
    // sr-only input inside a <label>: the label is the target, not the 1×1 box.
    .filter((e) => !(e.matches('input') && e.closest('label') && e.getBoundingClientRect().width <= 1))
    .map((e) => {
      const r = e.getBoundingClientRect();
      const ps = getComputedStyle(e, '::after');
      const inset = ps.content !== 'none' ? Math.min(parseFloat(ps.top) || 0, parseFloat(ps.left) || 0) : 0;
      const grow = -2 * Math.min(0, inset);
      return { e, r, w: r.width + grow, h: r.height + grow, t: (e.textContent || e.ariaLabel || e.title || '').trim().slice(0, 16) };
    })
    .filter((x) => x.w > 0 && x.h > 0)
    .flatMap((x, _i, all) => {
      const label = `"${x.t || x.e.tagName.toLowerCase()}" (${(x.e.className + '').slice(0, 28)})`;
      if (x.w < min || x.h < min) return [`${label} hit area ${Math.round(x.w)}x${Math.round(x.h)}`];
      if (x.r.width >= min && x.r.height >= min) return [];
      const cx = x.r.left + x.r.width / 2, cy = x.r.top + x.r.height / 2;
      const near = all.find((o) => o !== x && Math.hypot(o.r.left + o.r.width / 2 - cx, o.r.top + o.r.height / 2 - cy) < min);
      return near ? [`${label} is ${Math.round(x.r.width)}x${Math.round(x.r.height)} visually and its neighbour "${near.t}" sits <${min}px away (2.5.8 spacing)`] : [];
    })
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 8);
}

/** A screenful that is mostly nothing: longest ink-free band per viewport frame, edges excluded, head box counts as ink. */
export async function voidMid({ band, headSelector }) {
  const EDGE = 40;
  const INK = 'img,svg,canvas,video,picture,input,textarea,select,hr';
  const inkRects = () => {
    const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || +cs.opacity < 0.06) continue;
      const isMedia = el.matches(INK);
      const isText = el.children.length === 0 && !!el.textContent?.trim();
      if (!isMedia && !isText) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 2 || r.width < 2 || r.bottom < 0 || r.top > innerHeight) continue;
      // A ground layer (out-of-flow media larger than the viewport) is not ink.
      if (isMedia && cs.position !== 'static' && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9) continue;
      out.push([r.top, r.bottom]);
    }
    return out;
  };
  const hits = [];
  const H = document.documentElement.scrollHeight;
  for (let y = 0; y < Math.max(1, H - innerHeight); y += innerHeight) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 800));
    const rows = new Uint8Array(innerHeight);
    const mark = (t, b) => {
      for (let i = Math.max(0, Math.floor(t)), z = Math.min(innerHeight, Math.ceil(b)); i < z; i++) rows[i] = 1;
    };
    for (const [t, b] of inkRects()) mark(t, b);
    const head = headSelector ? document.querySelector(headSelector) : null;
    if (head) {
      const hr = head.getBoundingClientRect();
      mark(hr.top, hr.bottom);
    }
    let run = 0, best = 0, bestEnd = 0;
    for (let i = EDGE; i < innerHeight - EDGE; i++) {
      if (rows[i]) run = 0;
      else if (++run > best) { best = run; bestEnd = i; }
    }
    if (best >= band) hits.push(`scrollY=${Math.round(y)} ${best}px ink-free band (y=${bestEnd - best + 1}->${bestEnd} in-frame)`);
  }
  scrollTo(0, 0);
  return hits.slice(0, 6);
}

/** Full-width sections wildly taller than their content (trailing void). */
export function trailingVoid() {
  const out = [];
  for (const s of document.querySelectorAll('section,[class*=stage],[class*=frame]')) {
    const sr = s.getBoundingClientRect();
    if (sr.height < 400) continue;
    let maxBottom = sr.top, filled = false;
    for (const c of s.querySelectorAll('*')) {
      const cr = c.getBoundingClientRect();
      if (cr.height <= 0) continue;
      if (cr.height >= sr.height * 0.98) filled = true;
      else maxBottom = Math.max(maxBottom, cr.bottom);
    }
    if (filled) continue;
    const v = sr.bottom - maxBottom;
    if (v > 260) out.push(`${s.tagName}.${(s.className + '').slice(0, 30)} ~${Math.round(v)}px trailing void`);
  }
  return out.slice(0, 8);
}
