# Review 1: implementation

## Target

aoe2, work 142 M1, the round-0 repairs: commit `a51123f2` ("Repair work 142 M1 after review round 0 (Codex)"), its diff against `fed8203e`, SHA-256 `9e85ee566ab824ac21a95a2d52a6fd73fe156ed1c939dbe12c5f5e2a91be0279`. The tree the reviewer read was at `fd2632ea`, which also merges main `496ee0e9`; main's own changes were not under review.

## Reviewers and coverage

- Codex `gpt-6-astra`, `model_reasoning_effort=xhigh`, `--sandbox read-only`, codex-cli 0.163.0, serial with no delegation. It read the repair diff and the tree, cited files outside the diff (`src/rendering/voxel/aoeVoxelEntityPrep.ts`, `src/audio/mountGameAudio.ts`, `tests/browser/attack-ground-hotkey.spec.ts`), ran the typecheck and 32 focused tests, and made in-memory mutations and probes (3,458 overlapping hit checks for the new order). The Codex log check printed `keep 0 lines of failed commands`. Browser tests and the full gate were not run by it.
- Claude lane: not run, as in round 0.

## Reports

### Codex (`gpt-6-astra`)

Four findings: two P2 correctness issues and two P3 test gaps. **F1 is only partly resolved.** No files were modified.

1. **P2 — Visibility uses the wrong pose.** `selectionMembers.ts:38` rebuilds default parts, losing facing, gait, work and attack poses—not just the documented idle motion. The actual renderer supplies animation state through `aoeVoxelEntityPrep.ts:121`, **outside the repair diff**. A moving-villager probe produced a 6.64 iso-pixel horizontal difference, allowing both missed visible units and selected invisible units at an edge. **Fix:** intersect the presented parts at their presented animation time; test facing and active poses near each edge.

2. **P2 — Bounding-box overlap admits bodies wholly outside a viewport corner.** `selectionMembers.ts:41` tests polygon bounds rather than polygon intersection. For fixture villager 2162, view bounds `[-130.8333, 62.5]–[202.5, 312.5]` return true although clipping every still-body polygon against that rectangle yields no intersection. This fails even under the revised "still parts" contract. **Fix:** use polygon–rectangle intersection after the bounding-box rejection, with a corner regression case.

3. **P3 — F2's test misses the production wiring regression.** `primarySelectionVoice.test.ts:21` calls the helper directly. Restoring the old `mountGameAudio.ts:97` implementation in memory reintroduced mixed-group silence while **all 24 audio tests passed**, including the mount tests. **Fix:** exercise a mixed selection through the mounted audio controller and assert the emitted selection cue.

4. **P3 — F3 has no occupied-destination regression test.** The exemption at `command.ts:25` works, but no committed test exercises `clickCell` on an occupied cell with A/P/G armed. Existing A/P tests use raw mouse clicks; `attack-ground-hotkey.spec.ts:57` targets empty ground. **Fix:** parameterize occupied-cell checks across all three orders, retaining an unarmed refusal control.

| Round 0 finding | Resolution and test sensitivity |
|---|---|
| F0 | Resolved. Restoring the group-type check made the mixed-group controller test fail. |
| F1 | Original feet-circle error repaired; remaining errors above. Restoring the circle predicate made the bottom-edge controller test fail. |
| F2 | Behavior repaired. Helper mutation fails, but reverting the actual mount remains green, as above. |
| F3 | Exemption and timing documentation repaired. Mocked helper checks confirmed A/P/G acceptance and unarmed refusal; committed regression coverage is missing. |
| F4 | Resolved. Removing boar/deer/wolf recognition caused six failures. The carcass case now requires nonempty coverage. |
| F5 | Resolved geometrically. All four excluded entities, including the House, intersect the box. Restoring the old House location defeats the new precondition; browser mutation execution was not performed. |

**Hit-order findings: none.** Selection and command overlap probes covered all four animals ahead of and behind units, buildings, trees and carcasses: 3,458 overlapping hit checks matched the specified ordering. The stack adaptation preserves militia → sheep → house → militia and its existing assertions.

**Browser-adaptation findings: none.** The roof search still reaches tower/tower-roof polygons outside the Town Center's ground footprint. Both adaptations are honest within their existing test bounds.

**Additional audio-behavior findings: none.** Homogeneous selections retain their role; mixed selections gain their primary unit's role. Existing primary-ID cue suppression remains.

**Seam/refusal behavior findings: none.** `getArmedGroundOrder` reads the same state consumed by pointer input and does not consume it. The documented sampling race remains appropriately bounded.

Visibility also rebuilds recipes, shadows and hulls for every matching unit, including offscreen units. An isolated 200-villager probe measured approximately **22 ms median**, versus **0.11 ms** for the former circle predicate. Reusing presented geometry would address both correctness and unnecessary reconstruction.

Validation: 32 focused tests and typechecking passed. Mutations were entirely in memory. Browser/full verification was not run; remote CI and process inventory were blocked by sandbox permissions. No browser or GUI was launched.

(Report as written to `codex-report.md`, with the absolute-path links shortened to file:line; no other change.)

## Findings and disposition

| ID | Finding | Disposition and reason | Repair or follow-up |
|---|---|---|---|
| F6 | Codex 1: on-screen used the recipe's still pose, not the presented one, and rebuilt recipes per unit (about 22 ms for 200) | Accepted | the renderer's `presentedHitPolygons(ids)` hands the presented polygons (pose and animation time) to the controller through the new dep `getDrawnPolygons`; no recipe is rebuilt; test "reads the bodies the renderer presented, not the recipe's still pose" goes red when the still pose is put back |
| F7 | Codex 2: a bounding-box overlap at a view corner counted as on screen | Accepted | `convexPolygonIntersectsRect`, the separating-axis test; Codex's own case is a test, red when the axis loop is cut |
| F8 | Codex 3: the voice test did not reach the mount's wiring | Accepted | `tests/ui/primarySelectionVoiceMount.test.ts` drives the real mount over the real bridge and reads the cue; red when the mount reads the group type again |
| F9 | Codex 4: no test of `clickCell` with A, P or G armed on a unit's cell | Accepted | a browser case presses each real key and clicks a unit's cell, with the plain-click refusal as its control; red when the exemption is removed |

## Verification

After the repairs: typecheck and lint clean; 78 unit files under `tests/input`, `tests/ui`, `tests/app`, `tests/architecture` and the work's other files passed; the three code mutants (F6, F7, F8) and the browser mutant (F9) each went red and were restored byte-identical (SHA-256 checked); 34 browser tests over the six selection and click specs passed on the repaired build. The full gate on the round-0 repairs (commit `fd2632ea`) had passed before this round's repairs: vitest 5,225 passed and 3 skipped, Playwright 280 passed and 2 skipped.

## Round outcome

Four findings, all accepted and repaired; F1 is closed by F6 and F7. The round-1 repairs go to a focused re-review, round 2.
