---
name: design
description: Use when designing or reviewing hero sections, landing pages, scrollytelling, decks, dashboards, or product/app UI; before writing code for a new page, section, or deck; when a page is being called done; when the owner gives design feedback in their own words; when picking a palette from scratch; and whenever the build contains a chart, metric, or number on screen.
user-invocable: true
argument-hint: "[architect | contract | devices | palette | chart | page | layout | product | film | verify | critique | audit | panel | usage | dispatch]"
---

The owner's visual language and build discipline. References load on demand. Paths in the references are relative to the plugin root, `${CLAUDE_PLUGIN_ROOT}`.

Static audit belongs to `impeccable`; `verify` here covers runtime states only. On a shared command name, `critique` here (the owner's words → the fix) wins when the owner reacts in their phrasing; `audit` here is the deep accessibility sweep, on command only. Field notes live in the project's learnings file.

| Command | Use for | Reference |
|---|---|---|
| `architect` | Every round: delegation floor, tiers, reviewer rule | [shared/architect.md](../../shared/architect.md) |
| `dispatch` | About to dispatch a worker | [shared/dispatch.md](../../shared/dispatch.md) |
| `contract` | Before any code on a new page/section/deck; owner approves first | [references/contract.md](references/contract.md) |
| `devices` | Composition vocabulary (open the images) | [references/devices.md](references/devices.md) |
| `palette` | Color, chart-safety metrics | [references/palette.md](references/palette.md) |
| `chart` | Anything with data in it; mandatory | [references/chart.md](references/chart.md) |
| `page` | Site IA, headlines, captions, carousels | [references/page.md](references/page.md) |
| `layout` | Landing restraint; countable rules are sweep checks | [references/layout.md](references/layout.md) |
| `product` | Product-UI defaults, states, forms | [references/product.md](references/product.md) |
| `film` | Product demo films and storyboards | [references/film.md](references/film.md) |
| `verify` | Runtime sweep before "done"; frame log | [references/verify.md](references/verify.md) |
| `critique` | Owner's review phrases → first moves | [references/critique.md](references/critique.md) |
| `audit` | Deep accessibility sweep | [references/audit.md](references/audit.md) |
| `usage` | Token report | [shared/usage.md](../../shared/usage.md) |
| `panel` | Adversarial expert review | [shared/panel.md](../../shared/panel.md) |

Sweep: `scripts/verify-sweep/verify-sweep.mjs`, `scripts/verify-sweep/route-shots.mjs`; a project carries only a `verify-sweep.config.json` and an ignore file. Templates: `shared/templates/punchlist.md`, [templates/contract.md](templates/contract.md).

## Rules

- **Name the devices before building.** "Oversized type because the number is the argument" is a direction; "bold and modern" isn't. Every chart is beautiful AND legible; trading legibility for looks is a defect.
- Open [references/00-devices-contact-sheet.png](references/00-devices-contact-sheet.png) before proposing a direction.

**Type size.** First-guess size is one step too small; raise explanatory text a step.
- Importance = size: a module's key line is the largest text after its heading.
- Small grey mono is chrome; if a reader needs it for the point it is content: body scale, AA contrast.
- Four sizes per section, never more (`type-census`). Delete first, then collapse the scale.
- A number users came to read is content at 13px+, even in mono.

**Direction.** Before any build round:
1. One-screen plan: diagnosis, numbered moves.
2. Exact linkable references, never "inspired by" prose.
3. A rendered comp (static HTML, project tokens, real images) when the change is structural. Build after the pick; the comp is the contract.

**A reference is a source, not a mood.** Read the named reference's source file, port its numbers (durations, eases, offsets, stagger), adapt to project tokens. Every motion or section item carries one `SOURCE:` line: the reference's source file, a component, or `SOURCE: none — <why hand-built>`; the dispatch hook flags a motion dispatch without one.

**The architect eyes every route the owner will see.**
1. A defect seen is owned now: name it next message, then fix or revert. "An agent is on it" never leaves breakage live.
2. Kill = revert: snapshot fenced files to scratch before dispatch; restore if the agent stops unreported.
3. Done means looked: run `route-shots` at the owner's viewport and 1920×1080 and read the images, not the numbers. `clipped-text` and `never-visible` are the floor.

**Owner sees it, headless does not.** A defect reported still present after a fix is reproduced in the owner's browser first ([frame log](references/verify.md)).

**Standing.** Ask before building when ambiguity changes what gets built. Every line here prevents a named failure; a recurring field note becomes a rule or sweep check, then is pruned.
