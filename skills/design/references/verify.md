# verify — runtime checks no static pass can make

- [The mechanical floor](#the-mechanical-floor)
- [The sweep: every route, both themes, desktop and mobile](#the-sweep-every-route-both-themes-desktop-and-mobile)
- [Blocked verify is reported, never downgraded](#blocked-verify-is-reported-never-downgraded)
- [Owner-browser frame log](#owner-browser-frame-log)

## The mechanical floor

Every defect class with a runnable check survived six adversarial reviewers in one audit; every prose-only check was missed under momentum. So the mechanical half of this sweep is a script, not a checklist:
```
node scripts/verify-sweep/verify-sweep.mjs   # or: npm run verify:sweep
```
The script is canonical in this plugin; a project carries only `verify-sweep.config.json` (base URL, routes, theme mechanism, optional project-specific extension) and `verify-sweep.ignore.json`. Never copy the script into a project: two copies forked within a week.

It covers: horizontal scroll at 390/1440/1920/2560/3440/5120; WCAG AA contrast on every visible text-bearing element, including text beside child elements, at one viewport (1440×900) and at the top of the page (alpha and ancestor opacity composited over the effective ground, 3:1 for large text); text revealed further down or at other widths is not measured; designed focus rings; tap targets of at least 24px at 390; fixed-chrome occlusion at scroll steps; trailing-void frames; text that exists but never becomes visible (`never-visible`); console errors; `broken-media`. A verify box may only be checked by PASTED script output, never by "I checked". Findings are disclosures: intentional design gets a reasoned entry in `verify-sweep.ignore.json`, never a silent script edit; the ignore file takes exact finding text, not patterns.

Config keys (`verify-sweep.config.json`, all optional; defaults in `scripts/verify-sweep/lib.mjs`): `base`, `routes`, `hashRouting`, `colorSchemes`, `widths`, `ownerViewport`, `headSelector` (hero-fill; "" disables), `headExempt`, `maskSelectors`, `chromeSelectors`, `readySelector`, `pendingSelector`, `fillSelector`, `initScript`, `checks` (per-id false to skip; `scale-twin` is opt-in true), `ignoreFile`, `extend` (a module whose default export runs project-specific checks per route), `shotsDir`. `VERIFY_BASE` overrides `base` for a second dev server. Steps below that the script covers say so; the rest is the judgment remainder only a reader can do.

**Layout checks, opt-in:** `eyebrows`, `cta-words`, `cta-intent`,
`radius-scale`, `copy-length`, `grain-layer` — the six countable rules from
[layout.md](layout.md), same opt-in pattern as `scale-twin`: default OFF, on
only with `checks[id] === true`, e.g.
`"checks": {"eyebrows": true, "cta-words": true, "cta-intent": true, "radius-scale": true, "copy-length": true, "grain-layer": true}`.
`copy-length` findings print as `WARN`, not `FAIL` — they never fail the run.
Their thresholds (`eyebrowRatio`, `ctaWordsMax`, `radiusMax`, `copyHeadingMax`,
`copyParaMax`) are config keys with defaults in `scripts/verify-sweep/lib.mjs`.

**Route shots.** `scripts/verify-sweep/route-shots.mjs` captures every route at the owner's viewport and 1920×1080: scroll 0 plus each sticky or docked state. Read the images; the sweep's summary line is not the look.

**Run after build, before calling any page done.** The impeccable hook reads
code; these checks read the running page. Every check below is a promoted
real catch that survived multiple review cycles before being caught.

Use the in-session browser. Bounded, per
impeccable's rule: one full sweep, fix everything as one batch, at most one
confirm round.

## The sweep: every route, both themes, desktop and mobile

1. **Horizontal overflow** (hard rule, scripted as `hscroll`):
   ```js
   document.documentElement.scrollWidth <= document.documentElement.clientWidth
   ```
   Every route, every width. `z-index: -1` does not exempt decoration from
   scroll extent.

2. **Exists-but-never-visible**: the script's `never-visible` check flags text that has height and is still at opacity 0 or hidden after scrolling into view. Everything flagged needs a reveal that actually fires.

3. **Intermediate scroll states** — sample every scrubbed section at
   25 / 50 / 75% progress from the DOM, not from screenshots:
   per stop, the elements at 0.06–0.85 effective opacity (ancestor opacity
   folded in), the tallest ink-free band, and the pinned stage's ink
   coverage on a 16px grid. Text once interpolated through invisible
   mid-scroll, a state no endpoint contains. Pump frames ~1.5s before
   sampling or scrubbed sections freeze mid-tween. Screenshot only the stop
   a sample flags; a screenshot per stop per section is image tokens on
   every later turn, and the DOM numbers are what the finding cites anyway.

4. **Blank-space gate** — one screenshot per route at 1920 as the visual
   gate, plus DOM occupancy at 20 / 40 / 60 / 80% depth (ink-box coverage
   and the longest empty column run). Any viewport-scale void of empty
   ground fails (reads as a glitch), as does low or cut-off text in a tall
   section. Extra frames only where a finding names one.

5. **Theme parity** — repeat 1–4 in the other theme; verify every data hue
   ≥ 3:1 on the current ground ([palette.md](palette.md) Theme parity).

6. **Chart truth, live** — axis starts at zero, scale covers every value in
   the series, every figure traceable ([chart.md](chart.md) hard rules,
   checked on the rendered page, not the source).

7. **Traceability** — every changed line traces directly to a contract line or
   a review note. Changes that trace to neither are scope creep; revert them.

The accessibility/web-standards sweep ([audit.md](audit.md)) is **on-command
only**: the owner invokes `audit`; it never runs as part of this sweep.

## Blocked verify is reported, never downgraded

Product-UI runtime checks need a working login / seeded environment. When
none exists, the "architect verified in the browser" box stays **OPEN and is
reported as blocked** — unit tests + diff review do not check it, they only
narrow it. Flag the missing infra once as its own task (seeded local
Supabase or a dedicated test account); never silently substitute static
checks for runtime ones. (A rendering judgment is exactly what only runtime or diff review catches.)

Report findings as one batch, fix as one batch, confirm once, stop.

## Owner-browser frame log

When the owner reports a defect as still present after a fix, do this before touching code. Headless runs once passed four rounds on a panel switch while the owner's real Chrome showed the outgoing panel popping back to full opacity for 1-2 frames at the end of every switch (a GSAP onComplete clearing a style a frame before React's commit hid the element).

1. Load the browser tools that navigate, drive the page, run JavaScript, and close tabs.
2. `navigate` to the project's dev URL (from `verify-sweep.config.json`) plus
   the route: the owner's dev server, GPU, and extensions. Wait for the curtain. Then check `document.hidden` — a
   background Chrome window throttles requestAnimationFrame to ~1 Hz, which
   reads as a frozen renderer and makes every timing number a lie
   (a common trap). If hidden, ask the owner to front the window; screenshots at
   rest positions still work for geometry, timing does not.
3. Inject the logger with `javascript_tool`: a rAF loop pushing one record
   per frame — `performance.now()`, `scrollY`, and the disputed state
   (per-panel computed opacity x max child opacity, `data-*` attributes,
   section rect top, neighbour rects). Keep it to what the report names.
4. Drive it the way the owner does: `computer.scroll` ticks with 1s waits, both
   directions, through every switch; a batch of ~10 actions.
5. Query the log: frames where two panels are both bright, frames where a
   hidden panel paints, rail/annotation vs painted panel mismatches, section
   top jitter while pinned, scroll reversals. Print the first samples with
   timestamps — the pattern names the mechanism (e.g. "1@1 3@1" at the END
   of a fade = a state/style race, not a fade bug).
6. Fix, `navigate` again (reload), re-log. The item closes only when the
   log in the OWNER's browser is clean. Then `tabs_close_mcp`.
