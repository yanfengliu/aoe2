# Standing-loop entry point (2026-09-02, owner)

One of [this repo's local rules](../local-rules.md), where "above" and "below" mean earlier and later in its list.

The canon rule "a standing loop takes its next task from exercising the artifact the way its user does" resolves here to **playing a real match**: `npm run dev`, scenario `aoe2-prototype` (fog on, a real base), default zoom, the human slot — then sweep the whole frame for what is WRONG before choosing what to work on.

**Why:** the owner asked (2026-09-02) for the standing loop to be stated generally enough for every repo, so the fleet rule leaves the entry point to each one. This repo has a runnable game, so "the way its user does" means playing it rather than reading it. An unsteered loop sources work from code instead, which yields refactors and audits — easy to start, easy to declare done, and blind to everything a player hits first.

**How to apply:** the play itself follows "Every feature is playtested the way a human plays" above (`npm run playtest:llm` for a match long enough to reach the mechanic; the mouse-and-keyboard half proved by the browser suite, never assumed). Views come from `scripts/captureMapScreenshot.mjs` per "Rendering is inspected from several angles and zoom levels" above — never a one-off capture, never a showcase fixture. When the default view shows nothing wrong, play DEEPER rather than switching to code: mid- and late-game states are the under-inspected ones, and a Castle-Age mechanic is not reached by a 3000-tick run.
