# Voxel 0.1.4 integration review — iteration 1

## Scope

Two independent in-process Codex reviewers read the live codebase and current diff. The code/config pass checked the reachable Voxel pin, lock metadata, Vitest Three deduplication, focused tests, production browser identity assertion, and presented entity-picking path. The documentation pass checked active versus historical Phaser wording, migration completion state, moved thread records, links, and the dense-terrain ray-query boundary.

## Findings and disposition

- **[LOW, closed] Standalone Vitest configuration was contradicted by a Vite comment.** `vite.config.ts` claimed Vitest inherited its resolve aliases even though `vitest.config.ts` is independent. The comment now states that shared resolve settings must be mirrored explicitly. Re-review confirmed the wording matches the live configuration.
- **[MEDIUM, closed] The active roadmap still described elevation projection as missing.** `design/roadmap.md` said elevation damage needed a new `ProjectedEntityView` field, but live projection already emits terrain elevation and only voxel presentation flattens it. The roadmap now identifies the actual remaining work: an authoritative attacker/target elevation rule at combat damage resolution. Re-review confirmed the correction against the projection and adapter code.

## Verified contracts

- Voxel commit `faa00bf2ef83e5134bd9ca62c0b36cd0cfbe394b` is reachable at `origin/main`, contains package version 0.1.4, and is the exact AoE CI pin.
- `package-lock.json` records the linked Voxel package as 0.1.4, and `npm ls voxel three --all` resolves Voxel 0.1.4 with one Three 0.185.1 dependency graph.
- The focused constructor-identity test and terrain-chunk compatibility test pass without the duplicate-Three warning. The production browser identity assertion remains unchanged.
- `raycastDensePaletteChunks` has no AoE production call site. The test proves only that current uniform 16×1×16 dense terrain chunks satisfy the portable occupancy contract.
- Presented epoch/revision-gated recipe silhouettes remain the authority for raised and moving entity picking; the portable ray helper does not compose geometry or instance hits.
- The completed isometric and voxel migration records moved to `docs/threads/done/`, all dated review records remain intact, and no live link points to their former `current` paths.

## Final disposition

Both grounded findings were fixed and independently re-checked. Only optional wording or style nitpicks remain; no substantive correctness, coverage, historical-preservation, or documentation-accuracy issue remains in scope.
