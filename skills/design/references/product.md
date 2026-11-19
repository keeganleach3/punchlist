# product — product-UI craft defaults

For app UI: dashboards, forms, tables, flows. Defaults where average AI output goes wrong. Brand consistency itself is enforced by the project's DESIGN.md and tokens, not restated here. Product demo films: [film.md](film.md).

- [House style: a worked example](#house-style-a-worked-example) · [Dashboard rules](#dashboard-rules)
- [Boring states](#boring-states-ship-with-the-build) · [Post-submission](#post-submission-pages) · [Text](#text-in-product-ui) · [Icons](#icons)
- [Forms and tables](#forms-and-tables) · [Shadows](#shadows) · [Surface details](#surface-details)

## House style: a worked example

A more premium feel is the first styling on every dashboard and app UI: build it on the first pass, not after the first review calls it flat and generic. The principles transfer (depth not lines, not everything a card, lines edited out, regular-weight figures, small splashes of colour, one radius set); the values below are one proven set from a navy-and-white product. Swap in the project's tokens.

- **Depth, not lines.** A canvas visibly deeper than the cards (e.g. `#EDF0F5` vs white). Cards: no border, radius ~20px at 1920, navy-hued shadow = 1px ring at ~4.5% + a soft drop (`0 0 0 1px rgba(21,34,64,.045), 0 1px 2px rgba(21,34,64,.04), 0 12px 28px -14px rgba(21,34,64,.16)`). Sidebar and top bar sit on the canvas; the active nav item, search, and secondary buttons are white pills with a small raise shadow; icon buttons are round.
- **Not everything is a card.** Page heads and headline figures sit open on the canvas, hairline rules between figures; cards hold the work.
- **Edit the lines out.** No divider under a card header; list dividers inside cards are hairlines inset to the card padding; tiles inside cards are filled (`sunken` or white + raise shadow), never bordered.
- **Figures and titles regular weight, at size.** Display ~40px at 1920, weight ~420, -0.025em; card titles ~560; item titles ~580. Semibold figures read as template.
- **Small splashes of colour.** Exactly one soft single-hue wash per view, on the AI's own surface; 15%-tint icon chips for kinds of item; status colour stays on data. Never a blue-to-purple gradient: that is the AI tell.
- **One radius set:** card 20 · inner tile 14 · chip 10 · pill 999. Drawers and sheets float inset with the card radius.
- **Not too blank.** A dense product keeps its information and gets the premium from surfaces, not emptiness.

## Dashboard rules

- **Every KPI carries a chart:** sparkline, mini bars, gauge, or segmented bar, plus a delta pill with an arrow. A number with a bare progress bar reads unfinished.
- **Imagery follows the use case.** Photos, hero banners, and photo avatars belong to consumer, health, and retail content; a professional back-office product gets its richness from colour, charts, and type. Decide the level of colour, decoration, and imagery from the content first; never copy a reference's level wholesale.
- **The AI states its sources and its time:** "Generated 7:30 AM", "From 6 records · needs your review", suggestion chips.

## Boring states ship with the build

Every platform build includes, designed and on-brand: empty, loading,
error, disabled, permission denied, slow connection, missing data. They are
part of the build, not a follow-up (`/impeccable harden` is the deep pass).

## Post-submission pages

Never just "thanks, we'll be in touch." The moment after a form submit is
when the user is most excited or nervous about the offering. The page is a
thank-you **plus what happens next**: when they'll hear from you, what the
first email will include, what the process looks like after, and one thing
they can do while they wait.

## Text in product UI

- **Legibility beats brand.** Don't force a branded display face into
  tables or dense UI — fall back to the text face when the brand font
  doesn't read.
- **Check the digits before picking the face**. Render the font's tabular figures at
  14–16px beside real data first: Mona Sans's `tnum` digits are a mono style
  with slashed zeros ("70" read "7θ"). Default UI face: Geist; show 1:1
  crops of 2–3 candidates and let the owner pick.
- **Tiny gray text is a failure.** Secondary context isn't punished for
  being secondary. Everything passes contrast; anything important is never
  small AND gray — small-gray on a dark tinted ground hides entirely (a past page).

## Icons

- Corner style matches the UI: bubbly/rounded UI → rounded icons; sharp UI
  → sharp icons.
- Stroke ≥ 1.5–2pt. Never 1pt.
- Prefer filled over outlined where applicable.
- Match icon weight to the adjacent type weight — bold text gets a bold
  icon, never a light icon on bold text.
- Center optically, not mathematically.

## Forms and tables

- Label OR placeholder — never both saying the same thing ("Name" +
  "Your name" helps no one).
- Numbers right-aligned, never centered. One date format across the entire
  app.

## Shadows

Well blurred, with a hue injected — real-world shadows aren't black. Keep
them consistent, and use them deliberately as hierarchy.

## Surface details

- One small set of radii, consistent across the whole product.
- No pop-in entrances — overused; pick a quieter reveal.

