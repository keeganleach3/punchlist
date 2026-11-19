# A routing table for your CLAUDE.md

Skills load when their description matches the task. That is not reliable enough for rules you want followed every
time. This block goes in the `CLAUDE.md` that loads in every session and says which reference to load when. Adapt
the left column to how you work.

```markdown
## Priority
When my explicit request conflicts with a skill's taste call, my request wins. A skill may raise one short warning
first, then does what I asked. This does not waive broken builds, security issues, or impossible asks.

## Skill routing — automatic, do not wait to be asked

| When | Load |
|---|---|
| Any backend, API, data, CLI or infrastructure work starts | `punchlist:code` → `contract`. Write it, get my approval in one message, then build against it |
| A change touches auth, money, migrations or a public endpoint | `punchlist:code` → `security` and `data` |
| A code change is finished | `punchlist:code` → `verify`, then a review |
| Work spans many files mechanically, or has a cost budget | `punchlist:code` → `models` |
| Any page, section or deck starts | `punchlist:design` → `contract` |
| Anything with a chart, a metric or a number on screen | `punchlist:design` → `chart`, before building |
| A UI change is finished | `punchlist:design` → `verify` |
| I react to work in my own words | the skill's `critique` or `review` reference: my phrasing maps to the fix |
| I say "grill it", or work is about to ship outside | `punchlist:code` → `panel` |
| A step had to be redone, or I caught something after "done" | one `Miss:` line under the ask (`shared/misses.md`) |

## Hard rules, every project
- No horizontal scrollbar at any width.
- Never crop a data visualization. A bar chart's axis starts at zero.
- Every statistic has a traceable source. If the source cannot be found, the number comes out.
- A module that plays an animation lives in a fixed-size frame. Content changes inside it; the box does not.
- Four type sizes per section, at most.

## Report what ran
End every substantive reply with one line:
`— skills: <names or none> · cmds: <what ran> · hook: <fired N / clean / n-a>`
```

The last block is the cheapest audit there is. If a row in the table should have fired and the line says it did
not, you have found a routing miss without reading a transcript.
