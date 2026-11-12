# Review 3: implementation (M2b rank 1, the read path's lists)

## Target

aoe2, work 150 M2b rank 1: commit `88efb941` on branch `frame-cost-rank1-1111`, reviewed as `git diff 9477b032 88efb941` (eleven files under `src/`, a test helper and seven test files). The same change is commit `0ff9f93f` after the branch was put on top of main at `eb4f54fb`; no file of the diff differs between the two.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), run from a folder outside the reviewed tree with the worktree as `--cd`. Its log holds no sandbox failure and no read refused by policy, and the worktree's `git status --porcelain`, `git diff HEAD` and `HEAD` were byte-equal before and after the run. The prompt gave six criteria: the list is the list it was for every input; no cache is ever stale; each reader's fast path equals its slow path; the simulation is untouched; the tests hold what they say and count rather than time; nothing else is wrong. The Claude lane was not run: one independent lane was judged enough for a change whose contract is equivalence and whose tests the reviewer could run.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

No blocker or major findings. Two minor mismatches remain against the requested equivalence contract.

1. **F1 — minor — Layer changes can alter stable ordering of tied entries.** At [renderStore.ts:117](src/game/simulation/renderStore.ts:117), inserting into `others` follows that map’s insertion order, which can differ from `entities`.

   Reproduced sequence: snapshot contains `7:0` on terrain, then `7:1` on the unit layer; update `7:0` to a unit at the same coordinates. Both units belong to player 1. The old assembly returns `[7:0, 7:1]`; the new `getRenderState()` returns `[7:1, 7:0]`.

   This is an accepted-message edge case, **not a demonstrated live-game failure**: the current engine adapter removes the previous generation when replacing it ([render-adapter.js:140](node_modules/civ-engine/dist/render-adapter.js:140), outside the diff).

   **Smallest fix:** rebuild `others` in `entities` insertion order when an existing terrain key becomes nonterrain. Add a tied-generation transition test; the current tests exercise generation reuse and layer changes separately.

2. **F2 — minor — Ground-cache decisions differ between known and plain lists.** At [AoeVoxelWorldRenderer.ts:309](src/rendering/voxel/AoeVoxelWorldRenderer.ts:309), terrain-array identity is required even when every terrain view is unchanged.

   Reproduced with a fixed nonnull frame and two calls to `joinProjectedEntityLists([tile], [])`, using the same `tile` object. The second known-list call repacks; the corresponding plain-list call hits the cache. Packed bytes match. Switching between known and plain representations also forces a miss.

   **Smallest fix:** retain the array-identity shortcut, but compare terrain elements when array identities differ; make that comparison work across both representations. Add a cache-hit parity test.

The new tests’ sensitivity, based on their assertions:

| Test file | Would catch its named defect? | Remaining limitation |
|---|---|---|
| `renderStoreLists.test.ts` | Yes: missing entries, ordinary ordering and invalidation failures. | Misses F1’s combined tie/layer-change case; no rewind case. |
| `renderStateMatchesLegacy.test.ts` | Yes: visibility and fog-merge differences on its live traces. | Explicitly excludes store-comparator ties; no replay/rewind trace. |
| `projectedEntityLists.test.ts` | Yes: incorrect halves and different smoothed output on its trace. | Terrain never changes; no rewind coverage. |
| `renderStateCellsStaySorted.test.ts` | Yes: repeated terrain sorts during render-state reads. | Counts sorts, not correctness or work outside the measured read. |
| `presentationSkipsCells.test.ts` | Yes: terrain-field reads between ticks, with a positive control. | Does not compare snapshot contents or cover F2’s transition. |
| `presentationCoordinatorSelection.test.ts` | Yes: missed selection redraws and incorrect HUD results. | Assumes replacement arrays; rollback does not present an incoming bridge first. |
| `deTinySizedWorld.test.ts` | Yes: wrong scale, tree count or either seat failing to train villagers. | Establishes the fixture, not rendering equivalence. |

Both performance gates count operations, not elapsed time. Neither reproduced mismatch is caught by the new tests.

I found no stale-cache sequence through the current live/replay producers. Selection projection creates fresh views ([visibility.ts:179](src/game/simulation/bridge/visibility.ts:179)); the smoother remembers its own mapped output. The two fog-related files change types only, with no simulation or save-state change. No file-size violation was found.

All **22 new tests**, the **two existing adapter-equivalence tests**, and **two file-size checks** passed. Full verification and pixel comparison were not run. CI status returned `UNKNOWN`; the tree remained unchanged.

VERDICT: changes requested

## Findings and disposition

- **F1 (minor), repaired.** A key that stops being terrain was appended to the end of the store's other half while it keeps its place in the store's map, so two entries that tie in the list's order (one id in two generations on one cell) were listed the other way round. The engine's adapter does not send that today; the contract is every input. The other half is now rebuilt in the map's order on that transition, and `tests/simulation/renderStoreLists.test.ts` holds the tie through a cell becoming a unit and back.
- **F2 (minor), repaired.** The ground's kept packing asked for the same terrain array, so two remembered lists of the same cells in two arrays packed twice where two plain lists packed once. The packing now compares its sources as one sequence however each list is known, with the shared terrain array as a shortcut, and moved to `src/rendering/voxel/aoeDeGroundPacking.ts` because `AoeVoxelWorldRenderer.ts` had passed 500 lines with the repair in it. `tests/rendering/keptDeGroundPacking.test.ts` holds the decision.
- **The table's limitations.** A rewind case was added to the store's tests. No replay or rewind trace was added to the test that compares the list with the old algorithm at every tick: the replay bridge builds its list through the same `createRenderStateOps`, and a recorded bundle in that test would triple its time for a path the store's own cases cover. The coordinator test's rollback case was left as it is.

## Verification

The repairs are commit `5c10ae72` (`c4ad537a` on top of main). With F1's old code put back the new tie case goes red, and with F2's the packing cases do (the mutant list in plan 150's rank 1 record). The repairs were reviewed in [round 4](4_implementation.md).

## Round outcome

Changes requested: two minor findings, both repaired; no blocker and no major finding.
