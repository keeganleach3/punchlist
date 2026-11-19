# Origins of the design rules

A traceability table for readers; agents do not load it. Each row is one rule, the owner's words that caused it (verbatim), the date, and what enforces it: a sweep check (`scripts/verify-sweep/`), a hook, or "prose only". Quotes keep the owner's original spelling.

| Rule | Owner's words | Date | Enforced by |
|---|---|---|---|
| Type size: first guess is one step too small; importance = size; small grey mono is chrome; a number users read is content at 13px+ | "Your natural instinct on all font is almost always too small... I cannot keep wasting tokens saying make it bigger." | 2026-08-27 | prose only |
| Four type sizes per section, never more | "Less font sizes definitely, lets make this a more definitive rule, less font size types and styles to avoid clutter." | 2026-09-03 | sweep `type-census` |
| Direction before build: one-screen plan, exact linkable references, a rendered comp when structural; the comp is the contract | "Real references and images for me to look at and a quick plan breakdown, it'll have less back and forth because I'll know more what to expect." | 2026-08-28 | prose only |
| A reference is a source, not a mood: read its source file, port the numbers, carry one `SOURCE:` line | "why are we ignoring these references how do we improve the skill file to check for these things." | 2026-09-05 | dispatch hook flags a motion dispatch with no `SOURCE:` line |
| The architect eyes every route: a defect seen is owned now; kill = revert; done means looked | "How did this nav menu pass? You cant read the 4th thing at all it doesnt fit in the section. You're not spending the time to truly check things visually in browser... you are missing more and more things." | 2026-09-05 | sweep `clipped-text` and `never-visible` are the floor; `route-shots.mjs` supplies the images; the looking is prose only |
| A defect reported still present is reproduced in the owner's browser first, with the frame log | "If something is brought up as fixed and its still not fixed, lets open a browser on my pc and then go from there so we dont waste time and credits basing it off of headless runs." | 2026-09-04 | prose only |
| Ask before building when ambiguity changes what gets built | "I'd rather get it right" | undated | prose only |
| A page's hero owns the first viewport | "Every page's hero for a sense of space should take up the whole page. No seeing the next sections until a user scrolls to give it a sense of space and purpose." | 2026-09-03 | sweep `hero-fill` |
| Scale to a ceiling, then hold and bleed | "It shouldnt just adjust it should look good on larger sizes too" | 2026-08-31 | sweep `scale-twin` (opt-in), `hscroll` at 2560/3440/5120 |
| Animations never resize their container | "The set section its supposed to be viewed in cant continually change because of an animation." | 2026-08-27 | prose only |
| Technical chrome ceiling: one section/act label plus one progress figure | "video game HUD" | undated | prose only |
| Acts, not sections: compose long pages as acts on one backdrop | "middling" and "lost the story" | undated | prose only |
| Capability, then hook, then proof | "Explaining what I can do then PROOF is what makes them read more." | 2026-08-27 | prose only |
| Direct over clever: a stranger can say what a section shows from its subtitle | "At no point on the page do we want people having to guess what a header or section is about to mean or be about." | 2026-08-27 | prose only |
| Auto-cycling media and multi-state modules ship with visible prev/next arrows | "that's a full best-practice situation... that needs to be part of the build always" | 2026-08-27 | prose only |
| Commit to the whole palette: every hue gets a meaning | "100% teal and grey" | undated | prose only |
| Product-UI house style is the first styling on every dashboard | "This more premium feel should be the first styling always." | 2026-09-29 | prose only |
| Not everything is a card | "Not EVERYTHING is a card" | 2026-09-29 | prose only |
| Imagery, colour and decoration follow the content and use case | "A backend professional product like this wont need imagery it should be more professional." | 2026-09-29 | prose only |
| Check the digits before picking a face | "i want to do a easier to read font" | 2026-09-29 | prose only |
| Film: mix shot kinds; none carries the whole film | "a mix of everything" | 2026-09-29 | prose only |
| Film: calibrate to the reference, one notch calmer, never to "restraint" | "i want more flash, this is too dull." | 2026-09-29 | prose only |
| Film: flash follows the use case (demo vs commercial) | "for the use case this is great" | 2026-09-29 | prose only |
| Film: never zoom in and then cut away | "the view just zooms in then cuts very soon after its a bit weird looking" | 2026-09-29 | `scripts/verify-sweep/storyboard-seams.mjs` |
| Film: every spectacle beat says something | "it looks good but i dont feel like it provides or shows anything ... Lacks a purpose" | 2026-09-29 | prose only |
| Review sheets are served by URL and must render | "I cant really tell, almost all the frame screenshots are basically just blank/have nothing in them." | 2026-09-29 | sweep `broken-media` |
