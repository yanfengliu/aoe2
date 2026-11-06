# Selecting units as in Definitive Edition

Status: active
Owner: de-selection worker for the Claude coordinator
Created: 2026-11-06
Updated: 2026-11-06

M1 landed as v0.3.272 (Outcome). M2, the group panel, is for a fresh worker: its starting state is under "M2 starting state".

## Problem and outcome

Plan 106's two cards from work 142: selecting units does not work as in Age of Empires II: Definitive Edition (DE). On the map, Shift+click and Shift+drag replace the selection where DE's add to it, Ctrl+click selects the unit alone, and a selection has no cap where DE's holds 60 (M1). The group panel shows one chip per type with a count, where DE's shows one icon per unit with its hit-point bar and answers DE's clicks and modifiers (M2). The outcome: a player selects units as in DE.

Reproduced on main f2f3b338 (v0.3.271) in a lobby-default match through the real Start Match at 1280x720, by real mouse and keyboard (`tmp/probes/repro-modifier-select.mjs` in the worktree, the game muted): a click on villager A selected A; Shift+click on villager B selected B alone; Ctrl+click on villager C selected C alone; A, then a Shift box over the Scout, selected the Scout alone.

## Scope

M1: Shift and Ctrl with a click or a box on the map, and the 60-unit cap. M2: the group panel, one icon per unit with its hit-point bar, its clicks and modifiers, and DE's rule when more units are selected than the panel shows. Not in scope: a building's gather point flag (stays on plan 106's card), the AI (work 147), combat, gathering, the simulation's rules, civ-engine and voxel, `AGENTS.md`. Findings outside scope go to plan 106, tagged "(work 146)".

## Approach

### DE rules, with sources (M1)

Read from the install (`resources/_common/dat/hotkeys.json` through `scripts/dumpDeHotkeys.mjs`, `selection_group_def.json`, `resources/en/strings/key-value/key-value-strings-utf8.txt`), DE never launched, then official and community sources.

1. **Shift adds, by a click or a box.** "Learn to play", Lesson 1 (https://www.ageofempires.com/learn-to-play/control-resources-aoe2/): "Holding down Shift allows you to select multiple units at the same time through individual selection or multiple selection boxes." A DE player at DE's release (Steam discussion 2803982773098068575, 2019-11-27): "in all previous versions of AoE2, you could ctrl+click+drag to add more units to your current selection. In DE it appears to have changed to shift+click+drag." What joins is what a plain box takes (work 142's rule 1: the player's own units and livestock).
2. **Ctrl+click takes a selected unit out.** A DE player, forums.ageofempires.com t/74555 (2020-03-27): "If you hold ctrl when left clicking on selected units it deselects them." DE's group panel takes a unit out on Ctrl+click too (strings 43121-43122), and the AoK/HD reverse engineering (openage, "Selecting and Deselecting") gives Ctrl+click as the key that adds or removes single units, whose adding half DE moved to Shift (rule 1).
3. **Ctrl+click on anything not selected changes nothing.** The one DE report (Steam discussion 2803982773098068575, 2019-11-18): "in the original game ... you could hold down control and you would select the new units without deselecting the ones previously selected. Now when i hold down control only the ones i already selected remain." Weakly sourced (it may describe a box); listed below.
4. **Ctrl has no box meaning by default.** String 98871 gives Ctrl a military-only box and Alt a civilian-only box only under the option "Selection Modifier Hotkeys" (8896), which work 142 read as off by default (plan 106's owner decisions). So Ctrl+drag is a plain drag here, as before, and Ctrl+Shift+drag a Shift drag.
5. **The cap is 60.** No file in the install states it. DE players: "What was the reasoning for a sixty-unit selection limit?" (forums.ageofempires.com t/226116, 2023-03-03, with "the 60 selection limit"); t/72939 (2020): the select-all military key "doesn't select all military units if there are more than 60", and "the only issue is fitting more than 60 thumbnails of selected units into UI". The openage reverse engineering: "AoE2 allows the player to select up to 40 units (60 in AoE2 HD)". Every way to select is capped.

### Unsourced, the closest sourced behaviour taken (also for plan 106's "Owner decisions waiting")

1. Whether a Shift+click on a selected unit takes it out (as StarCraft's and AoE IV's do). DE's sources give Shift only as adding and Ctrl as the key that takes a unit out, so here it keeps the unit selected.
2. Ctrl+click on a unit not selected, and on the ground: here nothing changes (rule 3's report); AoK/HD added the unit.
3. Shift+click on the ground, on another player's unit, a building or a resource with units selected, and a Shift box over nothing: here nothing changes, as Shift only adds; with nothing selected a Shift+click selects as a plain click does, and a Shift+click on your own unit while a building is selected replaces the building, as a box would.
4. Which units DE keeps past 60. AoK's box filled its 40 "from the top to the bottom of the box" (openage); here the first 60 in the gesture's own order: a box row by row and then column of where each unit is drawn (`marqueePreviewEntities`), a double-click in its existing order, a control group in its stored order, and an addition keeps what was already selected.
5. Two quick Shift clicks at one place add the type on screen; Ctrl+Shift+click is a Ctrl+click.

### Changes (M1)

- `src/game/simulation/selectionLimit.ts` (new): `SELECTION_LIMIT = 60`, cited. `bridge/selectionInputOps.ts`: `selectUnitIds` and `selectByRefs`, the two writers of a many-unit selection, keep the first 60.
- `bridge/selectionModifierOps.ts` (new): `addUnitsToSelection` and `removeFromSelection`, on the bridge (`SimulationBridge`, the replay bridge) through `wireBridgeOps`' `selectionMutation`, so a paused frame draws the change.
- `src/input/voxelSelectionController.ts`: a click with Shift or Ctrl goes to `modifierClick` (rules 1-3 and the defaults above); `voxelPointerInputController.ts` passes the release's Shift and Ctrl, and a Shift box adds; `AoeVoxelGameView.ts` passes them through.
- Fixture `selection-cap-fixture` (64 Militia in an 8x8 block), in work 142's fixture family.

**Behaviour changed for existing gestures.** Only modifier gestures: Shift+click, Shift+drag and Ctrl+click, which acted as plain ones, and every selection of more than 60, which is now 60. A plain click, a plain drag, a double-click, Ctrl+drag and the control-group keys are unchanged under 60 units.

### Tests

- `tests/simulation/selectionModifiers.test.ts`, twelve cases through the real bridge: Shift's order, what joins, the replaced building selection, Ctrl, and the cap for a box, a ref selection, Shift and a control group. All twelve red on f2f3b338 (no `addUnitsToSelection`/`removeFromSelection`; 64 selected).
- `tests/browser/de-selection-modifiers.spec.ts`, five real-mouse, real-key cases; every click is refused if a HUD panel covers its point (an early version of the cap case clicked the panel and could not fail). All five red with f2f3b338's four input and selection files put back (`tmp/redproof.mjs`), each at its first new claim. Eight mutants, each red (`tmp/mutate.mjs`): Shift+click on a selected unit taking it out, Ctrl+click on an unselected unit selecting it, Ctrl+click and Shift+click on the ground clearing, Shift+click on another player's unit selecting it, an empty Shift box clearing, no cap, a cap of 61.
- Review round 0 ([record](reviews/0_implementation.md), Codex on `3318260f`): two P2, both repaired with a test red on `a1da5d3c`. A quick Shift click on the ground beside a Shift-clicked unit read as a Shift double-click and added the whole type (`tests/input/selectionModifierClicks.test.ts`, with a positive case for two Shift clicks on the unit); a Shift click on a unit already in a mixed selection (a building and a unit, which a control group's Shift can make) replaced the selection (`selectionModifiers.test.ts`, now thirteen cases).
- **Adapted:** `tests/app/clickHitTestDrawsOnlyWhatWaits.test.ts` expects the view to pass the click's modifiers on (an extra `undefined` argument); `tests/simulation/selectionControlsScenarios.test.ts` lists the new seed beside the others. Same assertions otherwise.

### M2 starting state (for a fresh worker)

The outcome, from the brief: the group panel shows each selected unit as its own icon with its hit-point bar, and answers DE's clicks and modifiers; when more units are selected than the panel can show, it follows DE's rule. Visual change, so before and after captures and a pixel diff confined to the panel (the maintained `scripts/captureMapScreenshot.mjs` with `SELECT`, and `scripts/diffMapScreenshots.mjs`), at the default view and one random view, with a mixed group selected.

**Sourced so far (M1's search; DE never launched).**
- Lesson 5, "The Command Menu" (https://www.ageofempires.com/learn-to-play/control-resources-aoe2/): "When you select multiple units, the UI will display the number of units selected, the selected unit's icons and current Hit Point bar."
- The install's string table, the panel's tooltips: 43121 "Click to select only this %s. Hold down CTRL and click to unselect this unit." and 43122 the same plus "Hold down SHIFT and click to select all units of this type. Hold down CTRL+SHIFT and click to unselect all units of this type." Which of the two DE shows when is not known (perhaps 43121 for a unit alone of its type). 42120-42122 are older forms ("Hold down SHIFT and click to unselect this %s"; "... Hold down SHIFT and click to select like units"), and 43133/43135 are the garrison panel's equivalents. So: a click selects only that unit, Ctrl+click drops it, Shift+click keeps its type, Ctrl+Shift+click drops its type.
- The openage reverse engineering of AoK/HD ("Selecting and Deselecting", "Selection queue actions"): the same three modifiers on the HUD's unit icons, and "These commands also work for garrison queues".
- How many icons: the panel shows one per selected unit up to the cap of 60, all of them; DE players: "the only issue is fitting more than 60 thumbnails of selected units into UI" (forums.ageofempires.com t/72939, 2020) and "you'd need an interface redesign to reliably fit all individual portraits into the panel with no selection limit" (t/226116, 2023). Order: "Currently they are sorted by type, but those types are sorted randomly" (t/72939, 2020-03-01). Size: DE's icons are "much smaller" than HD's (same thread). Nothing found on how DE lays out 60; the install's `widgetui/commandpanel.json` describes only the single-selection panel (`ObjectImage`, `HPProgress`, `ObjectHealth`); the multi-selection grid is not in the files.

**Where the panel lives.** `src/ui/hud/selectionPanel.ts` (426 lines) and `src/ui/hud/selectionPanel/render.ts` (388; `renderSelectionIcons` builds one chip per type with an `x{count}` badge, `data-selection-unit-chip` and `data-selection-unit-count`), styles in `src/hudCommandPanel.css`, `src/hudIcons.css` and `src/styles.css`, glyphs from `src/ui/hud/icons/unitGlyphs.ts`. The data: `getSelectionState().selectedEntityIds` (ordered, the primary first) and the bridge's `getEntityHealth(id)`; the clicks can use M1's bridge ops `selectUnitsByIds`, `addUnitsToSelection` and `removeFromSelection` (`src/game/simulation/bridge/selectionModifierOps.ts`), which keep the cap (`SELECTION_LIMIT`, `src/game/simulation/selectionLimit.ts`) and mark a paused frame. Three specs assert the chips (`selection-controls`, `game-selection-click`, `de-building-go-to-keys`); `selection-panel-height.spec.ts` and the local rule "The HUD holds its shape" bound the panel's size.

**Learned in M1.** At 800x600 a selection opens the panel to about y 352, over the lower world, and the shared `clickCanvasAtPoint` behind `clickUnit` clicks under it without complaint (plan 106's card); `clickOnCanvas` in `tests/browser/de-selection-modifiers.spec.ts` refuses a covered point. The fixture `selection-cap-fixture` (64 Militia, 8x8 from (20,20)) selects 60 by a box when the camera is centred on (27,27) at zoom 0.8: the panel's 60-icon case. The page sets no `user-select: none` (plan 106's card), so clicks on the panel can select its text. M1's red proofs put the base revision's files back and bundled with vite alone, since the old sources no longer typecheck against new tests; mutants were exact string swaps, each bundled and run on one spec.

## Acceptance criteria

- [x] M1 (landed as v0.3.272): Shift+click and Shift+drag add, Ctrl+click takes out, the cap holds; real-click browser tests and unit tests, each red with the defect put back; spec §9.4; verify green with a passing receipt; independent review recorded; a lobby-default match driven through Start Match with Shift and Ctrl.
- [ ] M2: the group panel as DE's, with before and after captures and a pixel diff confined to the panel.

## Implementation steps

- [x] Source the rules and reproduce in the real game.
- [x] M1 tests first, red on the old code; implement; mutants.
- [x] M1 gate, review, live check, phase-1 handoff; phase 2 landing (v0.3.272).
- [ ] M2, both phases, for a fresh worker (starting state below).

## Outcome

M1 phase 1 (2026-11-06): branch `de-selection-1106` holds `3318260f` (M1), `a1da5d3c` (merge of main `17e4068b`, docs only), `c9a7b9a4` (round-0 repairs), `5de70013` (the round's record) and this record. Gates: on `a1da5d3c` vitest 5,421 passed and 3 skipped, Playwright 327 passed and 2 skipped, receipt OK; on `5de70013` vitest 5,424 passed and 3 skipped, Playwright 327 passed and 2 skipped, receipt OK. Live check on the branch: a lobby-default match through Start Match at 1280x720, muted, real mouse and keyboard: a click on a villager, Shift+click on a second ("2 Villagers Selected"), Ctrl+click on a third not selected (unchanged), Ctrl+click on the second ("Villager"), then a Shift box over the Scout ("2 Units Selected", both ringed); no page text was selected by the Shift clicks, also after a click on the panel's title. Not checked: a full match played with these keys; DE itself (never launched), so every unsourced default above; Chrome's own Ctrl+click on macOS (a right-click there); the cap through a select-all building key or a control group in a browser (unit tests only); layouts other than US. The version bump, the landing, plan 106's cards and owner-decision lines wait for phase 2. M2 has not started.

M1 landed (2026-11-06) as v0.3.272: one commit on main after `17e4068b`, squashed from branch `de-selection-1106` (`3318260f`, `a1da5d3c`, `c9a7b9a4`, `5de70013`, `37279221`), which the coordinator accepted at `37279221`; those commits, the reviewed `3318260f` among them, are kept on the local branch `retained/de-selection-1106`. The landing commit is `559307c9`. Plan 106 holds the card's shipping line, the five owner-decision defaults and two new cards (the click helper under the HUD, the HUD's selectable text), each tagged "(work 146)". M2 goes to a fresh worker, its starting state above.

M1's landing checks. The gate on `559307c9`, under the lock: vitest 5,424 passed and 3 skipped, Playwright 327 passed and 2 skipped, receipt OK. CI run 42217726524 on `559307c9` passed all ten jobs at its first attempt, each read from its own log: the unit shards ran 1,937, 1,683 (2 skipped) and 1,803 (2 skipped) tests on each runner, in 14.2, 13.7 and 6.1 minutes on Ubuntu and 18.9, 11.1 and 12.7 on Windows (1/3 the longest, all under 40); the browser shards ran 87 (2 skipped), 81, 80 and 78 (1 skipped) in 15.3, 12.1, 13.0 and 7.6 minutes. The new spec ran in shard 2/4: its cap case took 8.7 s (29% of its 30 s limit), its Shift-drag case 7.5 s, and the other three each under 7.3 s, the cutoff of the shard's slowest-tests list. Playtest-corpus run 42217726298 passed. The worktree and its landing branch are retired.
