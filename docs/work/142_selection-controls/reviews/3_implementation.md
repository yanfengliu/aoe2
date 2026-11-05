# Review 3: implementation

## Target

aoe2, work 142 M2a, the villager's command card and the Villager and Town Center keys: commit `5fec5564` ("Work 142 M2a: the villager's command card and its keys as in DE") on branch `selection-controls-m2-1104`, its diff against main `30264cba`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane. The prompt gave the M2a acceptance criteria (the villager's card without stances or formations; the villager's two-step build keys; DE's page membership and grid order; the Town Center's keys; the older A, G and P where a card has no DE keys; arrows-only scrolling; the adapted tests; the spec) and asked for a file and line for every finding and a read outside the diff. The lane read `src/game/control/HotkeyRegistry.ts:111` and `src/ui/hud/createHudController.ts:406`, outside the diff, and ran the real modules in memory; its log holds no sandbox failure (`STATUS_DLL_INIT_FAILED`). It did not run the browser suite, and remote CI was out of its reach.

## Reports

### Codex (`gpt-6-astra`)

Five P2 findings and one P3, verdict "repair needed": a building chosen by mouse left the keys' page open; a villager selected again brought back a stale page; a key pressed before the HUD's next frame searched the previous selection's buttons; a Fishing Ship took the villager's two steps; the fifteen grid letters swallowed a letter typed into a focused dropdown; and the new camera case held W, A, S and D together, so opposite keys cancelled. It found the adapted tests kept their assertions and no file over the size cap.

## Findings and disposition

1. **P2, a mouse-chosen building left the keys' page open** (`commandCardHotkeys.ts:55`): Q, a click on the House, then W chose the Mill. Repaired: a click on a build card closes the page. Test: `de-command-card-keys.spec.ts`, "a mouse-chosen building puts the keys back on the first page", red on `5fec5564`.
2. **P2, a reselected villager brought back a stale page** (`commandCardHotkeys.ts:64`): W on villager A, select B, select A, then Q Q placed nothing. Repaired in `0fbf73ae` by requiring the page's tab to be pressed; round 4 found that only half a repair (the Economic page), and the final repair takes the open page from the panel. Test: "a villager selected again opens on its first page for the keys", red on `5fec5564`.
3. **P2, a key before the HUD's next frame went to the old card** (`commandCardHotkeys.ts:108`): H then Q within one frame trained nothing. Repaired: `HudController.refreshSelectionPanel()` redraws the panel for the selection now, and every grid key calls it first. Test: `tests/app/commandCardHotkeys.test.ts`, "trains a Villager on Q right after the Town Center is selected, before the HUD redraws", red on `5fec5564`.
4. **P2, a Fishing Ship took the villager's two steps** (`commandCardHotkeys.ts:102`). Repaired: a villager's card is a selection of villagers, alone or with their sheep; a Fishing Ship keeps the older keys until M2b. Test: "keeps attack-move on A for a Fishing Ship", red on `5fec5564`.
5. **P2, a grid key swallowed a letter typed into a dropdown** (`HotkeyRegistry.ts:111`): with the annotation form's Category focused, E did not pick "economy". Repaired: the registry skips a focused `<select>`. Test: `tests/control/HotkeyRegistry.test.ts`, "suppressed when focus is on a select", red on `5fec5564`.
6. **P3, the camera case held opposite keys together** (`voxelCameraController.test.ts:89`) and passed on `30264cba`. Repaired: one key at a time, red on `30264cba`'s camera.

## Verification

Each repair's test went red on the reviewed code (the camera case on `30264cba`) and green on the repair, in its unit file or in `de-command-card-keys.spec.ts` built from the matching source. The full gate on the repair commit is recorded in round 4.

## Round outcome

All six findings repaired in `0fbf73ae`; none was minor enough to note instead. Finding 2's repair was partial and went back to round 4.
