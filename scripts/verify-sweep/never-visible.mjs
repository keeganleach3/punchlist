// never-visible: text that exists, has height, and is still at opacity 0 or
// hidden after it is scrolled into view (a reveal that never fires).
// The probe runs INSIDE the page and returns raw rows; the decision runs in
// Node (neverVisibleFindings), where it is unit-tested.

/** One row per text-bearing element, measured after scrolling it to the centre of the viewport. */
export async function neverVisible() {
  const rows = [];
  const skip = 'svg, .sr-only, [aria-hidden=true], [hidden], script, style, noscript';
  const els = [...document.querySelectorAll('body *')]
    .filter((e) => !e.closest(skip) && e.getClientRects().length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .slice(0, 400);
  for (const el of els) {
    el.scrollIntoView({ block: 'center' });
    await new Promise((r) => setTimeout(r, 120));
    let opacity = 1;
    for (let n = el; n; n = n.parentElement) opacity *= +getComputedStyle(n).opacity;
    rows.push({
      label: el.tagName.toLowerCase() + '.' + ((el.className + '').trim().split(/\s+/)[0] || '-'),
      text: el.textContent.trim().slice(0, 40),
      height: el.getBoundingClientRect().height,
      opacity,
      visibility: getComputedStyle(el).visibility,
    });
  }
  scrollTo(0, 0);
  return rows;
}

export function neverVisibleFindings(rows) {
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (!r.text.trim() || !(r.height > 0)) continue;
    const why = r.opacity < 0.01 ? 'opacity 0' : r.visibility === 'hidden' ? 'visibility hidden' : null;
    if (!why || seen.has(r.label + r.text)) continue;
    seen.add(r.label + r.text);
    out.push(`"${r.text}" (${r.label}) is still ${why} after scrolling into view`);
  }
  return out.slice(0, 8);
}
