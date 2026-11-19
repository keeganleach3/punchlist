# contract — the pre-build direction contract

**Write this before any code on a new page, section, or deck. One screen,
approvable in one read. Build only after the owner approves.**

Why it exists: a build can pass every audit and still read as middling, or be polished and lose the story. Composition and story failures are invisible once
building starts — the contract is the only artifact cheap enough to reject.

## New project? Alignment workshop first

Before the first contract in a project: capture durable product context via
`/impeccable init` (PRODUCT.md), then agree the parts it doesn't hold —
the audience and what *they* came for (for a portfolio: what does the reader actually want?), the one-line problem, three tone/identity
attributes, and the overall direction. Contracts inherit this; don't
restate it per page.

## Three directions, then one contract

Don't build a single option and ask if it works. At direction stage,
present **three genuinely different directions** — different device sets,
palettes, or story shapes, not variations of one idea. The owner picks or
mixes; the contract locks the winner. One-paragraph directions or cheap
comps are the medium for exploring; built pages are not.

## The artifact

Write to `docs/design/contract-<name>.md` in the project (template: [templates/contract.md](../templates/contract.md)), six blocks:

1. **Read** — one line: surface, mode (Persuade / Operate / Read /
   Experience), audience, and the one thing the visitor must leave with.
   Then **three dials, 1–10, stated as numbers** so "bold" and "calm" stop
   being adjectives: **Variance** (1 symmetric grid · 5 offsets and mixed
   aspect ratios · 10 asymmetric, large empty zones), **Motion** (1 hover
   states only · 5 load-ins and transform/opacity transitions · 10
   scroll-driven choreography), **Density** (1 gallery-airy · 5 standard app
   spacing · 10 cockpit, lines instead of cards). Starting points: designer
   portfolio 8/7/3 · developer portfolio 6/5/4 · mainstream landing 7/6/4 ·
   editorial 6/4/3 · trust-first or regulated 3/2/5 · redesign-preserve =
   match what is there. The owner overrides in conversation. Above Variance 4,
   every asymmetric layout names its single-column collapse under 768px.
2. **Story** — the acts in order, one line each: the beat this act carries.
   An act with no beat is a section, not an act — cut or merge it. Don't let
   a story act shrink to a single chart: one chart is easy for one person to
   get right; the whole product is where the team differentiates.
3. **Devices** — per act, the device(s) deployed and why, named from
   [devices.md](devices.md). Thresholds only; the space between stays calm.
4. **Palette** — the chosen palette from [palette.md](palette.md), with
   **every hue assigned a meaning** (an act, a data layer, a reader track).
   An unassigned hue means the choice isn't finished. State the two
   registers: what chrome carries, what data carries.
5. **Chart inventory** — every number that will appear on the page, one row
   each: reader, benchmark/comparison, summary statistic (mean vs median,
   stated), source. A number that can't fill its row doesn't ship
   ([chart.md](chart.md) governs the rendering).
6. **Assets needed from the owner** — everything the owner must supply, with exact
   dimensions, requested **now**. Assets requested mid-build stall acts.

## Rules

- Approval is one message from the owner; silence is not approval.
- Changes after approval amend the contract first, then the build.
- Subagent dispatch prompts quote the contract lines they implement.
- The finish review verifies against the contract, not against taste.
