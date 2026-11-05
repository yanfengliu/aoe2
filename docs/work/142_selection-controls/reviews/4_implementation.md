# Review 4: implementation

## Target

aoe2, work 142 M2a, the round-3 repairs: commit `0fbf73ae` ("Repair work 142 M2a after review round 3 (Codex)"), its diff against `5fec5564`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane, focused on whether each round-3 repair holds and whether its test fails on the older revision, and on what the repair could break: the synchronous panel redraw, the page-open rule, the villager-card rule and the skipped dropdown. It read outside the commit (`src/ui/hud/selectionPanel.ts:209` and `:481`, `src/game/simulation/bridge/selectionStateOps.ts:385`, `src/main.ts:17`, `src/app/bootstrap/createApp.ts:322`) and ran the real panel and key modules in memory; its log holds no sandbox failure. It did not run the browser suite.

## Reports

### Codex (`gpt-6-astra`)

Two P2 findings, verdict "repair needed". Round-3 findings 1, 3, 4, 5 and 6 are fixed and their tests fail on the older revision; finding 2 is fixed for the Military page only. `refreshSelectionPanel()` itself was checked for affordability, focus, tooltips, placement, a bridge swapped by a save-load and a call after destroy, with no defect. The villager-card rule matches what the selection state produces, and skipping a focused `<select>` leaves its own keys, Escape included, to it; the lobby's selects never meet the game's keys.

## Findings and disposition

1. **P2, an Economic page opened on a villager survived its reselection** (`commandCardHotkeys.ts:73`): select A, Q, select B, select A, then W placed a Mill instead of opening Military, because a pressed Economic tab cannot tell a chosen page from the panel's default. Repaired at the root: the open page is now the panel's own chosen page, drawn as `data-build-page-chosen` on the Build group, which the panel already forgets when the selection changes; the key handler keeps one flag of its own, set when a building is chosen and cleared when a page is opened. The panel's redraw signature now carries the chosen page, so choosing the page already shown redraws the flag. Test: the reselect case in `de-command-card-keys.spec.ts` now opens Economic first, then reselects, then presses W; red on `0fbf73ae` (the page stayed Economic and a Mill was placed).
2. **P2, a tab clicked on a panel still drawn for the previous selection lost the next key** (`commandCardHotkeys.ts:109`): select B while A's card is still drawn, click Military, press Q before the HUD's next frame, and no Barracks is placed. Repaired: a click inside the selection panel first redraws it for the selection now (capture phase, before the button's own handler), so the click lands on B's card. Not covered by a test of its own: it needs a click and a key inside one frame, which a browser test cannot time, and the unit harness has no real panel; listed as not checked.

## Verification

The round-4 reselect case went red on a build of `0fbf73ae` and green on the repair, with the rest of `de-command-card-keys.spec.ts`, `selection-controls.spec.ts`, `selection-panel-height.spec.ts`, `placement-mode-hud-layout.spec.ts` and `play-opening.spec.ts`; the full gate ran on the final commit (see the plan's M2a outcome).

## Round outcome

Both findings repaired; finding 2 without a dedicated test, as stated above. No further round: the remaining risk is one sub-frame ordering, noted rather than reviewed again.
