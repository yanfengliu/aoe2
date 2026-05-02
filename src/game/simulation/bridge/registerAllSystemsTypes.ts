// Type-only file for registerAllSystems' big deps interface. Lives apart
// so the runtime module stays under the project's 500-line target.

import type { Position, EntityRef, World } from 'civ-engine';
import { VisibilityMap } from 'civ-engine';

import type {
  AgeType,
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
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
import type { BridgeState } from './bridgeState';

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
  state: BridgeState;
  // AI helper closures.
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingComponent['buildingType']) => number | null;
  findAvailableVillager: (owner: number) => number | null;
  findOwnedUnit: (owner: number, unitType: UnitType) => number | null;
  ownedMilitaryUnitIds: (owner: number) => Set<number>;
  findOwnedMilitaryUnits: (owner: number) => Array<{ id: number }>;
  hasOwnedWonder: (owner: number) => boolean;
  isConstructingBuilding: (owner: number, buildingType: BuildingComponent['buildingType']) => boolean;
  pickWatchTowerPlacement: (
    townCenterPosition: Position,
    enemyPosition: Position,
  ) => Position | null;
  findBuildPlacementNear: (nearby: Position, buildingType: BuildingComponent['buildingType']) => Position | null;
  countOwnedUnits: (owner: number, unitType: UnitType) => number;
  countQueuedUnits: (buildingId: number, unitType: TrainableUnitType) => number;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  // Phase 1C: AI-decision intention pushers. Mirror existing
  // `pushUnitAttackIntention` / `pushUnitMoveIntention` semantics. The
  // synchronous pre-1C helpers (startConstruction / enqueueResearch /
  // enqueueTraining) are reachable to handlers via `wireBridgeOps` →
  // `registerCommandHandlers` deps; no system inside `registerAllSystems`
  // calls them anymore, so they aren't part of THIS interface.
  pushQueueResearchIntention: (
    buildingId: number,
    technologyType: ResearchableTechnologyType,
  ) => void;
  pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => void;
  pushBuildingPlaceConfirmIntention: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => void;
  // Read-only handle to the dispatcher's pending intention queue. aiSystem
  // folds these counts into its gates so it doesn't re-push every decision
  // tick before handlers land.
  pendingCommands: Array<{ type: string; data: Record<string, unknown> }>;
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
  // Phase 1B unit.attack (DESIGN v17 §6.5): commandified facade for HUD use;
  // intention pusher for AI-decision systems (aiSystem + autoAggressionSystem).
  // No deterministic-resolution system calls attack today, so no direct
  // helper threaded through this layer (the handler reaches the helper via
  // `unitCommandOps` → `registerCommandHandlers` deps directly).
  issueUnitAttackCommand: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  pushUnitAttackIntention: (
    attackerId: number,
    targetId: number,
    targetKind: 'unit' | 'building' | 'resource',
  ) => boolean;
  // Phase 1B unit.attack (post review-impl-3): guard helper for AI-decision
  // systems that need to coordinate ordering (e.g., autoAggression should
  // skip a unit aiSystem already commanded this tick).
  hasPendingUnitCommand: (unitId: number) => boolean;
  // Phase 1B unit.move (DESIGN v17 §6.4): commandified facade — used by
  // human-input dispatch only. NOT for systems running inside execute.
  issueUnitMoveCommand: (unitId: number, target: Position) => boolean;
  // Phase 1B unit.move (DESIGN v17 §6.4 B1): direct-mutation helper for
  // deterministic-resolution systems (productionQueueSystem rally,
  // monkTaskOps appliers). Mirrors the full facade body.
  setUnitMoveCommandDirect: (unitId: number, target: Position) => boolean;
  // Phase 1B unit.move (DESIGN v17 §6.5): intention pusher for AI-decision
  // systems. Pushes to `pendingCommands`; dispatcher submits AFTER step.
  pushUnitMoveIntention: (unitId: number, target: Position) => boolean;
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
    target: Position,
    range: number,
    activeWorld?: CivWorld,
  ) => UnitMovementPlan | null;
  findBuildingApproachPlan: (
    unitId: number,
    buildingId: number,
    range?: number,
    activeWorld?: CivWorld,
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
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
  currentRelicHoldingOwner: () => number | null;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: 'conquest' | 'wonder' | 'relic',
    summary: string,
  ) => void;
}
