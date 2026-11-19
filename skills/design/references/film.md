# film — product demo films and storyboards

All film rules in one place. Scripts: `scripts/verify-sweep/storyboard-seams.mjs`; sweep check `broken-media`.

- [The mix](#the-mix)
- [Calibrate to the reference](#calibrate-to-the-reference)
- [Shots and seams](#shots-and-seams)
- [Product and motion](#product-and-motion)
- [Review sheets](#review-sheets)

## The mix

A product demo film MIXES shot kinds. None carries the whole film:
- big kinetic type: 2-3 moments, one accent phrase each
- full flat product UI, readable
- 1-2 realistic device shots (laptop mockup)
- floating or exploded UI cards in depth
- macros on the one control that matters

Restraint means fewer type moments, not tiny supers. A single floating window plus small captions reads as flat. Color comes from the product's own palette, used as light on the ground (soft washes, one stronger ground, gradient shifts), never neon, glow, or radial halos on dark. Music is a bright product-demo bed; free CC0 pools read "video gamey and darkish", so start at a product library.

## Calibrate to the reference

Measure the reference before planning: cuts per 10 s, share of runtime that is full-frame type, distinct screens shown. Then land one step below it, not three. "Restraint" as a target reads as bland.
- **Shots:** about 1.5-3.5 s, cut on beats or bars. A 60 s film has about 18-25 shots, not 10.
- **Type:** big kinetic words are part of the language (full-frame type beats, masked and scaled), rationed but frequent.
- **Coverage:** many screens and features, not a few scenes held long.
- **Effects:** every shot carries at least one active effect: a punch-in on the beat, a lift, a whip or match transition, a cursor press, a count-up.
- **Flash follows the use case.** A product demo lands one notch calmer than its reference; a commercial matches the reference. Ask which it is before planning.

## Shots and seams

- **Never zoom in and then cut away.** A push-in either lands and holds (at least 1 s) or carries through the cut onto the same content (a match cut). Otherwise the shot keeps moving laterally or in orbit and cuts hard on the beat. Before building or rendering, run `node scripts/verify-sweep/storyboard-seams.mjs STORYBOARD.md`: it flags a shot that exits on a push or zoom into a plain cut. Fix it or relabel the seam a match cut; never silence it.
- **Every spectacle beat SAYS something.** An explode, orbit, or lift ends on a point: it reveals a feature, labels what each layer does, or hands off into the next feature. It never just goes out and comes back.

## Product and motion

- **The film wears the product's own design system**: its canvas, cards, shadows, accent, and face. No neon, glow, or dark-purple grounds unless the product has them. Imagery follows [product.md](product.md): decided by content, none for a professional back-office product.
- **Motion is the product's real motion.** Build seekable scene timelines into the app and drive or capture those instead of re-animating the UI by hand. Every readable state holds at least 1.5 s (a type beat may be shorter: it is read at a glance).
- **Two pieces, in order:** a short music-led hero film (sells the feeling), then an in-depth narrated walkthrough (answers "how does it work"). Both share one capture pipeline.

## Review sheets

Storyboard sheets, contact sheets, and any review page are hand-offs; a blank one wastes a review round.
- **Serve it, then hand over the URL.** Add a `.claude/launch.json` entry (`python -m http.server <port> -d <dir>`) and give the localhost URL. Don't hand over a bare file path: the Claude app renders local HTML as a static snapshot with no relative assets.
- **Stay under about 2 MB** when images are inlined; a 3.9 MB sheet would not open in the preview at all.
- **Mechanical:** sweep `broken-media` (on by default) fails any `<img>` that did not load or `<video>` in an error state, on every swept route. Point a sweep config at the served sheet and run it before saying "open this".
- A Chrome/Playwright screenshot proves nothing about the viewer the owner uses. Check in the Browser pane at the served URL.
