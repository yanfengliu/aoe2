// Bridge side-map state. Every Map<entityId, ...> the bridge tracks lives
// here. createWorld instantiates one of these and threads it into every
// factory + system; nothing else mutates these maps directly.

import type { Position } from 'civ-engine';
import type {
  PlayerResources,
  PopulationState,
  ResearchableTechnologyType,
} from '../types';
import type { AiState } from '../ai';
import type {
  BuildingCombatState,
  BuildingHealthState,
  WildlifeState,
} from './systems/systemTypes';
import type {
  MonkTask,
  UnitCommand,
} from './sharedTypes';
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
  researchedTechnologies: Map<number, Set<ResearchableTechnologyType>>;
  playerResources: Map<number, PlayerResources>;
  // Phase 2D: `marketExchangeRates` migrated to
  // `world.state.aoe2.marketExchangeRates` via accessor + codec.
  population: Map<number, PopulationState>;
  // Phase 2D: `townCenterRefs` migrated to `world.state.aoe2.townCenterRefs` via accessor + codec.
  // Phase 2D: `villagerOrdinals` migrated to `world.state.aoe2.villagerOrdinals`
  // via the accessor + `villagerOrdinalsCodec`. Reads/writes go through
  // `accessor.get(villagerOrdinalsCodec)` / `accessor.mutate(...)` instead.
  unitCommands: Map<number, UnitCommand>;
  movePathCache: Map<number, CachedMovePath>;
  // Phase 2D: `sheepMoveOrders` migrated to `world.state.aoe2.*` via accessor + codec.
  // Phase 2D: `rallyPoints` migrated to `world.state.aoe2.rallyPoints` via accessor + codec.
  monkTasks: Map<number, MonkTask>;
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
  aiStates: Map<number, AiState>;
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
  buildingHealthStates: Map<number, BuildingHealthState>;
  buildingCombatStates: Map<number, BuildingCombatState>;
  wildlifeStates: Map<number, WildlifeState>;
  inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>;
  // Phase 2D: `gathererDropOffStuckSinceTick` migrated to
  // `world.state.aoe2.gathererDropOffStuckSinceTick` via accessor + codec.
  // Phase 1A: AI intention queue (DESIGN v17 §6.5). AI-decision systems push
  // to this during their `execute` phase; the main game loop drains it via
  // `dispatcher.drainPendingCommands(world, queue)` BETWEEN ticks. Cleared
  // every tick by the dispatcher itself; not persisted across saves.
  pendingCommands: PendingCommandsQueue;
}

export function createBridgeState(): BridgeState {
  return {
    researchedTechnologies: new Map(),
    playerResources: new Map(),
    population: new Map(),
    unitCommands: new Map(),
    movePathCache: new Map(),
    monkTasks: new Map(),
    aiStates: new Map(),
    monksByOwner: new Map(),
    monkConvertProcessedThisTick: new Map(),
    buildingHealthStates: new Map(),
    buildingCombatStates: new Map(),
    wildlifeStates: new Map(),
    inFlightTechByOwner: new Map(),
    pendingCommands: createPendingCommandsQueue(),
  };
}
