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
  villagerOrdinals: Map<number, number>;
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
  monkHealCounters: Map<number, number>;
  monkConvertProcessedThisTick: Set<number>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  constructionStates: Map<number, ConstructionState>;
  combatStates: Map<number, CombatState>;
  buildingHealthStates: Map<number, BuildingHealthState>;
  buildingCombatStates: Map<number, BuildingCombatState>;
  wildlifeStates: Map<number, WildlifeState>;
  inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>;
  gathererDropOffStuckSinceTick: Map<number, number>;
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
    villagerOrdinals: new Map(),
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
    monkHealCounters: new Map(),
    monkConvertProcessedThisTick: new Set(),
    productionQueues: new Map(),
    constructionStates: new Map(),
    combatStates: new Map(),
    buildingHealthStates: new Map(),
    buildingCombatStates: new Map(),
    wildlifeStates: new Map(),
    inFlightTechByOwner: new Map(),
    gathererDropOffStuckSinceTick: new Map(),
  };
}
