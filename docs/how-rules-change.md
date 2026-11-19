# How a rule or a hook changes

This plugin is a set of prompts with code around them. Both are held to the same bar: a change is tested, and it
earns its place.

## Adding or changing a rule

1. **Name the failure first.** A line belongs in a skill file only if it prevents a specific failure or tells the
   model something it would not know. "Always parameterize SQL" restates what the model knows. "Reaches for string
   interpolation when the query is built conditionally" names the mistake.
2. **Prefer a check to a sentence.** If a script or hook can catch the failure, write that, with a test, and keep
   the prose to one line that names the check.
3. **One home per rule.** If the rule already exists in another file, link to it.
4. **Stay under the caps.** `SKILL.md` is capped at 1,200 estimated tokens and each reference at 2,800. If your
   change goes over, something else comes out.
5. **Record where it came from.** A design rule gets a row in `docs/origins.md`: the rule, the feedback that caused
   it, the date, and what enforces it.

## Changing a hook or script

- Write the failing test first and watch it fail. Node standard library only; no dependencies.
- A hook must never break the session it runs in. Bookkeeping failures are swallowed.
- A hard block that fires on correct code gets switched off by its users. Add the must-not-block case to the tests
  along with the must-block one.
