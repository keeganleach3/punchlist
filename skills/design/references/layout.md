# layout — restraint rules for landing and portfolio pages

Distilled from a third-party taste skill after an overlap audit; these are the rules that nothing else covered. Not for dashboards or product UI: that is [product.md](product.md).

Each rule names a pattern a model produces by default. The countable ones are
marked **[check]**: they run in `scripts/verify-sweep/verify-sweep.mjs` as
`eyebrows`, `cta-words`, `cta-intent`, `radius-scale`, `copy-length`,
`grain-layer` — opt-in like `scale-twin`, off by default. Turn them on in
`verify-sweep.config.json`: `"checks": {"eyebrows": true, ...}` (see
[verify.md](verify.md)).

## The hero

- **Four text elements, at most:** one small label *or* none · headline (two
  lines on desktop) · subtext (20 words) · CTAs (one primary, at most one
  secondary). Not in the hero: a tagline under the CTAs, a "used by" strip, a
  pricing teaser, a feature list, an avatar row — each gets its own section
  directly below. This sits inside the rule that the hero owns the first viewport; it does not replace it.
- A four-line hero headline is a font-size error, never a copy-length error.
  Plan headline size and hero asset size together.

## Section rhythm

- **One layout family per page, once.** Three-column cards, full-width quote,
  split text/image — whichever a section uses, no other section repeats it.
  "Selected work" must not look like "What I do."
- **At most two image/text split sections in a row.** Break the zigzag with a
  full-width section, a vertical stack, a grid, or a marquee.
- **Eyebrows: at most one per three sections, hero included. [check]** The
  small uppercase tracked label above every headline is the most common
  templated rhythm. Default is no eyebrow: the section's position on the page
  already categorises it. If one section has an eyebrow, the next two do not.
- **No split header by default:** big headline left, small explainer floating
  right. Stack them (headline, then body at ≤65ch). The split is earned only
  when the right column carries a visual or something operable.
- **Bento grids have exactly as many cells as there is content.** An
  empty or filler tile means the grid was planned wrong — reshape it. At least
  two cells carry real visual variation (image, pattern, tinted ground), not
  type on the same ground six times.
- **One corner-radius scale per page. [check]** Exceptions are written down as
  a rule ("media is square, controls are 8px"), never accumulated.

## Copy and calls to action

- **CTA labels are one or two words, three at most, and never wrap on
  desktop. [check]**
- **One label per intent, site-wide. [check]** If the nav says "Get in touch",
  the hero and footer do not say "Contact me" and "Let's talk".
- **Default section copy: headline ≤8 words, sub-paragraph ≤25 words. [check —
  warn only]** Landing sections live on the first impression. Case studies and
  long-form reading surfaces are exempt by design; say so in the contract.
- **Quotes: three lines at most; attribution is name + role (+ company),**
  never a first name alone. Typographic quote marks or none.

## Lists, logos, type

- **More than five items is a different component, not a longer list.** A
  bordered row per item is the lazy default. Options: two-column card grid
  (name, large value, one line of why it matters) · scroll-snap pills ·
  grouped chunks with one soft divider per group · three or four featured
  tiles with the rest behind a disclosure.
- **Logo walls are logos and nothing else:** real SVG marks (Simple Icons,
  devicon), no category label under each, legible in both themes, in their own
  section — never inside the hero.
- **Italic descenders need room:** an italic word with y, g, j, p or q clips
  at tight leading. Line-height ≥1.1 and a few pixels of bottom padding on the
  italic run.
- **One icon family and one stroke width per project.**

## Performance

- **Grain and noise filters live only on a fixed, `pointer-events: none`
  layer. [check]** Never on a scrolling container — it repaints every frame.
