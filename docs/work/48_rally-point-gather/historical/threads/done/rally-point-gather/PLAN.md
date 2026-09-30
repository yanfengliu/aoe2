# Rally-point-to-resource auto-gather — PLAN

## Goal
A villager trained from a building whose rally point is set ON a harvestable resource should auto-gather that resource instead of merely walking to the rally cell and idling. This is the AoE2 anti-idle mechanism and the spec §9.3 "set rally point" order in full semantics; it fixes the campaign-9 economic drag (newly-trained human villagers idle at the TC despite abundant food — see `docs/debugging/2026-06-15-campaign9-idle-villagers.md`).

## Design (minimal, contained to one system)
The economic root cause: human villagers are auto-assigned by `villagerEconomySystem` only when `hasExplicitGatherOrder` is true (`shouldMaintainGatheringOrder`, `pureHelpers.ts`). New villagers default to `desiredResource='food'` + `hasExplicitGatherOrder=false`, so they idle.

`productionQueueSystem` already issues a MOVE to the rally point on spawn (`issueUnitMoveCommand`, line ~110-113). Change: when the spawned unit is a villager AND a harvestable resource sits on the rally cell, set the new villager's `gatherer.desiredResource` to that resource's economy kind and `gatherer.hasExplicitGatherOrder = true` (leave `task='idle'`, `targetResourceId=null`). The existing `villagerEconomySystem` idle→assign — now ungated because `hasExplicitGatherOrder` is true — routes it to the nearest matching resource (and fans out if several rally to the same kind). Otherwise (non-villager, or rally on empty ground), keep the existing MOVE.

Why this shape:
- Fully contained to `productionQueueSystem.ts` — no dep threading through the 4-layer wiring (the two existing helpers `findResourceAtCell` / `setUnitGatherCommandDirect` live in different wiring scopes, and `findResourceAtCell` is human-fog-gated, wrong for a deterministic system). A small fog-agnostic resource-at-cell query + setting two gatherer fields is enough.
- Direct mutation only (no `submitWithResult` mid-system) → determinism-safe, matching the existing `issueUnitMoveCommand: setUnitMoveCommandDirect` wiring note.
- Reuses `villagerEconomySystem` for the actual target selection (DRY) — no duplicated resource-finding/gather-setup logic.
- `hasExplicitGatherOrder=true` means the rallied villager keeps auto-reseeking when its resource depletes (correct AoE2 behavior). The AI is unaffected (it auto-gathers regardless).

## Files
- `src/game/simulation/bridge/systems/productionQueueSystem.ts` — add a module-level `rallyResourceKind(world, pos)` helper (fog-agnostic resource-at-cell → economy kind) + the villager-rally branch. Imports: `resourceKindToEconomyResource`, `GathererComponent`/`ResourceComponent`/`EconomyResourceKind` types.
- `tests/simulation/createSimulationBridge.darkAge.test.ts` — integration test: rally the TC onto a tree, train a villager, assert the wood-desiring villager count rises by one and is actively gathering (red without the fix — the new villager keeps default `food` + idles).

## Validation
TDD (red→green), four gates, multi-CLI review, spec §9.3 note, devlog/changelog/roadmap, version bump (user-visible → 0.1.31).
