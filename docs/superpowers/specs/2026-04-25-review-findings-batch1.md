# Spec: Address code-review findings (batch 1)

Reference: `docs/reviews/full/2026-04-25/1/REVIEW.md`. Verified each finding below against current source on `main`.

## Scope

Three correctness fixes plus one docs refresh. Larger items (C-2 full enum validation, H-2 save/load round-trip coverage, H-4 getRenderState memo, N-1 further bridge extraction) are deferred to separate sprints because each is a multi-day surface on its own.

### [C-1] Monk conversion flip-flop wipes progress when two enemy Monks share a target

`src/game/simulation/bridge/monkTaskOps.ts:360-376`. The owner-mismatch reset happens BEFORE the per-tick guard. When two Monks of different owners process the same target in one tick, the second wipes the first's progress and then returns without adding any of its own. Net: zero progress per tick instead of one Monk's worth.

Fix: gate the take-over inside the same branch as the per-tick add. Move `monkConvertProcessedThisTick.has(targetId)` check above the owner-mismatch reset. The Monk that wins the tick (first processed) retains/adds progress in its name; subsequent Monks of any owner just save state and return. Ownership take-over still works across ticks because the next tick's first-processed Monk does the reset.

TDD: `tests/simulation/monkConversion.test.ts` (new) — fixture with two enemy Monks both targeting one neutral unit; assert progress increases monotonically across ticks (does not reset to zero each tick).

### [H-1] Save-load: projector seed disagrees with world seed

`src/game/simulation/createSimulationBridge.ts:7141`. `createProjector` is called with the outer `seed` parameter; the world uses `effectiveSeed = savedGame ? savedGame.seed : seed`. A loaded match runs deterministically on `savedGame.seed` but the projector is wired to whatever `seed` was passed at construction.

Fix: pass `effectiveSeed` to `createProjector`. Three-line change.

TDD: extend `tests/simulation/saveLoad.test.ts` — assert that after `createSimulationBridge(otherSeed, { savedGame })`, the bridge's projector seed matches `savedGame.seed`. Or assert via render-state determinism: load with a different outer seed and verify render output unchanged.

### [H-3] Garrison side-map cross-reference integrity check

`src/game/simulation/createSimulationBridge.ts:1915-1923`. `garrisonedByBuilding` and `garrisonedUnitToBuilding` are loaded by independent for-loops. A blob with an id in one but not the other boots the bridge into an inconsistent state with no diagnostic.

Fix: after the two load loops, walk both maps and assert mirror invariant. On mismatch, throw a descriptive error from `loadFromSaveBlob` (parallel to existing `Save schema mismatch:` error pattern).

TDD: `tests/simulation/saveLoadIntegrity.test.ts` (new) — hand-craft a save blob with a deliberate cross-reference mismatch; assert the loader throws.

### [M-16] ARCHITECTURE.md `bridge/` topology refresh

`docs/architecture/ARCHITECTURE.md:15-29` only describes the first extraction wave. Refresh to list `aiDecisionOps`, `matchEndOps`, `monkTaskOps`, `placementOps`, `saveGameOps`, `targetFindingOps`, `technologyOps`, plus top-level `worldOccupancy`, `selectionActivity`, `renderStore`. Append a row to `drift-log.md` and mention the refresh in the devlog.

Not a structural change — purely an accuracy refresh of the existing section. AGENTS.md says: "Do not update ARCHITECTURE.md for non-structural fixes" — but this update is the documented topology catching up to multiple already-shipped extractions, which IS a structural drift correction.

## Out of scope (deferred)

- **C-2** Schema-validating the save loader at every cast site. Large surface; needs a separate pass with a runtime validator (zod or hand-rolled) and decisions about what to do on rejection.
- **H-2** Widening `captureSnapshot` to assert all side maps. Test-only but large; would make a fragile mid-flight save (Monk + construction + production + trebuchet pack) into a discriminating fixture.
- **H-4** Per-tick memoization of `getRenderState`'s memory-entity scan. Hot-path perf; needs measurement before/after.
- **N-1** Further extraction of combat / production-queues / gather-dropoff systems out of `createSimulationBridge.ts`.
- **H-5, H-6, H-7, M-1 through M-18, L-1 through L-8, N-2, N-3** — defer to a later batch unless any becomes blocking.

H-5 has been verified as a non-bug during planning: with zero villagers there is nothing to redistribute, so the silent no-op is the correct behavior. AI recovery from villager wipes happens via the production decision branch elsewhere, not the rebalance branch.

## Validation gates

- `npx vitest run` (full suite green)
- `npx tsc --noEmit`
- `npx vite build`
- `npm run lint`

## Out-of-scope bug caught by the gate

While running the final `npx vitest run`, the pre-existing `tests/simulation/createSimulationBridge.darkAge.test.ts` "projects construction and completion building visuals into render state" test was found failing on `main` (not introduced by this batch — verified via `git checkout main` rerun). Root cause: construction completion at `createSimulationBridge.ts:5239-5243` mutates `renderable.tint` and `renderable.visualVariant` in place; `civ-engine`'s RenderAdapter doesn't see in-place mutations, so the render store kept the 'construction' projection forever. Fix added: `markOutOfBandRenderChange()` after the in-place mutation, matching the pattern already used at multiple sibling sites in the same function. Committed separately as `d0af9cb` and called out in the devlog so it doesn't get conflated with the review-batch fixes.

## Commits

One commit per finding, plus a final docs commit. Per the user's "always commit changes" rule, do not batch.
