# Review 0: implementation

## Target

Repository aoe2, branch `hidden-unstarted-foundations`, commit `99d449b4` ("Record work 121: register, changelog, devlog and plan status") and its parent `107c7ecb` ("Hide a foundation nobody has started from its owner's enemies (work 121)"), against main `d68f0289` (v0.3.250): 36 files, +1243 −44.

## Reviewers and coverage

- **One independent read-only reviewer** run by the coordinator, who reported the findings below to the implementer. The reviewer read the diff and the worktree, and ran a probe of its own (`probe121.mts`, read-only, in the coordinator's scratchpad), which drove the bridge through five scenes:
  - A: a match with every player allied;
  - B: the human placing a House over an enemy's hidden foundation;
  - C: an older save holding an attack on one;
  - D: an older save's fog-memory entry for one, drawn before the first tick;
  - E: work 116's conversion path with a started foundation.
- The implementer ran the same probe on its branch and saw each scene's result, quoted under the findings below.
- This record is the implementer's short form of what the coordinator relayed. The reviewer's own report is not kept here.

## Reports

Not kept: the reviewer's report reached the implementer only as the coordinator's summary of its findings, which the table below restates in short form. The probe the reviewer ran, `probe121.mts`, stayed in the coordinator's scratchpad and is not repository input; the scene results quoted below are the implementer's own run of it on `99d449b4`.

## Findings and disposition

The verdict: nothing blocking, four should-fix findings and nine nits. All were taken.

| # | Severity | Finding and scenario | Disposition |
|---|---|---|---|
| F1 | should-fix | A refused placement names the hidden foundation and its cell. Probe B: "Placement blocked for house (2x2): blocked by a barracks (building) at (15,10); 4 of 4 footprint cells are blocked. Nearest open ground you can see: (13,12)." The walk-order "Cannot reach" message takes the same causes (`blockerCauseAt` in `placementBlockReport.ts`). | Not fixed here: work 122 is restructuring those files. Recorded in the OPEN register entry of 2026-10-12, which becomes one card with work 122's walk-order leak. |
| F2 | should-fix | An ally's unstarted foundation was remembered in fog once seen, which DE update 46295 fixed ("allied building foundations yet to begin construction were visible in the fog of war"). Three texts said this game never did it. | Fixed: fog memory keeps no unstarted foundation of any other player's. The texts in the spec, `unstartedFoundations.ts` and the register are corrected. Gate: "an ally's unstarted foundation is not remembered once nothing sees it". With the skip narrowed to enemies it is red: "remembered: expected true to be false". |
| F3 | should-fix | Work 116's flip case was replaced, not moved. The unstarted refusal case did not discriminate, because the Monk already stood beside the House and either refusal alone stopped it. | 116's flip case is restored on a started foundation, staged with progress 10. Probe E shows the path: it flips in 50 ticks and is drawn as memory. The refusal case walks the Monk away first. With the order's refusal removed it is red: "the Monk was not sent: expected { x: 13, y: 17 } to deeply equal { x: 12, y: 24 }". The order path never hands the conversion lane a task on a hidden foundation, so the lane's refusal is held by an older-save task case: "still the player's: expected 2 to be 1". The Monk test header is corrected. |
| F4 | should-fix | An attack order on a hidden foundation that an older save holds kept running. Probe C: the foundation went from 120 to 68 hit points. | Fixed: the attack step drops it. Gate in `hiddenUnstartedFoundationEdges.test.ts`, red without the drop: "the order is dropped: expected true to be false". |
| F5 | nit | An older save's fog-memory entry was drawn live from the load until the first tick. Probe D: `[{"isMemory":false,"owner":2}]` before any tick. | Fixed in `fogMemoryOps.ts` and checked before stepping. Red without the guard: "drawn after the load, before any tick: expected true to be false". |
| F6 | nit | The ally case ran in a match already won. Probe A: a match with every player allied is a victory by tick 3. | Fixed: the base fixture has a third, enemy player, and the ally cases assert the match is running. |
| F7 | nit | The AI's own reference point was filtered, and the spec said "oldest" where the code takes the lowest id. | Fixed: the AI measures from its own reference. Only what an enemy may know is filtered, by lowest id. Gate: `hidden-foundation-own-reference-fixture`, red with the filter back on the AI's own entry. |
| F8 | nit | The agent's per-player building counts and the winner oracle's presence count did not use the started rule, so the oracle could disagree with conquest. | Fixed: `entityCountsByOwner` is shared by the oracle, the browser agent API and the corpus script. The agent's counts leave out other players' unstarted foundations. Both are gated and red. The allies-as-enemies list is left alone, as asked: it is an older card. |
| F9 | nit | The defeat message said everything was destroyed while an unstarted foundation stood. | Fixed: "You have no units or started buildings left." Gated and red. |
| F10 | nit | The render state's hiding dependency was optional. | Fixed: `isFoundationHidden` is required. |
| F11 | nit | `targetFindingOps.ts` and `unitCommandOps.ts` stand at 499 lines, and the rule had four names. | Neither file was touched. The API and the dependency names converged on `isFoundationHiddenFrom` and `isFoundationHidden`. |
| F12 | nit | Docs: the §12.1 sentence's references; the Donjon reading for a started foundation; a replay statement like 116's; the changelog's older saves and replays; ARCHITECTURE.md. | Fixed: the §12.1 sentence names its tests, §12.2 calls the Donjon reading unverified and states saves and replays, the changelog covers both, and ARCHITECTURE.md names the module beside `humanSight.ts`, with a drift-log row. |
| F13 | nit | No case for "Spies shows none" or for "splash still reaches one". | Both cases were added. The splash case found the phase-1 claim wrong: a blast hurts units only here (§10.7) and reaches no building. The case pins that a hidden foundation is no exception. |

While repairing F4 the attack step's new drop masked the order's own refusal, and that mutation stayed green. The attack-order case now gives the soldier a standing move order first, which a refused attack must leave alone. With the refusal removed it is red: "its move stands: expected undefined to be 'move'". The repair is commits `aa2a1ea6` and `4688b86a`; 23 mutations were red.

## Verification

On the repair, commits `aa2a1ea6` and `4688b86a`: every gate file passed, about 70 related test files, `tests/architecture`, typecheck and lint passed, and 23 mutations, each restored after, were all red. `npm run verify` did not run in this round; it runs once, under the gate lock, at landing.

## Round outcome

Accepted for repair: nothing blocking, four should-fix findings and nine nits, all taken. The repair went to a focused re-review, recorded as round 1.
