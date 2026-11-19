# panel — adversarial SME/stakeholder review

Spin up top-of-field personas to grill an artifact. The contract: **always
harsh, to the point, never leaving out anything, highly detailed, imagining
these are from the top of their field.** Softening a finding, at dispatch or in
synthesis, is a defect in the panel, not diplomacy.

Serves both skills: code, design, decks, writing.

- [1 · Compose the panel](#1-compose-the-panel)
- [2 · Dispatch rules](#2-dispatch-rules)
- [3 · Adjudicate before presenting](#3-adjudicate-before-presenting)
- [4 · Synthesize](#4-synthesize)
- [Claims-audit mode](#claims-audit-mode)
- [5 · Close the loop](#5-close-the-loop)
- [Panel size](#panel-size)
- [Running-site audits](#running-site-audits)

## 1 · Compose the panel

Recommend 3 personas from the artifact type, then **ask the owner** (one
question) to accept, swap, or name their own. Recommended defaults:

| Artifact | Panel |
|---|---|
| Portfolio piece / public repo | agent-systems engineer from a frontier lab · staff security engineer · hiring manager at an AI lab |
| Backend / API / data | staff security engineer · Postgres DBA · SRE who owns the pager |
| Design / landing / deck | design director from a top product studio · accessibility specialist (`skills/design/references/audit.md` is their checklist) · the actual audience (recruiter, client, buyer) |
| Writing / resume / pitch | the named hiring manager · a skeptical domain SME · a copy chief |

Personas are *roles with taste*, not costumes: each gets the mandate to grade
on the dimensions their real counterpart would use, cite `file:line`, and
state what a top performer in their seat would have done differently.

## 2 · Dispatch rules

- **Read-only fencing.** Panelists never edit; they cite.
- Each prompt includes: the persona's calibre framing · "your reputation is
  on the line if you bless something weak" · required GRADES (letter, per
  dimension they'd actually use, one-line evidence each) · a mandatory
  "what's genuinely good — credit what's real" section (prevents reflexive
  pans, which are as useless as flattery).
- **The reviewer directive below goes in verbatim.** The harness mod injects it
  at spawn; without the harness, paste it. Never paraphrase it: paraphrasing
  is a known failure pattern.

  ```
  Report findings tersely: id · severity · file:line · one-line fix. Don't narrate
  or restate the diff. Honey governs your prose only — never your verdict or
  severity. Flag everything you normally would; raise false positives for the
  controller to adjudicate. Do not suppress or downgrade a finding to save words.
  ```

- Panelists run in parallel, blind to each other.

## 3 · Adjudicate before presenting

Reviewers are fallible: verify contested findings against the artifact before
they reach the owner (the refuting verifier in `skills/code/references/review.md`
§1 applies to panelists too). A finding two panelists raise independently
outranks any single voice.

## 4 · Synthesize

One report: grade table (theirs, not yours) · findings ranked by severity
with the multiply-confirmed ones flagged · fixed-now vs owner decisions ·
the credit list. **Nothing left out** — a finding you disagree with is
presented with your counter-evidence, never dropped.

## Claims-audit mode

For anything carrying stated capabilities or numbers (a README, a resume, a
pitch, this system's own docs), one panelist runs a **claims audit** instead
of a taste review: every claim graded **CONFIRMED-REAL** (with the measured
number and how it was measured) / **PARTIAL** (true with caveats, caveats
stated) / **FABRICATED-OR-UNVERIFIED**. Measurement runs against the built
artifact, never the docs, and runs before publishing: fabricated benchmarks
are cheap to remove before release and expensive after. Pairs with the rule
that every statistic has a traceable source.

## 5 · Close the loop

Anything the panel caught that earlier gates should have caught gets a
learnings entry naming the gate that should have. Anything the owner later
catches that the panel missed is `Caught by: owner`, the escape the whole
stack exists to prevent ([usage.md](usage.md) counts these).

## Panel size

Three personas is the ceiling for every audit, design audits included. Recommend
three, ask the owner to accept or swap; never propose a larger panel
unprompted. The design default is design director · accessibility specialist ·
the actual audience.

## Running-site audits

- **One capture set, every persona reads it.** Before dispatch, one headless
  pass writes screenshots (1920, 390, the ceiling width), the DOM metrics
  personas keep re-deriving, and each route's `innerText`. Personas cite the
  capture files and open a browser only for a finding the capture cannot
  settle, saying so in the report.
- **Reruns are diffs.** Each persona gets its own prior report and the routes
  changed since the audited commit, and states per open item CLOSED / PARTIAL /
  OPEN / REGRESSED with the capture file as evidence. Isolation and harshness
  are unchanged; only the evidence gathering is shared.
