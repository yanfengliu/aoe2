// One-shot registration of every ECS system the bridge owns. Each call
// matches the per-system factory's deps interface; this module just
// bundles them into a single setup site so createSimulationBridge keeps
// only the side-map closures + factory wirings, not the per-system noise.

import type { Position, EntityRef, World } from 'civ-engine';
import { VisibilityMap } from 'civ-engine';
import type {
  AgeType,
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  PlayerResources,
  PopulationState,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  ResourceComponent,
  TrainableUnitType,
  UnitComponent,
  UnitTransformComponent,
  UnitType,
  VisionSourceComponent,
} from '../types';
import type { GameCommands, GameEvents, GameWorld } from './pureHelpers';
import type { AiState } from '../ai';
import type { UnitMovementPlan } from './movementTypes';
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
  UnitCommand,
} from '../createSimulationBridge';

import { registerAiSystem } from './systems/aiSystem';
import { registerAutoAggressionSystem } from './systems/autoAggressionSystem';
import { registerConquestOutcomeSystem } from './systems/conquestOutcomeSystem';
import { registerFogMemorySystem } from './systems/fogMemorySystem';
import { registerHerdableMovementSystem } from './systems/herdableMovementSystem';
import { registerHerdableOwnershipSystem } from './systems/herdableOwnershipSystem';
import { registerMonkBehaviorSystem } from './systems/monkBehaviorSystem';
import { registerPlayerCommandsSystem } from './systems/playerCommandsSystem';
import { registerProductionQueueSystem } from './systems/productionQueueSystem';
import { registerRelicCountdownSystem } from './systems/relicCountdownSystem';
import { registerRelicGoldSystem } from './systems/relicGoldSystem';
import { registerScoutMovementSystem } from './systems/scoutMovementSystem';
import { registerTowerCombatSystem } from './systems/towerCombatSystem';
import { registerVillagerEconomySystem } from './systems/villagerEconomySystem';
import { registerVisibilitySystem } from './systems/visibilitySystem';
import { registerWildlifeCombatSystem } from './systems/wildlifeCombatSystem';
import { registerWinConditionResolverSystem } from './systems/winConditionResolverSystem';
import { registerWonderCountdownSystem } from './systems/wonderCountdownSystem';

type CivWorld = World<GameEvents, GameCommands>;

interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

