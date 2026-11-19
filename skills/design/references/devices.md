# devices — composition and structural vocabulary

**Open [references/00-devices-contact-sheet.png](00-devices-contact-sheet.png) before proposing a
direction.** The diagrams are the point; text descriptions are lossy.

The nine-device taxonomy is adapted from a poster-design carousel that was saved without its author's name; the diagrams are redrawn. If it is yours, open an issue and it will be credited.

Each entry is mechanic → web translation → **failure mode**. The failure
modes are the useful part.

- [Composition](#composition)
- [Structural](#structural)
- [Deployment](#deployment)
- [Type](#type)
- [Field notes](#field-notes)

## Composition

**01 Oversized type** ([diagram](01-oversized-type.png)) — clip it at the viewport edge so the eye completes
the letterform off-screen. Containment reads as a big headline; overflow
reads as a designed object. The giant element must be the most meaningful
thing in the section — a number, a claim, a verdict.
*Fails when there's nothing underneath it. Scale writes a check the section
has to cash.*

**02 Extreme cropping** ([diagram](02-extreme-cropping.png)) — cut where a cautious designer wouldn't. Exceeding
the frame on multiple sides beats one. Pair with one uncropped element as
relief.
*Fails when the viewer can't reconstruct the subject — that's confusion,
not tension. **Never on a chart** (see [chart.md](chart.md)).*

**03 Type as image** ([diagram](03-type-as-image.png)) — cutout subject z-indexed between two copies of the
type layer, front one masked to a fragment. Parallax the layers so the
interleave reads as depth.
*Fails when used because it looks current. The subject and the word need
an actual relationship.*

**04 Layering** ([diagram](04-layering.png)) — offset planes at different scroll velocities; let blocks
break their container. Strongest when the *content* is layered — versions,
perspectives, revisions — built as peelable strata.
*Fails as decorative drop shadows. Depth without meaning is noise with a
z-index.*

**05 Unexpected scale** ([diagram](05-unexpected-scale.png)) — ratio matters more than sizes. Target 20:1+.
Timid contrast (3:1) looks like a mistake. Needs generous negative space.
*Fails when the small element becomes unreadable. Floor at 11px, add
tracking as text shrinks.*

## Structural

**06 Technical chrome** ([diagram](06-technical-chrome.png)) — section tags notched into corners, figure
captions (`FIG. 004 —`), status indicators, progress counters, set-size
markers. Cheap, gives long scrolls structure, signals rigor.
*Fails as costume — a `READY` light on a static div. Also fails by
accumulation: several persistent live elements at once (crosshair,
coordinates, stacked counters) read as a video-game HUD, not rigor.
Ceiling for persistent chrome: one section/act
label plus one progress figure.*

**07 Progressive line** ([diagram](07-progressive-line.png)) — SVG path drawing itself via `stroke-dashoffset`
bound to scroll progress. Makes a sequence feel continuous rather than
like stacked cards.

**08 Staggered columns** ([diagram](08-staggered-columns.png)) — two columns deliberately misaligned at
different scroll rates. Offset at least half a card height or it looks
like a bug.

**09 Operable module** ([diagram](09-operable-module.png)) — something the visitor uses rather than reads.
The highest-value element on any portfolio or product page, because it
demonstrates instead of claiming.
*Must be real or honestly framed. Theater is fine; theater implying live
data is a credibility hole.*

**Persistent rail** — nav collapsing into a fixed sidebar on scroll,
carrying section links, key figures, standing CTA.

**Two-tone headline** — first clause in primary text color, second muted.
Carries a claim and its qualifier without a subhead.

**Proportional stat figures** — statistics as actual charts, correctly
proportioned, not styled numbers in boxes. On data work this is close to
mandatory, and getting the proportions wrong on your own page is
unforgivable.

## Deployment

Every composition device is an *attention* mechanism borrowed from formats
that get two seconds of viewer time. Long-form web is temporal — a page
that shouts continuously is exhausting. Deploy at thresholds (hero,
section openings, the one moment that has to land) and keep the space
between them calm. The contrast is what makes them work.

**Acts, not sections.** Centred, scroll-down sections with one idea each
read as middling even when every one passes audit. Compose long pages as acts on one continuous backdrop
with sticky/pinned handoffs; the story is the spine and devices mark its
beats. Losing the narrative to polish individual sections is the failure.

## Type

Three roles, not two: **display** (personality, can be strange), **text**
(invisible at 16px), **mono** (data labels, captions, chrome, tabular
figures). The mono is not optional on data work.

**Anti-default:** the serif + sans title pairing is the current AI-slop
tell. Not banned — but never the default. Reach for a more creative
contrast first: width, optical size, weight, case, or a single family
pushed hard.

Pairings worth reaching for:
- **Bricolage Grotesque + Geist + Geist Mono** — Bricolage is variable with
  width and optical-size axes and odd proportions, so it reads as a choice.
  Geist and Geist Mono share skeletons. Free.
- **Instrument Serif + clean sans + mono** — high-contrast editorial;
  has become a house style, use knowingly.
- **Archivo + Archivo Expanded** — one superfamily, very wide display.

## Field notes
_Log in the project's learnings file. Promote here when a note recurs._
