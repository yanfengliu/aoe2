# impl-22 multi-CLI review — Phase 2D `monkHealCounters` slot migration

**Date:** 2026-05-01
**Reviewers:** Codex skipped; Claude `claude-opus-4-7[1m]` max + Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~230 LOC across 7 files: `bridgeState.ts`, `entityDestroyOps.ts`, `hydrateFromSavedGame.ts`, `monkTaskAppliers.ts`, `monkTaskOps.ts`, `saveGameOps.ts`, `wirePostSeedOps.ts`.

## Summary

Third per-slot Phase 2D migration. `monkHealCounters: Map<number, number>` (per-monk heal-tick counter) moves from BridgeState to `world.state.aoe2.monkHealCounters` via accessor + codec.

Pattern: hybrid (per-event read-modify-write). `applyMonkHeal` is per-heal-event (not per-tick hot loop), so a single `accessor.get(codec)` at function entry, direct mutation, then `accessor.markDirty(codec)` once at exit. Both delete branches use `if (Map.delete()) markDirty()` to avoid dirty-marking when the counter wasn't present.

## Reviewer findings

Both **ACCEPT**.

- **Gemini**: ACCEPT, no findings. Confirmed correctness, no-op delete optimization, save/load fidelity, behavior preservation.
- **Claude**: ACCEPT, all 5 anti-regression items pass. 2 cosmetic style observations (non-blocking): hybrid pattern documentation, destructure-fold consolidation. **Cosmetic destructure fold addressed inline** (folded `accessor` into the first destructure block instead of a separate one).

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (31 tests passed)
- `npm test` (698 passed + 1 skipped)
- `npm run build` ✓
