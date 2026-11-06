# Review 1: implementation (M2)

## Target

aoe2, work 146 M2: DE's group panel (one icon per unit with its hit-point bar, sorted by type, its four clicks) and the press that holds the panel's redraw. Commit `0f65b185` on branch `de-selection-m2-1106`, its diff against `e4ca37c1` (main, which the branch had merged; the merge brought only docs) for `src`, `tests` and `design`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder under fleet's ignored `tmp/review-runs/`. The prompt gave the task's criteria and sources, the binding decision on plain gestures, and asked it to look at the click's member list against the HUD's capture-phase redraw, every way a press could fail to release or hold a redraw it must not, `keepSelected` (refs, order, the paused renderer, replay, placement), the markup and its per-frame writes, both viewport regimes, the six adapted tests and the fixture, and the spec against the code; it asked for a file and line per finding and a read outside the diff, and told it to run no tests, builds or browsers, since the full gate was running in the tree. The lane's log shows no sandbox failure (the runbook's check: `keep`, no failed commands); the tree's status and diff were the same before and after the run. Claude's lane was not run: Codex's read-only sandbox was preferred by the brief.

## Reports

### Codex (`gpt-6-astra`)

Five P2 and one P3. The report, redacted only of its absolute paths:

1. P2: type-changing upgrades leave group clicks using stale member types. `selectionPanel.ts:133`: `lastMembers` refreshes only when the whole panel redraws; a mixed selection's `selectedEntityType` stays `null` when one member upgrades, and member types are not in the signature, so the capture-phase sync need not refresh them. Reading reproduction: an idle Scout as primary, an Archer and a converted Crossbowman, Crossbowman researched: both ranged units are Crossbowmen, but `lastMembers` still tells Archer from Crossbowman, so Shift+click keeps one subset and Ctrl+Shift+click removes one.
2. P2: a held press keeps hotkeys from reading newly available commands. `selectionPanel.ts:185`: the structure key leaves out the command lists, and the hold also suppresses the explicit refresh the card's keys ask for. Reading reproduction: the Town Center selected with the Feudal Age nearly researched, the main button held on the panel's background; once the research completes, S finds no Wheelbarrow button in the held card.
3. P2: sixty icons do not fit the wide, short viewport. `hudCommandPanel.css:144`: at 1280x600 the 36vh ceiling limits the band to 216px; the five-row grid needs 143px, the gap and the panel's padding and borders 38px more, which leaves 35px for the heading, so the last row is below the visible band. From the CSS arithmetic, not rendered; the browser cases cover 800x600 and 1280x720 only.
4. P2: routine redraws drop keyboard focus on member icons. `selectionPanel.ts:202`: focus is restored only by `data-command` and `data-build-page`; a member icon focused from the keyboard loses its focus and its keyboard tooltip at the next redraw (a building group's queue tick, a moving group).
5. P2: the held-click browser test can pass without a tick during the hold. `de-selection-group-panel.spec.ts:293`: `atPress` is read before the awaited mouse move and press, so two ticks can pass before the press and the first poll succeed at once, letting a short click pass that also works without the fix. Read the baseline after the press.
6. P3: "A fight redraws nothing" overstates the implementation. `spec-final.md:2027`: hit points alone redraw nothing, but the signature still holds the primary unit's position, the activity breakdown and the membership, which a fight changes.

It also reported: the six adapted test files keep their principal checks (the click and marquee specs no longer check the "V" and other badges; the others keep type coverage and counts); the deps-only change to `selectionPanelCommands.test.ts`; the wounded fixture keeps the 64-unit arrangement; outside the diff it read `commandCardHotkeys.ts`, `selectionStateOps.ts`, `selectionInputOps.ts`, `wireBridgeOps.ts`, `makeReplayBridge.ts`, the tooltip handling and the research, upgrade and conversion paths; `keepSelected` keeps order and generations, prunes dead refs and reaches the paused and replay redraws; no change to the map's selection and no reachable escaping defect with the fixed name tables; the paused DOM-write gate selects nothing, so it does not cover the bars' refresh.

## Findings and disposition

All six repaired in the commit after `0f65b185`; each repair's test is red on `0f65b185`'s source (`tmp/redproof-r1.mjs`: the reviewed revision's nine source files put back, the tests kept, bundled with vite alone).

1. FINDING-1 (P2): the selection state carries each member's own type, `selectedEntityTypes` (in `selectedEntityIds`' order, from `selectionStateOps.ts`), and the panel draws its icons and acts on its clicks from it, so a member that upgrades changes the state, redraws its icon and is clicked as its new type. Tests: `tests/simulation/selectionEntityTypes.test.ts` (the list through the real bridge, two cases) and a DOM case where a member's slot turns from villager to Militia and Shift+click on a Militia keeps the three; all red on `0f65b185`.
2. FINDING-2 (P2): the HUD's `refreshSelectionPanel`, which every card key calls first, now redraws with `force`, which no press holds. Test: a DOM case holding a press while stance buttons appear, where a frame does not draw them and the forced redraw does; red on `0f65b185` (no `force`).
3. FINDING-3 (P2): reproduced by measurement: on the reviewed CSS at 1280x600 the browser case's icons fell outside the band. Above 1120px wide and below 684px tall, where the ceiling clamps the band, the grid is four rows of fifteen 18px icons (`@media (min-width: 1121px) and (max-height: 683px)`), which fits down to 536px tall. Measured on the repair, sixty Militia with no scroll at 800x600, 1024x768, 1280x720, 1920x1080, 1280x600 and 1366x650, and sixty icons beside a villager's palette at 800x600, 1024x768, 1100x700, 1280x720 and 1920x1080. Test: the sixty-icon browser case now also runs at 1280x600, red on `0f65b185` ("icons drawn outside the bar"). The spec's "every viewport from 800x600" became that list and its bound.
4. FINDING-4 (P2): a focused member icon is focused again by its unit after a redraw, while the unit is still selected; the tooltip controller now tells member icons apart by unit, not by their shared text (`tooltips.ts`), so pressing one villager's icon no longer takes the keyboard tooltip from another's. Tests: a DOM case (red on `0f65b185`) and a case in `tests/ui/tooltipFocus.test.ts` (red on a mutant keying by text).
5. FINDING-5 (P2): the held-click case reads the queue's remaining ticks after the press, waits for them to move on, then for three drawn frames, before the release. Also found by the full gate on `0f65b185`: the sorted-by-type case read the panel before the HUD's next frame had drawn the selection; it now waits for the panel's name. Both cases pass on the reviewed and repaired source alike, as test fixes should.
6. FINDING-6 (P3): the spec, the register entry and the code comment now say a change of hit points alone redraws nothing; a change the panel draws, such as the group's work or the primary unit's cell, still redraws the icons. A DOM case checks that a still frame writes nothing to the panel, which the paused DOM-write gate could not (it selects nothing); green on both, as the property already held.

## Verification

On the repair: the panel's unit and DOM cases, the bridge case and the tooltip case pass, and the browser spec passed three times in a row (24 of 24). Round 1's mutants, each red: the members all given the first member's type, no `force`, no member focus, no short-window grid, the tooltip keyed by text. The full gate on the repair is recorded in plan 146.

## Round outcome

Five P2 and one P3, all repaired, each with a test red without its repair. No further round: each repair is small and checked by its own test, and the brief's review asks for the findings that matter to be fixed and checked rather than a second round.
