# review — the adversarial pass

Runs after [verify.md](verify.md) is clean. `superpowers:requesting-code-review`
owns the request/receipt protocol; this file is what the reviewer is asked to
do that it wouldn't do by default.

## 1. Refuting verifier, per finding

Each candidate issue gets an independent skeptic prompted to **refute** it, not
to confirm it. Rules:

- Default to **refuted** when uncertain. Ambiguity kills the finding.
- Majority-refute kills it outright.
- A survivor ships with the exact input that triggers it, not a description of
  the class.

Without this, a security pass produces plausible-but-wrong findings faster than
anyone can triage them, and the round drowns in noise that reads as thorough.

## 2. Cross-vendor tier

Same-model self-review shares blind spots by construction — the reviewer
already agreed with the reasoning when it wrote the code. Route the security
pass through a different vendor's model (`trailofbits/second-opinion`) when
installed. Never route it down-tier ([models.md](models.md), hard rule 1).

## 3. The grading question

> **Every changed line should trace directly to the user's request.**

Applied line by line, not to the diff as a whole. This is gradeable; "is this
overcomplicated?" is not. A line tracing to neither the contract nor a review
note is scope creep — revert it.

## 4. Orphan asymmetry

- **Remove** imports, variables, and functions that *your* changes made unused.
- **Do not remove** pre-existing dead code. Mention it; leave it.

Stated as two rules because an agent gets it wrong in **both directions** by
default — it leaves its own orphans behind while deleting unrelated dead code
that a caller outside the diff, a test, or a dynamic reference still uses.

## 5. The over-simplification brake

**This is the counterweight to `honey`, and it is allowed to overrule it.**
`honey` is always-on in this setup and YAGNI is in CLAUDE.md, so every pressure
in the stack points at *less code* and nothing points back. That asymmetry is
the failure mode this section exists to catch.

Over-simplification is a **defect** when it:

- reduces clarity or maintainability
- produces clever solutions that are hard to understand
- combines too many concerns into one unit
- removes helpful abstractions
- prioritizes "fewer lines" over readability (nested ternaries, dense
  one-liners)
- makes the code harder to debug or extend

Fewer lines is not the goal; fewer lines *that still read* is. When a
simplification trips one of the six, the pre-simplification version wins and
the finding is dropped, not argued.

Simplification passes route to Opus — they look mechanical and fail quietly
([models.md](models.md)).

## 6. Diff-scoping, with the test gate as a precondition

Review only code touched this session unless told otherwise.

**Precondition: the suite is green before the pass starts and green after it
ends.** Both runs pasted. A behavior-preserving rewriter with no test gate is
the pattern most likely to ship a silent regression, because
"behavior-preserving" is asserted by the same model that just changed the
behavior.

No test suite on the touched path → the pass is not run. Write the
characterization test first (`superpowers:test-driven-development`).

## 7. Reading the owner's review language

When the owner critiques code in their own words, their phrasing is the
trigger and this table is the diagnosis and the first moves. Never ask them to
restate it in engineering terms.

| They say | Problem | First moves |
|---|---|---|
| "Didn't we fix this already" | Repeat feedback is a process failure: the fix being layered is wrong, and each new patch is evidence, not progress | Stop patching. Delete the layered fixes, rebuild the mechanic. Then ask what let it regress: a missing test, or a rule that belongs in the project's learnings file |
| "Over-engineered" | Speculative generality: abstraction with one caller, flexibility nobody asked for, an adjacent refactor riding along | Delete the abstraction and inline the single caller. Move the adjacent refactor to a separate ask. Re-grade every changed line against the request; a line tracing to neither the contract nor a review note is scope creep |
| "I picked it on purpose" | An agent "corrected" a deliberate choice, treating a taste call as a defect and silently swapping in the safer alternative | Restore their version exactly and record the exception narrowly (the one rule and value, with a reason), never a broad rule disable. It is a sanctioned exception, not a bug |

Add a row only from a real capture: the owner's own phrasing, naming a problem
rather than a fix, not already covered, written verbatim. An invented row
teaches the model to answer phrasing nobody has used and costs context on
every load.
