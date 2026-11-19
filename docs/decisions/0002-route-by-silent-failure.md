# 0002 · Route work to a model by silent-failure risk, not by size

## Context

The obvious rule for saving tokens is "small or repetitive work goes to the cheap model". It gets two common cases
backwards. A 200-file rename is large and looks expensive, but if it is wrong the build breaks at once. A cleanup
pass on one file is small and looks mechanical, but a bad one compiles, passes the smoke test and fails weeks later.

## Decision

One question decides the tier: if the worker gets this wrong, does anything tell you?

| Wrong is... | Tier | Examples |
|---|---|---|
| loud and immediate | lowest | bulk renames, formatting, extraction, log sweeps |
| caught by an existing, green test suite | middle | feature code against an approved plan, bug fixes with a repro |
| silent | highest | architecture, contracts, security review, simplification, anything touching auth, money or migrations |

Each worker definition carries a default tier. The dispatch can override it for the task in hand: going up requires
a `COMPLEX:` line stating why a wrong answer would be silent, going down requires nothing. A hook refuses a dispatch
to the highest tier that has no reason, and refuses a generic worker with no model set, because an unset model
silently inherits the session's tier.

## What it costs

- The architect has to classify every step before dispatching it, and the classification is itself a judgment.
- "The suite would catch it" is only true when the suite is green and covers the path. Where it does not, the work
  is treated as silent-failure work, which costs more.
- The security review never goes down a tier. When the session model cannot spawn the top tier, the review goes to
  a different vendor's model or the round stops.

## How we would know it was wrong

Each miss is logged with its cause and the model that produced it (`shared/misses.md`). Misses coded
`under-tiered` on a class of work are the evidence to move that class up. Top-tier work that keeps passing first
time on loud-failure tasks is the evidence to move it down.
