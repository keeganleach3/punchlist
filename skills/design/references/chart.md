# chart — anything containing data

**Mandatory whenever a build contains a number, a chart, or a dashboard.**
This is the part no general design skill covers. Nothing here is optional.

- [The core question](#the-core-question)
- [Choosing the summary statistic](#choosing-the-summary-statistic)
- [Hard rules](#hard-rules)
- [House chart language](#house-chart-language)
- [Sourcing](#sourcing)
- [Same data, different reader](#same-data-different-reader)
- [Checks a static screenshot cannot make](#checks-a-static-screenshot-cannot-make)
- [Field notes](#field-notes)

## The core question

Not "is this number correct." **"What does the reader do differently now?"**

A correct number with no basis for action is a failure, not a partial
success. `satisfaction: 2 out of 5` is accurate and useless — two out of
five compared to what, trending which way, is the work helping or not.

Every displayed metric answers three questions or it doesn't ship:

1. **Compared to what?** — benchmark, peer group, prior period, or target.
2. **Which direction?** — trend, not a point.
3. **Is the difference real?** — a gap inside normal variation is noise
   presented as signal.

## Choosing the summary statistic

Before defaulting to an average:

- **Mean or median?** On a skewed distribution these are different answers
  and one of them misleads. Check the distribution before choosing.
- If the source has **no historical data**, a trend line can't be drawn.
  Fall back to a benchmark — and say which benchmark, in the interface.
- When a value lands below a benchmark, ask whether the gap is
  statistically meaningful before styling it as a problem.

## Hard rules

- **Never crop a data visualization.** No clipped axis, no truncated scale,
  no bar chart starting above zero. Crop photography, texture and type
  freely.
- **The scale covers every value in the series.** A color or size ramp
  spanning three of five possible values hides two.
- **Never encode meaning by hue alone.** Pair every color-coded state with
  an icon, label or position.
- **Tabular figures for any column of numbers.**
- **Every statistic has a traceable source.** If the source can't be found,
  the number comes out.
- **Facts, opinions and assumptions are styled differently** when an
  interface carries more than one.

## House chart language

Promoted from field notes: this is what
read as *exceptional* rather than flat. Defaults, not laws.

- **Bars** — gradient fill (hue 95% → 55%), 1px hue top edge, 3px top radius
- **Lines** — blurred duplicate path underneath (8px, 35%) as glow
- **Dots** — ground ring
- **Benchmarks** — dashed `4 2` with a chip label
- **Hover** — crosshair + glass tooltip + dim other series to 60%

**Inside SVG, `backdrop-filter` does nothing.** Glass chips must be
`color-mix` fills.

**Layering (from editorial infographic posters):** the subject is the spine.
Headings cross panel edges, big numbers overlap bars and images, callouts
leader-line to the photo, color fields lean behind type. A box that holds
exactly one thing is the exception, not the pattern.

## Sourcing

1. **bklit.com first** — shadcn registry. Add
   `"@bklit": "https://ui.bklit.com/r/{name}.json"` to `components.json`,
   then `npx shadcn@latest add @bklit/<chart>`. Recharts-based.
2. Hand-authored SVG + D3 scales **only** when one SVG must morph between
   states (scrubbed pins).

`@bklit/shimmering-text` is a looping motion/react span — it cannot fill SVG
text and cannot run once. For one-shot number emphasis use a 600ms SVG
gradient gleam.

Motion gotchas (GSAP ease strings, etc.) live in
the project's learnings file, not here.

## Same data, different reader

The right rendering changes with who's reading. Before building, name the
reader and what decision they're making.

| Reader | Needs | Usually wrong for them |
|---|---|---|
| Executive | Benchmark, trend, one implication | Raw tables, unaggregated detail |
| Analyst | Raw values, filters, export, method | Pre-digested single numbers |
| Operator | Threshold state and next action | Historical trend they can't act on |
| External client | Peer comparison, what to change | Internal jargon, unexplained metrics |

Same underlying facts, different correct answer. If one rendering is being
built for all four, that's the defect.

## Checks a static screenshot cannot make

Promoted from real catches; every one of these passed multiple review
cycles before being caught.

- **Confirm every element that exists also becomes visible.** A nav shipped
  at `opacity: 0` with no reveal animation passed five reviews. Geometry
  verification and visibility verification are different checks; run both.
- **Inspect intermediate scroll states, not just keyframes.** Text once
  interpolated through invisible mid-scroll — a state that exists only
  between two keyframes and appears in no static screenshot.
- **Verify upstream data before styling a number.** A weighted-average COGS
  was corrupted by deleted test orders in production; the calculation was
  right, the input wasn't. A beautiful chart of a wrong number is the worst
  outcome this file exists to prevent.

## Field notes

_The live log is the project's learnings file. When an entry there recurs,
promote it into a rule above and prune the log._
