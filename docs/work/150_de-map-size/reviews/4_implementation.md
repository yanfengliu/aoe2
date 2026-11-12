# Review 4: implementation (M2b rank 1, round 3's repairs)

## Target

aoe2, work 150 M2b rank 1: commit `c4ad537a` on branch `frame-cost-rank1-1111` (main at `eb4f54fb` with rank 1's two commits on it), the repairs of [review 3](3_implementation.md), reviewed as `git diff 0ff9f93f c4ad537a`: `src/game/simulation/renderStore.ts`, `src/rendering/voxel/AoeVoxelWorldRenderer.ts`, the new `src/rendering/voxel/aoeDeGroundPacking.ts`, and two test files.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree. Its log holds no sandbox failure, and the worktree's status, diff and `HEAD` were byte-equal before and after. The prompt asked, for each of F1 and F2, whether it is fixed for every input; whether the move out of `AoeVoxelWorldRenderer.ts` changed behaviour (the call site, the order relative to `createSnapshot`, a bridge swap and its rollback, the art-style switch); and whether the new tests go red for the defects they name.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

**F3 — minor — F2’s remembered-cache cases are not actually exercised.** At [keptDeGroundPacking.test.ts:29](tests/rendering/keptDeGroundPacking.test.ts:29), the cache starts with a plain list. Every subsequent hit preserves that original cache entry, so lines 34–40 never test remembered→remembered or remembered→plain against a remembered cache entry.

Concrete missed defect: seed a fresh cache with `joinProjectedEntityLists(tiles, [building])`, then pass another remembered list using `[...tiles]`, or an equivalent plain list. Requiring terrain-array identity for that cached entry incorrectly repacks. I injected precisely this restriction in memory; all three packing tests passed. **Smallest fix:** parameterize the hit test over plain and remembered initial lists, creating a fresh cache for each.

**F1: fixed.** [renderStore.ts:110](src/game/simulation/renderStore.ts:110) now preserves the invariant that `others` has the insertion order of `entities` filtered to nonterrain entries. New insertions, replacements, deletions, snapshot resets, and terrain transitions preserve it. Reconciliation writes through the same helper without changing ordering fields. Stable sorting therefore preserves the original tie order.

**F2: fixed.** [aoeDeGroundPacking.ts:30](src/rendering/voxel/aoeDeGroundPacking.ts:30) compares the concatenated source sequences correctly across both representations. The shared-head shortcut is valid under the documented immutable terrain-array contract in [projectedEntityLists.ts:22](src/game/simulation/projectedEntityLists.ts:22), outside this diff. Non-null frame identity, brightness, source identity, and order match the old hit rule. Null-frame calls always repack.

The extraction preserves behavior: packing still precedes `createSnapshot`, ground updates still follow acceptance, and style selection still gates packing and supplies brightness. Neither implementation resets or restores the packing cache during bridge swaps. After rollback, differing outgoing inputs cause a repack. The unchanged [aoeDeGround.ts:100](src/rendering/voxel/aoeDeGround.ts:100) copies packed bytes into textures, and its rollback restores texture bytes separately; it cannot corrupt cached packing data. I found no stale-return path within the documented contracts.

Validation: 22 targeted tests passed, including renderer art-style and bridge-rollback tests. In-memory restoration of the original F1 and F2 implementations made their regression tests fail. Additional differential checks passed for 20,000 store operations and 5,000 packing calls, checking hit decisions and fresh bytes. Full verification was not run; remote CI was unavailable because network access was blocked. Reviewed `c4ad537a`; the tree remains unchanged.

VERDICT: approve

## Findings and disposition

- **F1: fixed**, by the reviewer's reading and its own differential check of 20,000 store operations.
- **F2: fixed**, by the reviewer's reading and its own check of 5,000 packing calls.
- **F3 (minor), repaired.** The packing test packed first from a plain list, and a hit keeps the packing that was kept, so no case compared a remembered list with a remembered kept packing: a rule that demanded the same terrain array of two remembered lists passed every case. The hit cases now run three times, each into a cache of its own packed first from a plain list, a remembered list, and a remembered list with a unit on it (commit `65f176d5`).

## Verification

With the reviewer's rule put in (a remembered kept packing demands the same terrain array), the repaired test goes red; it is in the mutant list in plan 150's rank 1 record. No further round was run on F3: the repair is the reviewer's own named fix to a test, and the product code it tests was approved in this round.

## Round outcome

Approved, with one minor finding in a test, repaired.
