// Registers all 18 ECS systems and wires the post-system factories
// (humanInput / placement / saveGame / economyState). Extracted from
// wireBridgeOps so the orchestrator stays narrow; this module is just
// the final glue between fully-built ops and the system loop.

import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import { shouldMaintainGatheringOrder, type GameWorld } from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { CreateWorldResult } from './createWorldResult';
import type {
  BuildableBuildingType,
  MatchState,
  UnitTaskState,
} from '../types';
import { syncVisibilitySources } from './visibility';
import { createHumanInputOps } from './humanInputOps';
import { createPlacementOps } from './placementOps';
import { createSaveGameOps } from './saveGameOps';
import { createEconomyStateOps } from './economyStateOps';
import { registerAllSystems } from './registerAllSystems';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import type { PlayerQueries } from './playerQueries';
import type { AiDecisionOps } from './aiDecisionOps';
import type { TargetFindingOps } from './targetFindingOps';
import type { TrebuchetStateOps } from './trebuchetState';
import type { MovementPlanOps } from './movementPlanOps';
import type { EntityDestroyOps } from './entityDestroyOps';
import type { EntityCreateOps } from './entityCreateOps';
import type { MonkTaskOps } from './monkTaskOps';
import type { TransformOps } from './transformOps';
import type { MatchEndOps } from './matchEndOps';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import { RELIC_COUNTDOWN_TICKS } from './bridgeConstants';

type RegisterAllSystemsArg = Parameters<typeof registerAllSystems>[0];

