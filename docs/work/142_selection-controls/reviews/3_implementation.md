# Review round 3: work 142 M2a implementation

Date: 2026-11-04
Revision reviewed: `5fec5564` (branch `selection-controls-m2-1104`, base main `30264cba`)
Reviewer: Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`
Prompt: the M2a acceptance criteria (the villager's card without stances or formations; the villager's two-step build keys; DE's page membership and grid order; the Town Center's keys; the older A, G and P where a card has no DE keys; arrows-only scrolling; the adapted tests; the spec), with the instruction to cite a file and line for every finding and to read outside the diff.
Grounding: the lane read files outside the diff (`src/game/control/HotkeyRegistry.ts:111`, `src/ui/hud/createHudController.ts:406`) and ran the real modules in memory; no sandbox failure (`STATUS_DLL_INIT_FAILED`) in its log. Verdict: repair needed.

## Findings and dispositions

1. **P2, a mouse-chosen building left the keys' page open** (`commandCardHotkeys.ts:55`). Q, then a click on the House, then W chose the Mill. Repaired: the capture-phase listener closes the page on a click on any build card. Test: `de-command-card-keys.spec.ts`, "a mouse-chosen building puts the keys back on the first page", red on `5fec5564` (the build page stayed Economic).
2. **P2, a reselected villager brought back a stale page** (`commandCardHotkeys.ts:64`). W on villager A, select B, select A again, then Q Q placed nothing, since the state still said Military while the panel had reset to Economic. Repaired: the page counts as open only while its tab is the one pressed in the panel. Test: "a villager selected again opens on its first page for the keys", red on `5fec5564`.
3. **P2, a key before the HUD's next frame went to the old card** (`commandCardHotkeys.ts:108`). H then Q within one frame searched the villager's buttons and trained nothing. Repaired: the HUD gained `refreshSelectionPanel()`, which redraws the panel for the selection now, and every grid key calls it first. Test: `tests/app/commandCardHotkeys.test.ts`, "trains a Villager on Q right after the Town Center is selected, before the HUD redraws", red on `5fec5564`.
4. **P2, a Fishing Ship took the villager's two steps** (`commandCardHotkeys.ts:102`). Its Fish Trap needed Q Q, and its A and G lost their older orders. Repaired: a villager's card is a selection of villagers, alone or with their sheep; a Fishing Ship keeps the older keys until M2b gives its card DE's. Test: "keeps attack-move on A for a Fishing Ship", red on `5fec5564`.
5. **P2, a grid key swallowed a letter typed into a dropdown** (`HotkeyRegistry.ts:111`). With the annotation form's Category focused, E did not pick "economy". The registry skipped text inputs but not `<select>`, and the grid made it fifteen letters instead of A, G and P. Repaired: the registry skips a focused `<select>`. Test: `tests/control/HotkeyRegistry.test.ts`, "suppressed when focus is on a select", red on `5fec5564`.
6. **P3, the camera case held W, A, S and D at once** (`voxelCameraController.test.ts:89`), so opposite keys cancelled and it passed on `30264cba`. Repaired: one key at a time; red on `30264cba`'s camera.

Each repair's test went red on the reviewed code and green on the repaired code. Every finding was repaired; none was minor enough to note instead.
