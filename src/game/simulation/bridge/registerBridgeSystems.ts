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
import { HUMAN_PLAYER_ID, MAP_HEIGHT, MAP_WIDTH } from '../prototypeScenario';
import { RELIC_COUNTDOWN_TICKS } from './bridgeConstants';

type RegisterAllSystemsArg = Parameters<typeof registerAllSystems>[0];

export interface RegisterBridgeSystemsDeps {
  world: GameWorld;
  state: BridgeState;
  visibility: VisibilityMap;
  matchState: MatchState;
  placementMode: { current: BuildableBuildingType | null };
  isMatchRunning: () => boolean;
  // Helpers from bridgeHelpers
  currentEntityId: RegisterAllSystemsArg['currentEntityId'];
  getEntityRef: (id: number) => EntityRef | null;
  ensurePlayerScoreCounters: RegisterAllSystemsArg['ensurePlayerScoreCounters'];
  clearUnitCommand: (id: number) => void;
  markOutOfBandRenderChange: () => void;
  enqueueRejection: (reason: string) => void;
  getSeed: () => string;
  getUnitTaskState: (id: number) => UnitTaskState;
  // Pre-built factory results spread into registerAllSystems
  playerQueries: object;
  aiDecisionOps: object & { isAiMilitaryUnit: RegisterAllSystemsArg['isAiMilitaryUnit'] };
  targetFindingOps: object & {
    findNearestDropOffBuilding: RegisterAllSystemsArg['findNearestDropOffBuilding'];
  };
  trebuchetStateOps: object;
  movementPlanOps: object;
  entityDestroyOps: object;
  entityCreateOps: object;
  monkOps: object;
  transformOps: object;
  matchEndOps: object;
  // Direct values
  startConstruction: (
    builderId: number,
    buildingType: BuildableBuildingType,
    anchor: Position,
  ) => boolean;
  findBuildPlacementNear: RegisterAllSystemsArg['findBuildPlacementNear'];
  enqueueResearch: RegisterAllSystemsArg['enqueueResearch'];
  enqueueTraining: RegisterAllSystemsArg['enqueueTraining'];
  getTrainOptions: RegisterAllSystemsArg['getTrainOptions'];
  getResearchOptions: RegisterAllSystemsArg['getResearchOptions'];
  issueUnitAttackCommand: RegisterAllSystemsArg['issueUnitAttackCommand'];
  issueUnitMoveCommand: RegisterAllSystemsArg['issueUnitMoveCommand'];
  distanceToBuilding: RegisterAllSystemsArg['distanceToBuilding'];
  findBuildingSpawnPosition: RegisterAllSystemsArg['findBuildingSpawnPosition'];
  applyTechnology: RegisterAllSystemsArg['applyTechnology'];
  isCellPassableForUnit: RegisterAllSystemsArg['isCellPassableForUnit'];
  isCellPassableForWildlife: RegisterAllSystemsArg['isCellPassableForWildlife'];
  isHarvestableResource: RegisterAllSystemsArg['isHarvestableResource'];
  isGarrisonedUnit: RegisterAllSystemsArg['isGarrisonedUnit'];
  isPlacementBlocked: (x: number, y: number, w: number, h: number) => boolean;
  getOrCreateMemoryMap: RegisterAllSystemsArg['getOrCreateMemoryMap'];
  // Post-register factory inputs
  getSelectedEntityId: () => number | null;
  getSelectedEntityIds: () => number[];
  getSelectedOwnedSheepIds: () => number[];
  getSelectedHumanUnitIds: () => number[];
  getSelectedHumanVillagerIds: () => number[];
  isEntityVisibleToHuman: (id: number) => boolean;
  issueUnitContextCommand: (unitId: number, target: Position) => boolean;
  issueUnitContextCommandAtEntity: (unitId: number, targetEntityId: number) => boolean;
  issueSheepMoveCommand: (sheepId: number, target: Position) => boolean;
  executeMarketAction: Parameters<typeof createHumanInputOps>[0]['executeMarketAction'];
  ungarrisonBuilding: (id: number) => boolean;
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
  issueMarketAction: CreateWorldResult['issueMarketAction'];
}

export function registerBridgeSystems(
  deps: RegisterBridgeSystemsDeps,
): RegisterBridgeSystemsResult {
  const {
    world,
    state,
    visibility,
    matchState,
    placementMode,
    isMatchRunning,
    currentEntityId,
    getEntityRef,
    ensurePlayerScoreCounters,
    clearUnitCommand,
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
    startConstruction,
    findBuildPlacementNear,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    distanceToBuilding,
    findBuildingSpawnPosition,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isGarrisonedUnit,
    isPlacementBlocked,
    getOrCreateMemoryMap,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    getSelectedHumanVillagerIds,
    isEntityVisibleToHuman,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
    executeMarketAction,
    ungarrisonBuilding,
  } = deps;
  const { trackedVisibilitySources } = state;

  // Order matters: when a key appears in both a spread object and an
  // explicit field, the LATER assignment wins. The spreads contain
  // the bulk of the fields; explicit fields below cover anything not
  // in a spread (constants, raw helpers).
  registerAllSystems({
    ...(playerQueries as RegisterAllSystemsArg),
    ...(aiDecisionOps as RegisterAllSystemsArg),
    ...(targetFindingOps as RegisterAllSystemsArg),
    ...(trebuchetStateOps as RegisterAllSystemsArg),
    ...(movementPlanOps as RegisterAllSystemsArg),
    ...(entityDestroyOps as RegisterAllSystemsArg),
    ...(entityCreateOps as RegisterAllSystemsArg),
    ...(monkOps as RegisterAllSystemsArg),
    ...(transformOps as RegisterAllSystemsArg),
    ...(matchEndOps as RegisterAllSystemsArg),
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
    defaultRelicCountdownTicks: RELIC_COUNTDOWN_TICKS,
    state,
    currentEntityId,
    startConstruction,
    findBuildPlacementNear,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    clearUnitCommand,
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
    isMatchRunning,
    getOrCreateMemoryMap,
  });

  syncVisibilitySources(world, visibility, trackedVisibilitySources);

  const {
    issueMoveCommand,
    issueContextCommand,
    issueContextCommandAtEntityInternal,
    queueTrainUnit,
    queueResearch,
    issueAction,
    issueMarketAction,
  } = createHumanInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    state,
    placementMode,
    isMatchRunning,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    isEntityVisibleToHuman,
    enqueueRejection,
    issueUnitMoveCommand,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    ungarrisonBuilding,
  });

  const {
    getPlacementPreview,
    beginBuildingPlacement,
    confirmBuildingPlacement,
  } = createPlacementOps({
    world,
    state,
    placementMode,
    isMatchRunning,
    getSelectedHumanVillagerIds,
    isPlacementBlocked,
    startConstruction,
    enqueueRejection,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
  });

  const { saveGame } = createSaveGameOps({
    world,
    visibility,
    getSeed,
    matchState,
    state,
  });

  const { getEconomyState } = createEconomyStateOps({ world, state, getUnitTaskState });

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
    issueMarketAction,
  };
}
