# Review

## Critical / High

### [V4-1] Quadratic loop spike during resource assignment
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/systems/villagerEconomySystem.ts:79`
- **Finding:** `assignNearestResource` queries all map resources (`world.query('position', 'resource')`) and allocates objects, filters, and sorts them map-wide per idle gatherer. When multiple villagers finish dropping off and call `shouldMaintainGatheringOrder` in the same tick, this creates an O(V * R) allocation spike and deep iteration in the main update loop.
- **Fix shape:** Maintain a cached list of harvestable resources by type or use a fast spatial query (like a spiral search or grid buckets) to avoid full-world allocations per idle villager.

## Medium

### [V4-2] Full-world array allocations during box selection
- **Theme:** efficiency
- **Where:** `src/game/simulation/bridge/selectionInputOps.ts:145` and `:206`
- **Finding:** `getHumanUnitIdsInRect` and `getHumanOwnedSheepIdsInRect` map over the entire `world.query('position', 'unit')` collection, allocating intermediate `{ id, position, unit }` wrapper objects for *every* unit and sheep on the map *before* applying the bounding-box filter.
- **Fix shape:** Check bounding box conditions against the raw entity components first before constructing the mapped entry objects for sorting.

### [V4-3] Architecture drift-log is stale
- **Theme:** docs
- **Where:** `docs/architecture/drift-log.md`
- **Finding:** The latest entry for 2026-04-26 documents `createSimulationBridge.ts` shrinking down to 2,722 lines (-71%), but it is actually **332 lines** (-96%) after the final `createWorld.ts` and `bridgeState.ts` extractions completed Phase 5.
- **Fix shape:** Update the 2026-04-26 entries in `drift-log.md` to reflect the final 96% reduction and document the top-level extraction topology.

## Low / Nit

### [V4-4] `aiSystem.ts` slightly exceeds ideal file size
- **Theme:** cleanliness
- **Where:** `src/game/simulation/bridge/systems/aiSystem.ts`
- **Finding:** At ~550 LOC (18.9 KB), the file slightly exceeds the `AGENTS.md` ideal file size limit of 500 LOC, though it remains well under the 1,000 LOC strict limit.
- **Fix shape:** Extract some AI decision logic into another helper ops module in the future.

### [V4-5] Suppressed error during bootstrapped entity spawning
- **Theme:** correctness
- **Where:** `src/game/simulation/bridge/transformOps.ts:133`
- **Finding:** `syncSpawnedEntityOccupancy` catches and suppresses all errors during `isBootstrappingScenario()`. The intent is to let the scenario-seed code throw the user-facing error, but if a spawn genuinely fails occupancy unexpectedly due to a bug in the prototype rules, the error is silently swallowed and the entity might be placed overlapping.
- **Fix shape:** Let it throw or wrap the error conditionally based on the expected validation state from the seed runner.

## Verified-not-bugs

- **`wirePostSeedOps.ts` circular dependency:** `monkOps` captures `unitCommandOps.issueUnitMoveCommand` in a closure before `unitCommandOps` is actually initialized further down the function. This is a classic temporal dead zone (TDZ) pattern. Verified safe: the closure is only invoked at runtime (inside system execution), well after `unitCommandOps` is fully constructed. This explains the revert being a false-positive.
- **`issueMoveCommand` omitting `flushOutOfBandRenderChange()`:** `issueContextCommand` wraps its internal call with the flush, but `issueMoveCommand` passes straight through. Verified safe: `issueMoveCommand` only mutates `unitCommands` and `placementMode`, neither of which require an out-of-band invalidation of `getRenderState()`.
- **System registration order determinism:** `registerAllSystems.ts` registers systems in a flat list whose textual order changed. Verified safe: `civ-engine` sorts topologically based on `before:` and `after:` declarations (e.g. `after: ['prototypePlayerCommands']`), so physical registration sequence does not break determinism.
- **Side map consistency:** `worldOccupancy` and other side maps are properly hoisted to `createWorld.ts` and `bridgeState.ts` and passed cleanly by reference; no dangling closures were leaked into the `systems/` factories.

## Notes on today's bridge refactor

The 42-commit extraction successfully demolished a massive 7.6k LOC god-object into a highly cohesive, flat dependency bag architecture. The `wireBridgeOps.ts` -> `wirePostSeedOps.ts` -> `registerBridgeSystems.ts` pipeline cleanly separates instantiation, wiring, and system registration without relying on implicit closures. Aside from the couple of un-optimized map-wide queries exposed by the move (highlighted above), the structural integrity, determinism, and save/load boundaries look solid and safe.
