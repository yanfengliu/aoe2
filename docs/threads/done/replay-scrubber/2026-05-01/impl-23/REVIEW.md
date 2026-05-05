# impl-23 multi-CLI review — Phase 2D `playerAges` + `playerCivilizations` slot batch migration

**Date:** 2026-05-01
**Reviewers:** Codex skipped; Claude `claude-opus-4-7[1m]` max + Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~516 LOC across 12 files. Bundles 2 slot migrations + accessor-construction-relocation refactor.

## Summary

Fourth + fifth per-slot Phase 2D migrations bundled together because they share most touch sites (playerQueries reader, scenarioSeedOps writer, hydrateFromSavedGame writer, saveGameOps reader, etc.). Also includes the accessor-construction-relocation refactor: `BridgeStateAccessor` is now constructed in `createWorld.ts` BEFORE `bridgeHelpers` so that ensureAiState can read playerAges via the accessor. wireBridgeOps drops its construction, accepts accessor as a dep.

## Reviewer findings

Both **ACCEPT**.

### Convergent nits addressed inline

| Finding | Source | Fix |
|---|---|---|
| `scenarioSeedOps.ts` calls `accessor.mutate` 2× per player inside the loop, while `hydrateFromSavedGame.ts` correctly batches into a single mutate with the loop inside the callback. Stylistic divergence. | Both Gemini + Claude | Aligned scenarioSeedOps to the hydrate pattern: 2 outer `accessor.mutate` calls each containing the per-player loop. |
| `economyStateOps.ts` redundant `[...].map(([k, v]) => [k, v])` — Map iterators already yield `[K, V]` tuples. | Gemini | Simplified to `Object.fromEntries(accessor.get(playerAgesCodec))`. |
| Civ-fallback duplication (pre-existing, in playerQueries + selectionStateOps) | Both Gemini + Claude (nit) | DEFERRED — pre-existing duplication, acceptable for now. |

### Verified clean

- Construction order: accessor available to bridgeHelpers via lazy world-getter; first cache materialization happens at runtime (well after world init).
- Cache coherence: single accessor instance threaded through every consumer.
- Age-up read-after-write: technologyOps mutates → playerQueries reads via same cached Map ref.
- Save-load round-trip: SaveBlob shape unchanged; cached-Map reads + mutate writes both correct.
- Codec safety on empty slot: `flatMapCodec.deserialize(undefined)` returns fresh empty Map.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (31 tests passed)
- `npm test` (698 passed + 1 skipped)
- `npm run build` ✓

## Disposition

5 of 35 Tier-1 slots migrated. Phase 2D pattern matures: the accessor-construction-in-createWorld refactor lays the seam for any future ops module that needs accessor at bridgeHelpers-construction time.
