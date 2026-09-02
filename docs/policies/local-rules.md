# Local rules — aoe2

Repo-scoped directions that outlive the task that produced them. Fleet-wide rules live in `../fleet/FLEET.md`; this file is only for things true of *this* repo.

## HUD styling: modern, not medieval (2026-08-18, owner)

The interface chrome targets a **modern** look — translucent dark-glass panels, one hairline border, soft two-part elevation, a token palette, generous radii — and explicitly NOT the AoE2-era framed wood-and-stone treatment that shipped in v0.1.38.

**Why:** the owner asked for "a modern looking UI" directly. The earlier direction came from the "perfect AoE2 HD clone" north star, which still holds for the **world** (terrain, units, buildings, effects). Only the HUD surface direction changed.

**How to apply:** every HUD colour comes from the tokens in `styles.css:root` (`--hud-surface*`, `--hud-hairline*`, `--hud-text*`, `--hud-accent`, the per-resource hues, and the radius/elevation scales). Do not reintroduce a raw colour literal into a HUD rule — `tests/ui/hudPalette.test.ts` fails on the retired wood-and-stone literals and holds text contrast against a translucent panel over sunlit grass. `hudChrome.css` owns the chassis, `hudCommandPanel.css` the components inside it, `hudIcons.css` glyph sizing.

Authoritative description: `design/spec-final.md` §14.1 "HUD chrome".

## The HUD holds its shape, and nothing floats over the minimap (2026-09-02, owner)

Entering a mode — placement, a menu, a queue filling up — must not move, shrink, or hide the controls the player was just using (a label may make room for the mode's own pill; a button may not move), and no floating element (tooltip, toast, badge) may cover the minimap.

**Why:** the owner asked for the UI to be "elegant" the day they found, by playing, that clicking a build card collapsed the build palette to a sliver and put its tooltip on the minimap. The bar is a flex row with exactly one member that absorbs width changes, so a status rendered as a sibling took its width from the palette; and a positioner that clamps to the viewport does not clamp to the HUD. Both are the kind of defect a boot screenshot never shows and a player finds in the first minute.

**How to apply:** a mode's announcement goes INSIDE the group it describes (the placement pill lives in the Build heading), never as a new sibling of the bar. Floating elements are positioned against the HUD's surfaces, not only the viewport — `tooltips.ts` floats a command-bar tooltip above the bar and slides it clear of `.hud-panel--map`. A change to the bar is checked at both its regimes (wrapped below 1120px, unwrapped above) and at 1280x720, the laptop width where the palette is narrowest; `tests/browser/placement-mode-hud-layout.spec.ts` is the shape of that check, and it measures VISIBLE width (the rect clipped by the scrolling panel), because a layout box keeps its min-width after the panel has clipped it. Register entry: 2026-09-02.

## Rendering is inspected from several angles and zoom levels (2026-08-23, owner)

Whenever the rendering changes, look at the result from **multiple camera angles and multiple zoom levels** before calling it done — not one framing, and not only the region that was edited.

**Why:** the owner asked for it directly, and this repo has paid for it repeatedly: v0.3.34's black-bordered diorama, v0.3.36's tan hill blotches, and v0.3.33's 620px selection panel were all invisible from the framing the author happened to choose and obvious from another one. The fleet canon states the principle ("sweep several camera angles and zoom levels"); this entry is the repo-specific form with the tools named.

**How to apply:** this renderer's isometric angle is FIXED, so "several angles" here means several framings — `scripts/captureMapScreenshot.mjs` takes `SEED`, `LABEL`, `FOCUS="x,y"`, `ZOOM` (camera clamp 0.7-2.4, opens at 2.0), and `SIZE="WxH"` env vars, so every view in a sweep comes from the maintained script rather than a one-off — capture at minimum a default-zoom view of the real default scenario (`aoe2-prototype`, with fog and a real base — see [lessons](../learning/lessons.md)), a zoomed-in view of the thing that changed, and a zoomed-out view of the whole map. Both scripts write under the gitignored `tmp/captures` (override with `OUT_DIR`), because a capture is task-run evidence rather than a repository input. Pair the before/after of the changed region with `scripts/diffMapScreenshots.mjs` — capture twice as `LABEL=<stem>-before` / `LABEL=<stem>-after`, then diff with `LABEL=<stem>` — per the AGENTS.md visual invariant, and read the diff against this game's ~1% animated noise floor. The last look is always a whole-frame sweep for what is WRONG, including parts the change never touched.

## Every feature is playtested the way a human plays (2026-08-23, owner)

A feature is not done when its tests pass — it is done when a full match has been played with it. Use the playtest infrastructure the engine and this repo already ship (`npm run playtest:llm`, `playtest:corpus-llm`, `playtest:findings`, `replay:inspect`, `run-oracles`); do not hand-write a synthetic probe where the harness would answer the question.

**Why:** owner directive, and the standing evidence is the whole v0.3.29–v0.3.30 arc — siege production shipped green and could not fire in a real match, and the AI's economy had been frozen since roughly tick 6000 for versions on end with every unit test passing. "Adding to a system does not prove it RUNS" is already the top line of [lessons.md](../learning/lessons.md).

**How to apply:** the agent plays the HUMAN slot (player 1) against the in-game AI, reads the rendered screen, and plays a match long enough to reach the mechanic under test — a Castle-Age technology is not exercised by a 3000-tick run. Orders may ride the JSON command bridge (owner decision, 2026-08-23: it is the reliable surface), but **anything a human is supposed to be able to do must also be reachable with the mouse and keyboard**, and that half is proved by the Playwright browser suite, not assumed. `playtest:findings` turns each run into the objective backlog; the harness only ever observes and reports (§15.7).

## Behaviour matches the real Age of Empires II (2026-08-23, owner)

The game must **function identically to the real Age of Empires II** — same costs, rates, counters, tech-tree gating, controls, and consequences. A divergence is a defect even when nothing in this repo asserts the correct value.

**Why:** owner directive 2026-08-23. It is the standing tiebreak for every "is this good enough?" question: the answer is whatever the real game does.

**How to apply:** resolve rules in the [§1 source-of-truth order](../../design/spec-final.md) — `design/stats/` CSVs first, then the spec, then official references. **Definitive Edition is the authoritative edition** (owner, 2026-08-23: "HD" in the directive is shorthand for the real game, and the CSVs are DE-derived); where an HD-era rule differs from DE, DE wins and the choice is recorded. A remembered game rule is a hypothesis — verify it against an authoritative reference before implementing to match it ([lessons.md](../learning/lessons.md)). Two deliberate exceptions, both owner-set and both about LOOK rather than behaviour: the HUD chrome is modern (above), and all art is original/procedural rather than reproduced AoE2 assets.

**Restated by the owner 2026-09-02, mid-play-test:** "The rendering needs to feel realistic. The UI needs to be elegant. Game needs to be well optimized and correct. Bug free." This does not change the north star above — realism is for the WORLD within the original voxel art direction, elegance is the HUD's "modern looking UI" — but it fixes the order of proof: a change to either surface is judged by playing it, not only by a passing test, and the play test that found the placement-mode panel collapse is the template.
