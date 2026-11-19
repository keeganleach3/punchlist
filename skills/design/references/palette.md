# palette — choosing color

**Open `references/10-color-library.png` and
`references/11-color-library-batch2.png`.** 47 curated combinations. No
default — choose per project.

## Metrics on each swatch

- **SEP** — smallest hue separation between the palette's true accents.
  - `≥120°` polychrome, safe for charts, hosts 3–5 distinguishable series
  - `60–120°` moderate, ~3 series before collision
  - `<60°` single family — good for brand and editorial, hostile to data
  - `1 accent` / `neutral` — chromatically neutral ground, hosts any data
- **Contrast** — best ratio between ground and any other color. Under
  4.5:1 means body text needs a third value.

## Selection order

1. **Does the work contain charts or multi-series data?** If yes, filter
   to polychrome or neutral-ground palettes before looking at anything else.
2. **Does the brand accent collide with a default series color?** Blue is
   the most-used chart color in existence — using it as the brand accent
   puts brand and data in the same register.
3. **Only then choose on feel.**

**The underused move:** pick a chromatically neutral ground and let the
*data* carry all the color. On analytical work this is often strongest.

## Commit to the whole palette

Choosing a five-hue palette and shipping one hue reads as "100% teal and
grey" — a review of a build that did exactly that. Before
building, assign every hue a meaning: an act, a data layer, a reader track.
A hue plate at full strength with ground-coloured type on it is a default
bold move, not a risk. Unassigned hues are a sign the palette choice hasn't
been finished.

## Two registers

Chrome and data are separate colour registers. UI chrome (nav, hairlines,
type, backgrounds) stays achromatic or carries one accent; that accent never
appears in a chart, and data hues never appear as decoration. A hue means
the same thing everywhere on the page or it means nothing.

## Theme parity

A palette is theme-conditional. Hues tuned for a dark ground routinely land
far under 3:1 on light. Verify every hue
≥ 3:1 on **both** grounds; shift each hue a step darker/lighter per theme
rather than reusing one set.

## What actually drives emotional read

Saturation and brightness carry more signal than hue — this is the
best-replicated finding in the area (Valdez & Mehrabian 1994, replicated
since), and it inverts how most people pick color.

- **Bright + desaturated** → calm, approachable, sits well for long reads
- **Bright + saturated** → cheerful, energetic, good for action moments
- **Dark + saturated** → intense, high-status, authoritative (≠ pleasant)
- **Dark + desaturated** → heavy, subdued, serious; use sparingly

This is why a dark ground with a restrained accent reads as authoritative
without trying. Decide saturation and brightness *before* hue.

Single-hue meaning claims mostly don't replicate. What people "know" about
color meaning is largely learned category convention — finance uses blue,
eco brands claim green — which is real and usable, but as convention, not
psychology. Breaking category convention draws attention and costs trust;
that's a deliberate trade, not a free differentiator.

## Field notes

_Log in the project's learnings file. Promote here when a note recurs._
