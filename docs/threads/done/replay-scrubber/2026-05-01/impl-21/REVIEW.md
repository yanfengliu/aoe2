# impl-21 multi-CLI review — Phase 2D `gathererDropOffStuckSinceTick` slot migration (hot-loop pattern)

**Date:** 2026-05-01
**Reviewers:** Codex skipped (same failure mode); Claude `claude-opus-4-7[1m]` max + Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~398 LOC across 9 files: `bridgeState.ts`, `villagerEconomySystem.ts`, `bridgeHelpers.ts`, `entityDestroyOps.ts`, `saveGameOps.ts`, `hydrateFromSavedGame.ts`, `wireBridgeOps.ts`, `wirePostSeedOps.ts`, `registerAllSystems.ts/Types.ts`, `registerBridgeSystems.ts`.

## Summary

Second per-slot Phase 2D migration. Demonstrates the **hot-loop pattern** for slots mutated many times per tick: get cached Map once, mutate directly via local helpers, mark dirty once at end of execute(). Collapses N `accessor.mutate` calls (each adds to dirty set) to one `accessor.markDirty(codec)`.

## Reviewer findings (synthesized)

### Convergent finding addressed inline

| Finding | Source | Severity | Fix |
|---|---|---|---|
| `clearStuck(id)` unconditionally set `stuckMapDirty = true` even when `Map.delete` was a no-op (no key to remove). The common drop-off step path calls `clearStuck` every tick, so the slot was marked dirty constantly — defeating the dirty-tracking optimization. | Both Gemini + Claude (independent, identical fix) | LOW (perf) | Wrapped delete in `if (stuckMap.delete(id))` to set dirty only when content actually changed. |
| Asymmetric helpers — `clearStuck` collapsed delete+dirty, but `set` mutation site at line 329 was inline with manual `dirty=true`. Future maintainer adding a third mutation site might forget. | Claude F2 | LOW (maintenance) | Added parallel `setStuck(id, tick)` helper for symmetry. Both mutation sites now use helpers. |

### Verified clean

- Cache coherence: `accessor.reset()` not called from src/, `bridgeSnapshotSystem.flush()` clears `_dirty` only (not `_cache`), captured Map ref stays the same instance across all tick boundaries.
- Dirty-mark elision: `stuckMapDirty` set true at all mutation sites, never reset within execute, final `if (stuckMapDirty) markDirty()` correct.
- Save-load round-trip: saveGameOps.flushBeforeSerialize ensures world.state freshness; hydrate via accessor.mutate; bootstrapFlush at end of wireBridgeOps; schema-1 SaveBlob shape unchanged.
- Closure-per-tick overhead: ~10 alloc/sec — negligible.
- Orphan prune: `accessor.mutate(codec, m => pruneOrphanEntityKeys(m))` correctly captures the prune mutation in dirty set.

### Codex unreachable

Same failure mode. Per AGENTS.md fallback, two reachable reviewers both ACCEPT-with-fixes; convergent independent finding gives high confidence.

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (31 tests passed)
- `npm test` (698 passed + 1 skipped, no regressions)
- `npm run build` ✓

## Disposition

Hot-loop migration pattern established alongside the standard pattern from impl-20. Future Phase 2D commits can pick the appropriate pattern per slot's mutation frequency.
