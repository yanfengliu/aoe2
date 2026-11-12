# Review 5: implementation (M2b rank 1, the tests and gates changed after review 4)

## Target

aoe2, work 150 M2b rank 1: commit `aa943cc8` (main at `eb4f54fb` with rank 1's five commits on it), reviewed as `git diff c4ad537a aa943cc8` without the review records. Nothing under `src/` differs between the two: [review 4](4_implementation.md) approved the product code at `c4ad537a`, and this round read what changed after it, which is tests, gates, the profile's phase table (`scripts/framePhases.mjs`) and the architecture text. The files: `tests/helpers/cellReadCounter.ts` (new), `tests/rendering/keptDeGroundPacking.test.ts`, `tests/rendering/presentationSkipsCells.test.ts`, `tests/simulation/renderStateCellsStaySorted.test.ts`, `tests/simulation/renderStoreLists.test.ts`, `tests/scripts/framePhases.test.ts`, `scripts/framePhases.mjs`, `docs/architecture/ARCHITECTURE.md` and `drift-log.md`.

## Reviewers and coverage

Codex `gpt-6-astra` with `model_reasoning_effort=xhigh`, `--sandbox read-only`, `--ephemeral`, one lane (codex-cli 0.163.0), from a run folder outside the reviewed tree. The tree was this lane's first worktree checked out detached at `aa943cc8`, because the rank 1 worktree was running the red proofs, which put defects into `src/` one at a time. Its log holds no sandbox failure, and the tree's status, diff and `HEAD` were byte-equal before and after. The prompt asked whether F3 is fixed; whether each of the two new counts counts what its header says, can pass while its cost is present, or is changed by its own instrument; for a product change that walks the cells and that both gates and the lane equivalence suite would miss; whether one copy of the terrain half a frame is the truth between ticks; whether the two new cases fail for the defects they name; whether each `roots` count is right; whether anything in the gates' use of the DE Tiny sized world could make a gate flaky; and for anything else wrong in the diff, the architecture text included.

## Reports

### Codex (`gpt-6-astra`)

The report whole, redacted only of its absolute paths.

- **F4 — minor — the field counter’s documented coverage is too broad.** [cellReadCounter.ts:30](tests/helpers/cellReadCounter.ts:30) instruments only existing enumerable own properties. Reads of absent optional properties remain invisible. Terrain views omit `attackAnimation` ([visibility.ts:206](src/game/simulation/bridge/visibility.ts:206), outside the diff). A new scan of the joined list such as `entities.some(e => e.attackAnimation !== undefined)` visits the cells without triggering either counter: the optional property has no accessor, and the joined array has no proxy. If that scan leaves output unchanged, lane equivalence also misses it. I confirmed that 14,400 such property reads produce zero. **Smallest fix:** state this boundary in both gates’ headers; covering these queries additionally requires instrumentation for absent optional fields.

- **F5 — minor — the multiple-root protection remains incomplete.** [framePhases.test.ts:77](tests/scripts/framePhases.test.ts:77) checks only phases already carrying `roots`. `tick.engine-diff` currently matches four functions and `tick.projection` three, but neither declares a count ([framePhases.mjs:31](scripts/framePhases.mjs:31)). Moving `buildDiff` or the adapter’s diff listener outside its matched file would still leave this test green—the failure mode the new comment describes. **Smallest fix:** add `roots: 4` and `roots: 3`, and include those phases in the expected list.

- **F6 — minor — the architecture text overstates the eliminated work.** [ARCHITECTURE.md:179](docs/architecture/ARCHITECTURE.md:179) says nothing on the read path walks cells every tick or frame. The coordinator still filters the whole list for selection on each new tick’s list ([AoeVoxelPresentationCoordinator.ts:164](src/rendering/voxel/AoeVoxelPresentationCoordinator.ts:164)), and the smoother copies terrain pointers through `concat` on each presented frame. **Smallest fix:** distinguish render-state assembly from presentation, and explicitly retain the native-copy and tick-frame exceptions already stated in the gates.

**F3: fixed.** Each seed gets a separate cache. Both remembered seeds now encounter a different terrain array while the cached sources remain remembered. The identity-only mutant fails those cases; the plain-seeded case appropriately continues to pass.

The remaining checks:

- **The counters observe the intended removed costs.** Existing-field accessors preserve view identities and values. The proxy is stable for each original terrain array, preserving the identity shortcuts. `quietly` suppresses the test’s inspection, then restores counting before the actual sort and its comparator run. I found no current instrumentation-induced shortcut hiding the named filtering, ID gathering, or terrain comparison.
- **One terrain-half copy per presented between-tick frame is accurate.** [displayedPositionSmoother.ts:328](src/rendering/displayedPositionSmoother.ts:328) calls the join, whose `concat` copies the half. Both worlds measured exactly **1.00** copy per frame. The joined-list blind spot is accurately disclosed. One concrete undetected regression would be changing that join to `terrain.concat(others).slice()`: another full pointer copy on ticks and frames, unchanged counters and unchanged lane output.
- **Both new invalidation cases distinguish their defects.** An early return when terrain arrays match leaves the moved building’s bytes stale. Omitting snapshot invalidation retains one terrain cell after the cellless snapshot. Read-only, in-memory mutations reproduced both failures.
- **All five declared `roots: 2` counts are correct.** Losing one matching declaration makes the length assertion fail.
- **The Tiny fixture is deterministic for these counts.** Its layout, seed and steps are fixed; I found no machine-speed or wall-clock dependency in the counted quantities. Ordinary test timeouts remain wall-clock limits.

Validation: all **58 tests in the five changed suites passed**; `src/` is unchanged from `c4ad537a`. Full `verify` and lane equivalence were not rerun. CI status was unavailable because its Git lookup could not resolve the checkout under the sandbox’s ownership check.

VERDICT: approve

## Findings and disposition

- **F3: fixed**, by the reviewer's reading and its own mutant.
- **F4 (minor), repaired past the smallest fix.** The count of reads now sees a field a cell does not hold as well: the counter puts a stand-in in place of each watched view's prototype, which counts a read that reaches it and answers as `Object.prototype` does. Both gates pass with it, with the counts they had (no reader asks a cell for a field it lacks). The headers of both gates and of the helper say what the counts see, and what neither sees: a walk of the whole joined list that asks nothing of a cell, the reviewer's second example (`terrain.concat(others).slice()`), which stays each gate's stated bound. `tests/simulation/cellReadCounter.test.ts` (new) checks both counters against reads whose number is known, and that the instrument leaves a cell what it was.
- **F5 (minor), repaired as a class.** Every phase that names a line is now held to an exact count of the lines it claims, one where it says nothing; the list of phases with several roots, with their counts, is in the test. `tick.engine-diff` says 4 and `tick.projection` 3. Two things the exact count turned up: the smoother's pattern also matched a line of the interface, and is tightened; and the engine-diff pattern named a function the installed engine does not have (`getComponentDirty`), which is removed. The test's two cases over hand-kept lists are replaced by this one over every phase.
- **F6 (minor), repaired.** The architecture text now says the render state's read neither sorts the cells nor reads one on a tick that changed none of them, that a frame between ticks reads no cell and copies the cells' array once, and that a frame with a tick still walks them.

## Verification

Commit `166eb7f4`. Eight mutants for the repairs, each red with the control green before and after: a frame that asks every entity for a field a cell does not hold, and the render state doing so on every tick (the cell gates, which passed both before the repair); a root lost from the engine-diff phase and from the projection phase, and the smoother's pattern loosened again (the phases test); and three of the instrument itself, the field count missing a field a cell lacks, missing a field it holds, and the array count missing the first cell (the counters' own test). No further round was run: the three findings are minor, two are the reviewer's own named fixes and the third goes past the one it named, and nothing under `src/` changed.

## Round outcome

Approved, with three minor findings, all repaired.
