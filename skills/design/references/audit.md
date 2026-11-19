# audit — accessibility + web-standards sweep

Mechanical checks distilled from `vercel-labs/web-interface-guidelines`,
WCAG 2.2, and APCA. **On the owner's command only: never auto-run, never part
of the `verify` sweep.** Each row names the model's
own error pattern. Chart color/hue rules live in [chart.md](chart.md) — not
restated here.

## Text legibility — the small-grey-text gate

| Rule | The model's error pattern |
|---|---|
| Body/interactive text ≥ 4.5:1 contrast (APCA Lc 60); large text ≥ 3:1 | styles every secondary label with the theme's `--dim`/muted grey token at 12–13px on a tinted panel — each use passes a glance, the page-wide result is unreadable |
| No text below 12px; captions/legal at 12px need full contrast | shrinks text to "de-emphasize" when the correct tool was color or weight — smallness plus greyness compounds below the floor |
| Contrast is computed against the *rendered* ground | checks the token pair (`--ink` on `--bg`) but ships the text on a lighter panel, gradient, or image where the real ratio fails |
| Placeholder is not a label | ships a form whose only field identification vanishes on first keystroke |

## Interaction

| Rule | The model's error pattern |
|---|---|
| NEVER `outline: none` without a visible focus replacement | kills the outline for aesthetics and adds the replacement "later" — keyboard users lose the page |
| NEVER `transition: all` — list properties | reaches for `all` as a shorthand, silently animating layout properties and janking scroll |
| Every icon-only control gets an accessible name | assumes the icon is self-evident; screen readers announce "button" |
| Keep submit enabled until the request starts, then disable + spinner | disables submit until the form validates, so an incomplete form gives dead-button silence instead of errors |
| Hit targets ≥ 24×24 CSS px (WCAG 2.5.8) | sizes the target to the glyph, not the tap |

## Motion & layout

| Rule | The model's error pattern |
|---|---|
| `prefers-reduced-motion` path for any scroll-driven or looping motion | builds the scrollytelling first and treats reduced-motion as a polish item that never comes — pin/scrub with no fallback is a blocker, not polish |
| Flex children need `min-w-0` to truncate | adds `text-overflow: ellipsis` to a flex child and ships the overflow anyway |
| No unwanted scrollbars | (hard rule #1 — verified mechanically in [verify.md](verify.md) step 1) |

## Protocol

When invoked: check each row against the *rendered* page, both themes,
desktop + mobile. Bounded like verify — one sweep, fix as one batch, confirm
once, stop. A failure here is a defect, not a taste call — accessibility basics are never cut for brevity.

Sources: [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) ·
WCAG 2.2 (1.4.3, 1.4.11, 2.4.7, 2.5.8) · APCA (contrast.apcacontrast.com).
