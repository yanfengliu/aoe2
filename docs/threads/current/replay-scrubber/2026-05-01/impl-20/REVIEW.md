# impl-20 multi-CLI review — Phase 2D `villagerOrdinals` slot migration (proof-of-pattern)

**Date:** 2026-05-01
**Branch:** main (uncommitted)
**Reviewers:** Codex `gpt-5.5` xhigh, Claude `claude-opus-4-7[1m]` max, Gemini `gemini-3.1-pro-preview` plan-mode
**Diff scope:** ~345 LOC across 7 files: `bridgeState.ts`, `entityCreateOps.ts`, `scenarioSeedOps.ts`, `saveGameOps.ts`, `hydrateFromSavedGame.ts`, `wireBridgeOps.ts`, `registerBridgeSystems.ts`.

## Summary

First Phase 2D slot migration. `villagerOrdinals: Map<number, number>` moves from `BridgeState` to `world.state.aoe2.villagerOrdinals` via `accessor.mutate(villagerOrdinalsCodec, ...)`. The legacy SaveBlob schema-1 path is preserved (back-compat); save reads through `accessor.get`, hydrate writes through `accessor.mutate`. Demonstrates the migration pattern subsequent Phase 2D commits will follow for the remaining 34 Tier-1 slots.

`wireBridgeOps` reorganizes accessor + visibility cell construction to the TOP (was at the END in Phase 2C) so ops modules consuming migrated slots receive them as deps.

## Reviewer findings (synthesized)

### Both reachable reviewers ACCEPT

- **Gemini**: ACCEPT, no findings. All four checklist items (correctness/order, cache coherence, save-load integrity, init order) pass.
- **Claude**: ACCEPT, all 7 anti-regression items hold. Verified the read-modify-write pattern in `entityCreateOps.addUnitEntity` returns the same cached Map reference; cache survives across ticks (only `_dirty` cleared on flush, not `_cache`); save-load round-trip preserved.

### Forward-looking concern addressed proactively

| Finding | Source | Resolution |
|---|---|---|
| `saveGame()` doesn't flush the accessor before `world.serialize()`. Phase 2D back-compat-safe (legacy SaveBlob.sideMaps is source of truth on load) but Phase 2F schema-2 will rely solely on the worldSnapshot — un-flushed dirty mutations would be lost. | Claude (forward-looking, NOT a blocker) | **Addressed inline** by prepending `accessor.flush()` to `saveGame()` via a `flushBeforeSerialize()` helper. Save-time consistency is now a local guarantee regardless of when saveGame() is invoked. |
| Stale `bootstrapFlush.ts` comment claiming the Tier-1 flush is "a no-op" | Claude (informational) | **Addressed inline** — comment updated to reflect that Phase 2D migrations populate the dirty set during seed/hydrate. |

### Codex unreachable

Same failure mode as impl-16-19. Per AGENTS.md fallback, proceeded with two reachable reviewers (both ACCEPT).

## Verification

- `npm run typecheck` ✓
- `npm run lint` ✓
- `npx vitest run tests/replay/` (31 tests passed)
- `npm test` (698 passed + 1 skipped, matching Phase 2C baseline; no regressions from migration)
- `npm run build` ✓

## Disposition

Phase 2D pattern is established. The next slot migrations (gathererDropOffStuckSinceTick, marketExchangeRates, monkHealCounters, etc.) follow the same shape: drop from BridgeState → thread accessor through writers/readers → use `accessor.mutate(codec, ...)` / `accessor.get(codec)` at call sites. Each subsequent slot migration ships as its own commit with multi-CLI review.