export interface RegisterBridgeSystemsDeps {
  world: GameWorld;
  systemMode?: RegisterAllSystemsArg['systemMode'];
  state: BridgeState;
  visibility: VisibilityMap;
  matchState: MatchState;
  placementMode: { current: BuildableBuildingType | null };
  // Phase 2E: visibility cell + fingerprint cache for the syncVisibility-
  // Sources bootstrap call AND the per-tick visibilitySystem. Both consume
  // the same instances so the per-tick optimization sees the bootstrap-
  // populated fingerprints and skips the redundant first-tick re-set.
  visibilityCell: import('./visibilityCell').VisibilityCell;
  visibilityFingerprints: Map<number, import('./visibility').VisibilitySourceFingerprint>;
  isMatchRunning: () => boolean;
  // Phase 2D — accessor threaded into createSaveGameOps for migrated slots.
  accessor: BridgeStateAccessor;
  // Helpers from bridgeHelpers
  currentEntityId: RegisterAllSystemsArg['currentEntityId'];
  getEntityRef: (id: number) => EntityRef | null;
  ensurePlayerScoreCounters: RegisterAllSystemsArg['ensurePlayerScoreCounters'];
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (id: number, command: import('./sharedTypes').UnitCommand) => void;
  markOutOfBandRenderChange: () => void;
  enqueueRejection: (reason: string) => void;
  getSeed: () => string;
  getUnitTaskState: (id: number) => UnitTaskState;
  // Pre-built factory results spread into registerAllSystems
  playerQueries: PlayerQueries;
  aiDecisionOps: AiDecisionOps;
  targetFindingOps: TargetFindingOps;
  trebuchetStateOps: TrebuchetStateOps;
  movementPlanOps: MovementPlanOps;
  entityDestroyOps: EntityDestroyOps;
  entityCreateOps: EntityCreateOps;
  monkOps: MonkTaskOps;
  transformOps: TransformOps;
  matchEndOps: MatchEndOps;
  // Score-timer game length (ticks) from the scenario, or undefined to disable
  // the score timer (conquest-only default).
  gameLength: number | undefined;
  // Direct values
  findBuildPlacementNear: RegisterAllSystemsArg['findBuildPlacementNear'];
  // Spec §12.7 group pre-reservation: pass through worldOccupancy's group
  // allocator so humanInputOps' issueMoveCommand can spiral-fill targets.
  allocateGroupMoveTargets: (
    unitIds: ReadonlyArray<number>,
    targetCenter: Position,
  ) => Position[];
  pushQueueResearchIntention: RegisterAllSystemsArg['pushQueueResearchIntention'];
  pushQueueTrainIntention: RegisterAllSystemsArg['pushQueueTrainIntention'];
  pushMarketActionIntention: RegisterAllSystemsArg['pushMarketActionIntention'];
  pushTributeIntention: RegisterAllSystemsArg['pushTributeIntention'];
  pushUnitContextIntention: RegisterAllSystemsArg['pushUnitContextIntention'];
  pushBuildingPlaceConfirmIntention: RegisterAllSystemsArg['pushBuildingPlaceConfirmIntention'];
  pushMonkContextAtEntityIntention: RegisterAllSystemsArg['pushMonkContextAtEntityIntention'];
  pushUnitContextAtEntityIntention: RegisterAllSystemsArg['pushUnitContextAtEntityIntention'];
  pushBuildingActionIntention: RegisterAllSystemsArg['pushBuildingActionIntention'];
  pendingCommands: RegisterAllSystemsArg['pendingCommands'];
  getTrainOptions: RegisterAllSystemsArg['getTrainOptions'];
  getResearchOptions: RegisterAllSystemsArg['getResearchOptions'];
  issueUnitAttackCommand: RegisterAllSystemsArg['issueUnitAttackCommand'];
  pushUnitAttackIntention: RegisterAllSystemsArg['pushUnitAttackIntention'];
  hasPendingUnitCommand: RegisterAllSystemsArg['hasPendingUnitCommand'];
  issueUnitMoveCommand: RegisterAllSystemsArg['issueUnitMoveCommand'];
  issueUnitAttackMoveCommand: (unitId: number, target: Position) => boolean;
  issueUnitPatrolCommand: (unitId: number, target: Position) => boolean;
  resumePatrolLeg: (unitId: number, target: Position) => boolean;
  setUnitMoveCommandDirect: RegisterAllSystemsArg['setUnitMoveCommandDirect'];
  pushUnitMoveIntention: RegisterAllSystemsArg['pushUnitMoveIntention'];
  distanceToBuilding: RegisterAllSystemsArg['distanceToBuilding'];
  findBuildingSpawnPosition: RegisterAllSystemsArg['findBuildingSpawnPosition'];
  applyTechnology: RegisterAllSystemsArg['applyTechnology'];
  isCellPassableForUnit: RegisterAllSystemsArg['isCellPassableForUnit'];
  isCellPassableForWildlife: RegisterAllSystemsArg['isCellPassableForWildlife'];
  isHarvestableResource: RegisterAllSystemsArg['isHarvestableResource'];
  isLandCell: RegisterAllSystemsArg['isLandCell'];
  isGarrisonedUnit: RegisterAllSystemsArg['isGarrisonedUnit'];
  isPlacementBlocked: (x: number, y: number, w: number, h: number) => boolean;
  getOrCreateMemoryMap: RegisterAllSystemsArg['getOrCreateMemoryMap'];
  // Post-register factory inputs
  getSelectedEntityId: () => number | null;
  getSelectedEntityIds: () => number[];
  getSelectedOwnedSheepIds: () => number[];
  getSelectedHumanUnitIds: () => number[];
  getSelectedHumanBuilderIds: () => number[];
  isEntityVisibleToHuman: (id: number) => boolean;
  issueUnitContextCommand: (unitId: number, target: Position) => boolean;
  issueUnitContextCommandAtEntity: (unitId: number, targetEntityId: number, garrison?: boolean, forceAttack?: boolean) => boolean;
  issueSheepMoveCommand: (sheepId: number, target: Position) => boolean;
  getBuildOptions: (
    owner: number,
    unitType: import('../types').UnitType,
  ) => readonly import('../types').BuildableBuildingType[];
  garrisonUnit: (unitId: number, buildingId: number) => boolean;
}

export interface RegisterBridgeSystemsResult {
  saveGame: CreateWorldResult['saveGame'];
  getEconomyState: CreateWorldResult['getEconomyState'];
  getPlacementPreview: CreateWorldResult['getPlacementPreview'];
  beginBuildingPlacement: CreateWorldResult['beginBuildingPlacement'];
  confirmBuildingPlacement: CreateWorldResult['confirmBuildingPlacement'];
  issueMoveCommand: CreateWorldResult['issueMoveCommand'];
  issueContextCommand: CreateWorldResult['issueContextCommand'];
  issueContextCommandAtEntity: CreateWorldResult['issueContextCommandAtEntity'];
  queueTrainUnit: CreateWorldResult['queueTrainUnit'];
  queueResearch: CreateWorldResult['queueResearch'];
  issueAction: CreateWorldResult['issueAction'];
  setSelectionStance: CreateWorldResult['setSelectionStance'];
  setSelectionFormation: CreateWorldResult['setSelectionFormation'];
  issueAttackMoveCommand: CreateWorldResult['issueAttackMoveCommand'];
  issuePatrolCommand: CreateWorldResult['issuePatrolCommand'];
  issueMarketAction: CreateWorldResult['issueMarketAction'];
}

