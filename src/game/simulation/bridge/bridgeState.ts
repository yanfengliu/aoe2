// Bridge-owned side-map state for the few maps not yet moved into
// world.state or intentionally kept as runtime caches. createWorld
// instantiates one of these and threads it into factories + systems.

import type { Position } from 'civ-engine';
import {
  createPendingCommandsQueue,
  type PendingCommandsQueue,
} from '../dispatcher';

interface CachedMovePath {
  destination: Position;
  path: Position[];
  nextPathIndex: number;
}

export interface BridgeState {
  // Phase 2D: `trackedVisibilitySources` + `playerAges` + `playerCivilizations`
  // migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `researchedTechnologies` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `playerResources` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `marketExchangeRates` migrated to
  // `world.state.aoe2.marketExchangeRates` via accessor + codec.
  // Phase 2D: `population` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `townCenterRefs` migrated to `world.state.aoe2.townCenterRefs` via accessor + codec.
  // Phase 2D: `villagerOrdinals` migrated to `world.state.aoe2.villagerOrdinals`
  // via the accessor + `villagerOrdinalsCodec`. Reads/writes go through
  // `accessor.get(villagerOrdinalsCodec)` / `accessor.mutate(...)` instead.
  // Phase 2D: `unitCommands` migrated to `world.state.aoe2.unitCommands`
  // via accessor + codec.
  movePathCache: Map<number, CachedMovePath>;
  // Phase 2D: `sheepMoveOrders` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `rallyPoints` migrated to `world.state.aoe2.rallyPoints` via accessor + codec.
  // Phase 2D: `monkTasks` migrated to `world.state.aoe2.monkTasks`
  // via accessor + codec.
  // Phase 2D: `conversionState` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `monkCarriedRelic` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `relicsInMonastery` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `trebuchetPackStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `wonderCountdowns` + `relicCountdowns` + `wonderCountdownOverrides`
  // + `relicCountdownOverrides` all migrated to `world.state.aoe2.*` via
  // accessor + codec.
  // Phase 2D: `playerScoreCounters` migrated to
  // `world.state.aoe2.playerScoreCounters` via accessor + codec.
  // Phase 2D: `lastSeenStatic` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `garrisonedByBuilding` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `garrisonedUnitToBuilding` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `garrisonedUnitVisionSources` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `aiStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // V5-1: O(1) monk presence lookup keyed by owner. Iter-1 V4-12 used
  // countOwnedUnits(owner, 'monk') as the AI assignAiMonkTasks skip-guard,
  // but countOwnedUnits walks world.query('unit') — same cost as the
  // function it was meant to bypass, doubling the steady-state cost when
  // an AI has Monks. This side map lets the guard be a Set.size lookup.
  // Updated in entityCreateOps.addUnitEntity, entityDestroyOps.destroyUnitEntity,
  // and monkTaskAppliers.flipConvertedUnit (defensively — Monks are not
  // typically convertible in canonical AoE2 but the contract holds either
  // way). Rebuilt from world.query('unit') on save-load hydration.
  monksByOwner: Map<number, Set<number>>;
  // Phase 2D: `monkHealCounters` migrated to `world.state.aoe2.monkHealCounters`
  // via accessor + codec.
  // V4-14: tick-tagged per-target guard. Entry is the tick on which the
  // first Monk processed conversion against the target. The `applyMonkConvert`
  // consumer checks `=== activeWorld.tick` to enforce one progress increment
  // per target per tick regardless of how many Monks are racing. Tagging by
  // tick makes the guard self-clearing across ticks — even if the periodic
  // .clear() in monkBehaviorSystem skipped a tick (e.g. if a future caller
  // invoked applyMonkConvert from a different system phase), the per-tick
  // guarantee still holds because stale-tick entries no longer match.
  monkConvertProcessedThisTick: Map<number, number>;
  // Phase 2D: `productionQueues` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `constructionStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `combatStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `buildingHealthStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `buildingCombatStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `wildlifeStates` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `inFlightTechByOwner` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `gathererDropOffStuckSinceTick` migrated to
  // `world.state.aoe2.gathererDropOffStuckSinceTick` via accessor + codec.
  // Phase 1A: AI intention queue (DESIGN v17 §6.5). AI-decision systems push
  // to this during their `execute` phase; the main game loop drains it via
  // `dispatcher.drainPendingCommands(world, queue)` BETWEEN ticks. Cleared
  // by the dispatcher after submission; persisted across saves so a save taken
  // between AI decision and the next tick does not drop queued intentions.
  pendingCommands: PendingCommandsQueue;
}

export function createBridgeState(): BridgeState {
  return {
    movePathCache: new Map(),
    monksByOwner: new Map(),
    monkConvertProcessedThisTick: new Map(),
    pendingCommands: createPendingCommandsQueue(),
  };
}
