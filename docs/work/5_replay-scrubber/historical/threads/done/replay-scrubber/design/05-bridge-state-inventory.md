## 3. Bridge State Inventory (v2 — corrected)

Total `BridgeState` fields ≈ 39 (per `bridgeState.ts`). Of these:

**Tier 1 (fidelity-critical — 35 slots; must move into `world.state` via per-slot JSON serialization, see §5.1):**

| Group | Slots |
|---|---|
| Combat / health | `combatStates`, `buildingHealthStates`, `buildingCombatStates` (added v2 per H1), `wildlifeStates`, `conversionState` (added v2 per H1) |
| Construction / production | `constructionStates`, `productionQueues` |
| Wonder / Relic countdowns | `wonderCountdowns`, `wonderCountdownOverrides`, `relicCountdowns`, `relicCountdownOverrides` |
| Garrison | `garrisonedByBuilding`, `garrisonedUnitToBuilding`, `garrisonedUnitVisionSources` |
| Monk + relic | `monkTasks`, `monkCarriedRelic`, `relicsInMonastery`, `monkHealCounters` |
| AI | `aiStates` |
| Economic | `playerResources`, `playerAges`, `population`, `marketExchangeRates`, `playerCivilizations` |
| Commands / movement | `unitCommands`, `sheepMoveOrders`, `rallyPoints` |
| Trebuchet | `trebuchetPackStates` |
| Stuck-villager throttle | `gathererDropOffStuckSinceTick` |
| Tech / scoring / TC refs | `researchedTechnologies`, `playerScoreCounters`, `townCenterRefs`, `villagerOrdinals` (moved to Tier-1 v2 per H2) |
| Visibility book-keeping | `trackedVisibilitySources`, `lastSeenStatic` |

**Tier 2 (pure derivation — 4 slots; rebuild on hydrate, don't snapshot):**
- `movePathCache` (re-solve A* on demand)
- `monksByOwner` (rebuild from `world.query('unit')`)
- `monkConvertProcessedThisTick` (per-tick guard, self-clearing)
- `inFlightTechByOwner` (rebuild from `productionQueues` on hydrate)

**Tier 3 (external mutable state — 3 slots, separate from `BridgeState` but synced to `world.state` per tick via `tier3SyncSystem`):**
- `VisibilityMap.getState()` → `world.state.set('aoe2.visibility', ...)` (where `...` is the existing `VisibilityMapState` JSON shape — `{ width, height, players: Array<[id, { sources, explored: number[] }]> }`). v9: gated by `VisibilityCell._dirty` to avoid re-traversal cost when no source changed.
- `MatchState` → `world.state.set('aoe2.matchState', serializeMatchState(matchState))` (matches existing `SerializedMatchState`; derived fields stripped to avoid persisting stale values).
- `bridgeMeta = { mapWidth, mapHeight }` → `world.state.set('aoe2.bridgeMeta', ...)` (v8 NEW; written once at game start, idempotent thereafter; lets `extractDimsFromSnapshot` recover dims for any snapshot regardless of visibility-migration state).

**Presentation-only (5 items — never serialized, never needed for scrub):**
- `selection.refs` — UI selection state
- `placementMode.current` — placement preview cell
- `hasOutOfBandRenderChangeRef` — render dirty flag
- `RenderStore` / `RenderAdapter` projections — derived from visible entities
- `commandRejectionQueue` — debug/error feedback
