// Type-only file for registerAllSystems' big deps interface. Lives apart
// so the runtime module stays under the project's 500-line target.

import type { Position, EntityRef } from 'civ-engine';
import { VisibilityMap } from 'civ-engine';

import type {
  AgeType,
  BuildableBuildingType,
  BuildingComponent,
  GathererComponent,
  MarketActionType,
  ResearchableTechnologyType,
  ResourceComponent,
  TrainableUnitType,
  UnitComponent,
  UnitTransformComponent,
  UnitType,
  VisionSourceComponent,
  EconomyResourceKind,
} from '../types';
import type { GameWorld } from './pureHelpers';
import type { AiState } from '../ai';
import type { UnitMovementPlan } from './movementTypes';
import type { MemoryEntry } from './memoryTypes';
import type { BridgeState } from './bridgeState';
import type { MonkTask } from './sharedTypes';

type CivWorld = GameWorld;

interface PlayerScoreCountersLike {
  unitsProduced: number;
  buildingsProduced: number;
  resourcesGathered: number;
  unitsKilled: number;
  wonderCompleted: boolean;
}

export interface RegisterAllSystemsDeps {
  world: GameWorld;
  systemMode?: 'live' | 'replay';
  humanPlayerId: number;
  visibility: VisibilityMap;
  defaultRelicCountdownTicks: number;
  state: BridgeState;
  // Phase 2D — accessor for migrated slots. Threaded into systems that
  // mutate Tier-1 slots flowing through `world.state.aoe2.*`.
  accessor: import('./bridgeStateAccessor').BridgeStateAccessor;
  // Phase 2E — visibility cell shared with the per-tick visibilitySystem,
  // which marks the cell dirty only when a vision source's fingerprint
  // changed (or one was added/removed). Stationary-source ticks no longer
  // re-publish visibility state at output phase.
  visibilityCell: import('./visibilityCell').VisibilityCell;
  // Phase 2E — fingerprint cache; same instance is used by the bootstrap
  // syncVisibilitySources call (in registerBridgeSystems) and by the per-
  // tick visibilitySystem so post-bootstrap tick-1 sees the prefilled
  // fingerprints and stays steady-state when nothing moved.
  visibilityFingerprints: Map<number, import('./visibility').VisibilitySourceFingerprint>;
  // AI helper closures.
  currentEntityId: (activeWorld: CivWorld, ref: EntityRef | null | undefined) => number | null;
  getPlayerAge: (owner: number) => AgeType;
  villagerRebalance: (owner: number, targets: AiState['villagerTargets']) => void;
  findOwnedBuilding: (owner: number, buildingType: BuildingComponent['buildingType']) => number | null;
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
  // v0.1.91: AI emits a market.action to cover an age-up shortfall (playerId
  // carried explicitly, like the human path); the validator gates ownership.
  pushMarketActionIntention: (playerId: number, actionType: MarketActionType) => void;
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
  pushUnitContextAtEntityIntention: (
    unitId: number,
    targetEntityId: number,
    garrison: boolean,
  ) => void;
  pushBuildingActionIntention: (buildingId: number, actionType: 'ungarrison') => void;
  pushAiMonkTaskIntentions: (
    owner: number,
    pushMonkContextAtEntityIntention: (
      monkId: number,
      targetEntityId: number,
      options: { expectedOwner: number; intendedTaskKind: MonkTask['kind'] },
    ) => void,
  ) => void;
  pushMonkContextAtEntityIntention: (
    monkId: number,
    targetEntityId: number,
    options: { expectedOwner: number; intendedTaskKind: MonkTask['kind'] },
  ) => void;
  findPreferredVisibleEnemyUnit: (owner: number, position: Position) => number | null;
  findPreferredVisibleEnemyBuilding: (owner: number, position: Position) => number | null;
  findPreferredEnemyUnitInRadius: (owner: number, position: Position, radius: number) => number | null;
  findPreferredEnemyBuildingInRadius: (owner: number, position: Position, radius: number) => number | null;
  findPreferredVisibleEnemyUnitInRangeOfBuilding: (
    owner: number,
    position: Position,
    footprint: { width: number; height: number },
    range: number,
    // Cells the building cannot reach because they are too CLOSE: an
    // attacker pressed against a Tower or Castle is under its arrow slits.
    minimumRange?: number,
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
  // systems. Pushes to `pendingCommands`; dispatcher submits before the
  // next step.
  pushUnitMoveIntention: (unitId: number, target: Position) => boolean;
  // Player-commands deps.
  clearUnitCommand: (id: number) => void;
  /** M6 control: the patrol system's own walk re-issue (keeps the route). */
  resumePatrolLeg: (unitId: number, target: import('civ-engine').Position) => boolean;
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
    laneAxis?: import('./movementTrafficOps').MovementLaneAxis,
  ) => void;
  isUnitAtTarget: (
    unitId: number,
    target: Position,
    activeWorld: CivWorld,
  ) => boolean;
  // Spec §12.7 lazy redirect: returns null if the unit found a free slot at
  // its arrival cell; returns a redirected target Position if the unit landed
  // in overflow and a free slot exists in a neighbor cell.
  resolveArrivalRedirect: (unitId: number, arrivalCell: Position) => Position | null;
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
  getUnitTargetTransformForPosition: (
    entityId: number,
    position: Position,
  ) => UnitTransformComponent;
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
  /** Whether a land unit can stand on this cell — the shore test for fish. */
  isLandCell: (x: number, y: number) => boolean;
  shouldMaintainGatheringOrder: (owner: number, gatherer: GathererComponent, isAiControlled: boolean) => boolean;
  findResourceApproachPlan: (
    villagerId: number,
    resourceId: number,
    activeWorld: CivWorld,
  ) => UnitMovementPlan | null;
  findNearestDropOffBuilding: (
    activeWorld: CivWorld,
    owner: number,
    resource: EconomyResourceKind,
    position: Position,
    excludeIds?: ReadonlySet<number>,
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
  // Arrival half of the garrison command: the walk is the command, this is the
  // step that puts the unit inside once it gets there.
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
  isMatchRunning: () => boolean;
  getOrCreateMemoryMap: (owner: number) => Map<number, MemoryEntry>;
  currentRelicHoldingOwner: () => number | null;
  finalizeMatchEnd: (
    outcome: 'victory' | 'defeat' | 'draw',
    winCondition: 'conquest' | 'wonder' | 'relic' | 'score',
    summary: string,
  ) => void;
  // Score-timer victory (spec §4.3): the per-owner score tally + the game
  // length (ticks) at which the highest-score player wins. `gameLength`
  // undefined = the score timer is disabled (conquest-only default).
  computePlayerScore: (owner: number) => number;
  gameLength: number | undefined;
}