export function registerBridgeSystems(
  deps: RegisterBridgeSystemsDeps,
): RegisterBridgeSystemsResult {
  const {
    world,
    systemMode,
    state,
    visibility,
    matchState,
    placementMode,
    isMatchRunning,
    accessor,
    visibilityCell,
    visibilityFingerprints,
    currentEntityId,
    getEntityRef,
    ensurePlayerScoreCounters,
    clearUnitCommand,
    setUnitCommand,
    markOutOfBandRenderChange,
    enqueueRejection,
    getSeed,
    getUnitTaskState,
    playerQueries,
    aiDecisionOps,
    targetFindingOps,
    trebuchetStateOps,
    movementPlanOps,
    entityDestroyOps,
    entityCreateOps,
    monkOps,
    transformOps,
    matchEndOps,
    gameLength,
    findBuildPlacementNear,
    allocateGroupMoveTargets,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pushMarketActionIntention,
    pushTributeIntention,
    pushUnitContextIntention,
    pushBuildingPlaceConfirmIntention,
    pushMonkContextAtEntityIntention,
    pushUnitContextAtEntityIntention,
    pushBuildingActionIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    issueUnitAttackCommand,
    pushUnitAttackIntention,
    hasPendingUnitCommand,
    issueUnitMoveCommand,
    issueUnitAttackMoveCommand,
    issueUnitPatrolCommand,
    resumePatrolLeg,
    setUnitMoveCommandDirect,
    pushUnitMoveIntention,
    distanceToBuilding,
    findBuildingSpawnPosition,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isLandCell,
    isGarrisonedUnit,
    garrisonUnit,
    isPlacementBlocked,
    getOrCreateMemoryMap,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    getSelectedHumanBuilderIds,
    getBuildOptions,
    isEntityVisibleToHuman,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
  } = deps;

  // Order matters: when a key appears in both a spread object and an
  // explicit field, the LATER assignment wins. The spreads contain
  // the bulk of the fields; explicit fields below cover anything not
  // in a spread (constants, raw helpers).
  registerAllSystems({
    isLandCell,
    ...playerQueries,
    ...aiDecisionOps,
    ...targetFindingOps,
    ...trebuchetStateOps,
    ...movementPlanOps,
    ...entityDestroyOps,
    ...entityCreateOps,
    ...monkOps,
    ...transformOps,
    ...matchEndOps,
    world,
    systemMode,
    humanPlayerId: HUMAN_PLAYER_ID,
    gameLength,
    visibility,
    defaultRelicCountdownTicks: RELIC_COUNTDOWN_TICKS,
    accessor,
    visibilityCell,
    visibilityFingerprints,
    state,
    currentEntityId,
    findBuildPlacementNear,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pushMarketActionIntention,
    pushTributeIntention,
    pushUnitContextIntention,
    pushBuildingPlaceConfirmIntention,
    pushMonkContextAtEntityIntention,
    pushUnitContextAtEntityIntention,
    pushBuildingActionIntention,
    pendingCommands,
    getTrainOptions,
    getResearchOptions,
    issueUnitAttackCommand,
    pushUnitAttackIntention,
    hasPendingUnitCommand,
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    pushUnitMoveIntention,
    clearUnitCommand,
    setUnitCommand,
    resumePatrolLeg,
    distanceToBuilding,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    getEntityRef,
    findBuildingSpawnPosition,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    shouldMaintainGatheringOrder,
    isGarrisonedUnit,
    garrisonUnit,
    isMatchRunning,
    getOrCreateMemoryMap,
  });

  syncVisibilitySources(
    world,
    visibility,
    accessor,
    visibilityFingerprints,
    visibilityCell,
  );

  const {
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    setSelectionStance,
    setSelectionFormation,
    issueAttackMoveCommand,
    issuePatrolCommand,
    issueMarketAction,
  } = createHumanInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    state,
    accessor,
    placementMode,
    isMatchRunning,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    isEntityVisibleToHuman,
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitAttackMoveCommand,
    issueUnitPatrolCommand,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
    allocateGroupMoveTargets,
  });

  const {
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  } = createPlacementOps({
    world,
    state,
    accessor,
    placementMode,
    isMatchRunning,
    getSelectedHumanBuilderIds,
    getBuildOptions,
    isPlacementBlocked,
    enqueueRejection,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
  });

  const { saveGame } = createSaveGameOps({
    world,
    getSeed,
    matchState,
    state,
    accessor,
    visibilityCell,
  });

  const { getEconomyState } = createEconomyStateOps({ world, state, accessor, getUnitTaskState });

  return {
    saveGame,
    getEconomyState,
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntity: issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    setSelectionStance,
    setSelectionFormation,
    issueAttackMoveCommand,
    issuePatrolCommand,
    issueMarketAction,
  };
}
