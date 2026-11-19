# page — information architecture and restraint

These are gates, not taste.

- [IA](#ia)
- [Restraint](#restraint)
- [Media interaction](#media-interaction)
- [Field notes](#field-notes)

## IA

- **The work comes first.** Visitors come for what the person did; the site
  frames it. Credits and media land within the first scroll on every
  subpage. "Wow, nice website — oh and she did that" is the failure mode.
- **One room per page.** The subject is the focus on every page; the page
  is a room built around them, not a showcase they appear in.
- **Capability → hook → proof.** The framework for every section, room,
  case, and card.
  - Lead with the CAPABILITY: a plain claim about what the person can do
    ("Building data systems that deal with human error"). Never the
    product, the artifact, or the puzzle. THEN the hook (the specific
    tension: "The crew logged 60 installs. The dashboard says 47."), THEN
    the proof artifact.
  - Test: would a stranger know what skill is claimed from the headline
    alone? A title naming only the problem or product fails.
  - DIRECT over clever. Subtitle test: a stranger can say what the section
    shows from the subtitle alone. Mystery or teaser lines fail even when
    they sound good.
  - Structure is CONSISTENT across sibling modules: if two rooms carry
    capability headlines and two don't, the ones without read as broken.

## Restraint

- **Motion is background accent** around the subject's content. Set pieces
  that own a scroll section read as tech demos and subtract from the work.
  Full-bleed scene takeovers on content pages are too much — contain scenes
  as objects on the page.
- **Decorative accents earn context or go.** "Sounds good but is
  meaningless" applies to ornament as much as copy.
- **Era/theme = photographic register** — image treatment, one accent, one
  motivated type choice. Never scenery or cosplay.

## Media interaction

- **Hover-to-video needs a 450–600ms dwell** before the crossfade; the
  pointer often rests on the image already, and an instant swap means the
  photo never reads.
- **When hover swaps image → video, the caption swaps with it.** A strip
  describing the still while a different moment plays reads as a factual
  error, not a detail. Build caption crossfade into the primitive from
  day one.

- **Auto-cycling media always ships with visible prev/next arrows.** Dots
  alone fail. Extends to EVERY multi-state module with switch buttons
  (artifact switchers, state chips, flow stages): arrows signal "this is
  navigable".
- Clicking a dot/arrow RESETS the auto-advance timer to its full interval
  (never fires mid-read right after a manual pick).
- The advance timer NEVER depends on an animation's completion callback — a
  dropped callback freezes the whole cycle. A hard timer owns the cadence;
  animations fit inside it (watchdog if an animation must gate).

## Field notes

_Log in the project's learnings file; promote here when a note recurs._
