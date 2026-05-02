// Bridge side-map state. Every Map<entityId, ...> the bridge tracks lives
// here. createWorld instantiates one of these and threads it into every
// factory + system; nothing else mutates these maps directly.

import type { EntityRef, Position } from 'civ-engine';
import type {
  AgeType,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  VisionSourceComponent,
} from '../types';
import { createInitialMarketRates } from './pureHelpers';
import type { AiState } from '../ai';
import type { MemoryEntry } from './memoryTypes';
import type { RelicCountdownEntry, WonderCountdownEntry } from './countdownTypes';
import type {
  BuildingCombatState,
  BuildingHealthState,
  CombatState,
  WildlifeState,
} from './systems/systemTypes';
import type {
  ConstructionState,
  MonkTask,
  TrebuchetPackState,
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

interface PlayerScoreCounters {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

export interface BridgeState {
  trackedVisibilitySources: Map<number, number>;
  playerAges: Map<number, AgeType>;
  playerCivilizations: Map<number, string>;
  researchedTechnologies: Map<number, Set<ResearchableTechnologyType>>;
  playerResources: Map<number, PlayerResources>;
  marketExchangeRates: { food: number; wood: number; stone: number };
  population: Map<number, PopulationState>;
  townCenterRefs: Map<number, EntityRef>;
  // Phase 2D: `villagerOrdinals` migrated to `world.state.aoe2.villagerOrdinals`
  // via the accessor + `villagerOrdinalsCodec`. Reads/writes go through
  // `accessor.get(villagerOrdinalsCodec)` / `accessor.mutate(...)` instead.
  unitCommands: Map<number, UnitCommand>;
  movePathCache: Map<number, CachedMovePath>;
  sheepMoveOrders: Map<number, Position>;
  rallyPoints: Map<number, Position>;
  monkTasks: Map<number, MonkTask>;
  conversionState: Map<number, { byOwner: number; progress: number }>;
  monkCarriedRelic: Map<number, number>;
  relicsInMonastery: Map<number, number>;
  trebuchetPackStates: Map<number, TrebuchetPackState>;
  wonderCountdowns: Map<number, WonderCountdownEntry>;
  wonderCountdownOverrides: Map<number, number>;
  relicCountdowns: Map<number, RelicCountdownEntry>;
  relicCountdownOverrides: Map<number, number>;
  playerScoreCounters: Map<number, PlayerScoreCounters>;
  lastSeenStatic: Map<number, Map<number, MemoryEntry>>;
  garrisonedByBuilding: Map<number, number[]>;
  garrisonedUnitToBuilding: Map<number, number>;
  garrisonedUnitVisionSources: Map<number, VisionSourceComponent>;
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
  monkHealCounters: Map<number, number>;
  // V4-14: tick-tagged per-target guard. Entry is the tick on which the
  // first Monk processed conversion against the target. The `applyMonkConvert`
  // consumer checks `=== activeWorld.tick` to enforce one progress increment
  // per target per tick regardless of how many Monks are racing. Tagging by
  // tick makes the guard self-clearing across ticks — even if the periodic
  // .clear() in monkBehaviorSystem skipped a tick (e.g. if a future caller
  // invoked applyMonkConvert from a different system phase), the per-tick
  // guarantee still holds because stale-tick entries no longer match.
  monkConvertProcessedThisTick: Map<number, number>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionState>;
  combatStates: Map<number, CombatState>;
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
    trackedVisibilitySources: new Map(),
    playerAges: new Map(),
    playerCivilizations: new Map(),
    researchedTechnologies: new Map(),
    playerResources: new Map(),
    marketExchangeRates: createInitialMarketRates(),
    population: new Map(),
    townCenterRefs: new Map(),
    unitCommands: new Map(),
    movePathCache: new Map(),
    sheepMoveOrders: new Map(),
    rallyPoints: new Map(),
    monkTasks: new Map(),
    conversionState: new Map(),
    monkCarriedRelic: new Map(),
    relicsInMonastery: new Map(),
    trebuchetPackStates: new Map(),
    wonderCountdowns: new Map(),
    wonderCountdownOverrides: new Map(),
    relicCountdowns: new Map(),
    relicCountdownOverrides: new Map(),
    playerScoreCounters: new Map(),
    lastSeenStatic: new Map(),
    garrisonedByBuilding: new Map(),
    garrisonedUnitToBuilding: new Map(),
    garrisonedUnitVisionSources: new Map(),
    aiStates: new Map(),
    monksByOwner: new Map(),
    monkHealCounters: new Map(),
    monkConvertProcessedThisTick: new Map(),
    productionQueues: new Map(),
    constructionStates: new Map(),
    combatStates: new Map(),
    buildingHealthStates: new Map(),
    buildingCombatStates: new Map(),
    wildlifeStates: new Map(),
    inFlightTechByOwner: new Map(),
    pendingCommands: createPendingCommandsQueue(),
  };
}