export interface RegisterAllSystemsDeps {
  world: GameWorld;
  humanPlayerId: number;
  visibility: VisibilityMap;
  defaultRelicCountdownTicks: number;
  // Side maps.
  townCenterRefs: Map<number, EntityRef>;
  aiStates: Map<number, AiState>;
  population: Map<number, PopulationState>;
  playerResources: Map<number, PlayerResources>;
  constructionStates: Map<number, ConstructionState>;
  productionQueues: Map<number, ProductionQueueEntry[]>;
  unitCommands: Map<number, UnitCommand>;
  wildlifeStates: Map<number, WildlifeState>;
  combatStates: Map<number, CombatState>;
  buildingHealthStates: Map<number, BuildingHealthState>;
  buildingCombatStates: Map<number, BuildingCombatState>;
  monkTasks: Map<number, MonkTask>;
  monkConvertProcessedThisTick: Set<number>;
  monkCarriedRelic: Map<number, number>;
  relicsInMonastery: Map<number, number>;
  rallyPoints: Map<number, Position>;
  inFlightTechByOwner: Map<number, Set<ResearchableTechnologyType>>;
  sheepMoveOrders: Map<number, Position>;
  gathererDropOffStuckSinceTick: Map<number, number>;
  trackedVisibilitySources: Map<number, number>;
  garrisonedByBuilding: Map<number, number[]>;
  wonderCountdowns: Map<number, WonderCountdownEntry>;
  relicCountdowns: Map<number, RelicCountdownEntry>;
  relicCountdownOverrides: Map<number, number>;
  // AI helper closures.
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingComponent['buildingType']) => number | null;
  findAvailableVillager: (owner: number) => number | null;
  findOwnedUnit: (owner: number, unitType: UnitType) => number | null;
  findIdleProducer: (owner: number, buildingType: BuildingComponent['buildingType']) => number | null;
  ownedMilitaryUnitIds: (owner: number) => Set<number>;
  findOwnedMilitaryUnits: (owner: number) => Array<{ id: number }>;
  hasOwnedWonder: (owner: number) => boolean;
  isConstructingBuilding: (owner: number, buildingType: BuildingComponent['buildingType']) => boolean;
  pickWatchTowerPlacement: (
    townCenterPosition: Position,
    enemyPosition: Position,
  ) => Position | null;
  startConstruction: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => boolean;
  findBuildPlacementNear: (nearby: Position, buildingType: BuildingComponent['buildingType']) => Position | null;
  countOwnedUnits: (owner: number, unitType: UnitType) => number;
  countQueuedUnits: (buildingId: number, unitType: TrainableUnitType) => number;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  enqueueResearch: (buildingId: number, technologyType: ResearchableTechnologyType) => boolean;
  enqueueTraining: (buildingId: number, unitType: TrainableUnitType) => boolean;
  getTrainOptions: (owner: number, buildingType: BuildingComponent['buildingType']) => TrainableUnitType[];
  getResearchOptions: (
    owner: number,
    buildingType: BuildingComponent['buildingType'],
  ) => ResearchableTechnologyType[];
  assignAiMonkTasks: (owner: number) => void;
  findPreferredVisibleEnemyUnit: (owner: number, position: Position) => number | null;
  findPreferredVisibleEnemyBuilding: (owner: number, position: Position) => number | null;
  findPreferredEnemyUnitInRadius: (owner: number, position: Position, radius: number) => number | null;
  findPreferredEnemyBuildingInRadius: (owner: number, position: Position, radius: number) => number | null;
  findPreferredVisibleEnemyUnitInRangeOfBuilding: (
    owner: number,
    position: Position,
    footprint: { width: number; height: number },
    range: number,
  ) => number | null;
  findNearestHostileWildlifeTarget: (
    position: Position,
    aggroRange: number,
    activeWorld: CivWorld,
  ) => number | null;
  // Command-issuance closures.
  issueUnitAttackCommand: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  // Player-commands deps.
  clearUnitCommand: (id: number) => void;
  distanceToBuilding: (id: number, position: Position) => number;
  advanceTrebuchetTransition: (id: number) => boolean;
  isTrebuchetStationary: (id: number) => boolean;
  isTrebuchetSilent: (id: number) => boolean;
  beginTrebuchetUnpack: (id: number) => void;
  beginTrebuchetPack: (id: number) => void;
  findUnitRangePlan: (
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  findBuildingApproachPlan: (
    unitId: number,
    targetId: number,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  moveUnitOneSubgridStep: (
    entityId: number,
    nextStep: Position,
    activeWorld?: CivWorld,
    stepPerTick?: number,
  ) => void;
  isUnitAtTarget: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => boolean;
  resolveMovePlanFromCache: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  markOutOfBandRenderChange: () => void;
  ensurePlayerScoreCounters: (owner: number) => PlayerScoreCountersLike;
  destroyUnitEntity: (id: number) => void;
  killWildlifeEntity: (id: number) => void;
  destroyBuildingEntity: (id: number) => void;
  destroyResourceEntity: (id: number) => void;
  getEntityRef: (id: number) => EntityRef | null;
  onBuildingConstructionComplete: (
    buildingId: number,
    owner: number,
    buildingType: BuildingComponent['buildingType'],
  ) => void;
  // Monk + Production deps.
  applyMonkHeal: (monkId: number, targetId: number, monkUnit: UnitComponent) => void;
  applyMonkConvert: (
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: CivWorld,
  ) => void;
  applyMonkPickup: (monkId: number, targetId: number) => void;
  applyMonkDeposit: (
    monkId: number,
    targetId: number,
    monkUnit: UnitComponent,
    activeWorld: CivWorld,
  ) => void;
  setPositionAndSyncOccupancy: (
    entity: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  syncUnitTransformToPosition: (
    entity: number,
    position: Position,
    activeWorld?: CivWorld,
  ) => void;
  findBuildingSpawnPosition: (
    anchor: Position,
    buildingType: BuildingComponent['buildingType'],
  ) => Position | null;
  addUnitEntity: (
    owner: number,
    unitType: TrainableUnitType,
    spawnPosition: Position,
    visionSource: VisionSourceComponent,
  ) => number;
  applyTechnology: (owner: number, technologyType: ResearchableTechnologyType) => void;
  isCellPassableForUnit: (
    entityId: number,
    x: number,
    y: number,
    activeWorld: CivWorld,
  ) => boolean;
  isCellPassableForWildlife: (
    entityId: number,
    x: number,
    y: number,
    activeWorld?: CivWorld,
  ) => boolean;
  isHarvestableResource: (id: number, resource: ResourceComponent) => boolean;
  shouldMaintainGatheringOrder: (owner: number, gatherer: GathererComponent) => boolean;
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  findNearestDropOffBuilding: (
    activeWorld: CivWorld,
    owner: number,
    resource: 'food' | 'wood' | 'gold' | 'stone',
    position: Position,
  ) => number | null;
  findWildlifeRangePlan: (
    entityId: number,
    target: Position,
    range: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  getUnitTransform: (id: number, activeWorld: CivWorld) => UnitTransformComponent | null;
  findMovementPlan: (
    entityId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld?: CivWorld,
    isCellPassable?: (entityId: number, x: number, y: number, activeWorld: CivWorld) => boolean,
  ) => UnitMovementPlan | null;
  getNearestMoveCandidates: (target: Position) => Position[];
  isGarrisonedUnit: (id: number) => boolean;
  isMatchRunning: () => boolean;
  isAiMilitaryUnit: (unitType: UnitType) => boolean;
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
  currentRelicHoldingOwner: () => number | null;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ) => void;
  playerHasConquestPresence: (owner: number) => boolean;
}

export function registerAllSystems(deps: RegisterAllSystemsDeps): void {
  const {
    world,
    humanPlayerId,
    visibility,
    defaultRelicCountdownTicks,
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    relicsInMonastery,
    rallyPoints,
    inFlightTechByOwner,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    trackedVisibilitySources,
    garrisonedByBuilding,
    wonderCountdowns,
    relicCountdowns,
    relicCountdownOverrides,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findAvailableVillager,
    findOwnedUnit,
    findIdleProducer,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    startConstruction,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findNearestHostileWildlifeTarget,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    clearUnitCommand,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    destroyResourceEntity,
    getEntityRef,
    onBuildingConstructionComplete,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    findBuildingSpawnPosition,
    addUnitEntity,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    findNearestDropOffBuilding,
    findWildlifeRangePlan,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isGarrisonedUnit,
    isMatchRunning,
    isAiMilitaryUnit,
    getOrCreateMemoryMap,
    currentRelicHoldingOwner,
    finalizeMatchEnd,
    playerHasConquestPresence,
  } = deps;
  // isAiMilitaryUnit is currently unused by this surface; keep it accepted
  // so future systems can opt into the same shared deps shape.
  void isAiMilitaryUnit;

  registerAiSystem({
    world,
    humanPlayerId,
    visibility,
    townCenterRefs,
    aiStates,
    population,
    playerResources,
    constructionStates,
    productionQueues,
    unitCommands,
    wildlifeStates,
    currentEntityId,
    getPlayerAge,
    villagerRebalance,
    findOwnedBuilding,
    findAvailableVillager,
    findOwnedUnit,
    findIdleProducer,
    ownedMilitaryUnitIds,
    findOwnedMilitaryUnits,
    hasOwnedWonder,
    isConstructingBuilding,
    pickWatchTowerPlacement,
    startConstruction,
    findBuildPlacementNear,
    countOwnedUnits,
    countQueuedUnits,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    assignAiMonkTasks,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyBuilding,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
  });

  registerAutoAggressionSystem({
    world,
    humanPlayerId,
    unitCommands,
    aiStates,
    combatStates,
    isGarrisonedUnit,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
    issueUnitAttackCommand,
  });

  registerPlayerCommandsSystem({
    world,
    unitCommands,
    combatStates,
    buildingHealthStates,
    buildingCombatStates,
    constructionStates,
    wildlifeStates,
    population,
    clearUnitCommand,
    currentEntityId,
    distanceToBuilding,
    advanceTrebuchetTransition,
    isTrebuchetStationary,
    isTrebuchetSilent,
    beginTrebuchetUnpack,
    beginTrebuchetPack,
    findUnitRangePlan,
    findBuildingApproachPlan,
    moveUnitOneSubgridStep,
    isUnitAtTarget,
    resolveMovePlanFromCache,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    destroyUnitEntity,
    killWildlifeEntity,
    destroyBuildingEntity,
    getEntityRef,
    onBuildingConstructionComplete,
  });

  registerMonkBehaviorSystem({
    world,
    monkTasks,
    monkConvertProcessedThisTick,
    monkCarriedRelic,
    distanceToBuilding,
    findBuildingApproachPlan,
    findUnitRangePlan,
    moveUnitOneSubgridStep,
    setPositionAndSyncOccupancy,
    applyMonkHeal,
    applyMonkConvert,
    applyMonkPickup,
    applyMonkDeposit,
  });

  registerRelicGoldSystem({ world, relicsInMonastery, playerResources });

  registerProductionQueueSystem({
    world,
    productionQueues,
    population,
    rallyPoints,
    inFlightTechByOwner,
    findBuildingSpawnPosition,
    addUnitEntity,
    issueUnitMoveCommand,
    applyTechnology,
  });

  registerScoutMovementSystem({
    world,
    humanPlayerId,
    unitCommands,
    isCellPassableForUnit,
    setPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
  });

  registerVillagerEconomySystem({
    world,
    unitCommands,
    sheepMoveOrders,
    gathererDropOffStuckSinceTick,
    playerResources,
    aiStates,
    shouldMaintainGatheringOrder,
    findResourceApproachPlan,
    isHarvestableResource,
    isUnitAtTarget,
    moveUnitOneSubgridStep,
    destroyResourceEntity,
    findNearestDropOffBuilding,
    findBuildingApproachPlan,
    ensurePlayerScoreCounters,
  });

  registerWildlifeCombatSystem({
    world,
    wildlifeStates,
    combatStates,
    currentEntityId,
    getEntityRef,
    findNearestHostileWildlifeTarget,
    findWildlifeRangePlan,
    setPositionAndSyncOccupancy,
    destroyUnitEntity,
    markOutOfBandRenderChange,
  });

  registerHerdableOwnershipSystem({ world, markOutOfBandRenderChange });

  registerHerdableMovementSystem({
    world,
    sheepMoveOrders,
    getUnitTransform,
    findMovementPlan,
    getNearestMoveCandidates,
    isCellPassableForWildlife,
    moveUnitOneSubgridStep,
    markOutOfBandRenderChange,
  });

  registerVisibilitySystem({ world, visibility, trackedVisibilitySources });

  registerFogMemorySystem({
    world,
    humanPlayerId,
    visibility,
    getOrCreateMemoryMap,
  });

  registerTowerCombatSystem({
    world,
    constructionStates,
    buildingCombatStates,
    combatStates,
    garrisonedByBuilding,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    destroyUnitEntity,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
  });

  registerWonderCountdownSystem({ world, wonderCountdowns, isMatchRunning });

  registerRelicCountdownSystem({
    world,
    relicCountdowns,
    relicCountdownOverrides,
    currentRelicHoldingOwner,
    defaultRelicCountdownTicks,
    isMatchRunning,
  });

  registerWinConditionResolverSystem({
    world,
    humanPlayerId,
    wonderCountdowns,
    relicCountdowns,
    isMatchRunning,
    finalizeMatchEnd,
  });

  registerConquestOutcomeSystem({
    world,
    humanPlayerId,
    playerResources,
    playerHasConquestPresence,
    isMatchRunning,
    finalizeMatchEnd,
  });
}
