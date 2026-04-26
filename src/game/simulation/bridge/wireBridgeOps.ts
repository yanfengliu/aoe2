import type { EntityRef, Position, VisibilityMap } from 'civ-engine';

import {
  buildingFootprint,
  currentEntityId,
  shouldMaintainGatheringOrder,
  type GameWorld,
} from './pureHelpers';
import type { BridgeState } from './bridgeState';
import type { CreateWorldResult } from './createWorldResult';
import type { SaveBlob } from '../saveSchema';
import type { PrototypeScenario } from '../prototypeScenario';
import type { MatchState, BuildableBuildingType, UnitTaskState } from '../types';
import { unitTint } from '../prototypeUnitRules';
import {
  AI_MONK_HEAL_HP_FRACTION,
  AI_WATCH_TOWER_FORWARD_STEP,
  DEFAULT_DIFFICULTY,
} from '../ai';
import { syncVisibilitySources } from './visibility';
import { createTrebuchetStateOps } from './trebuchetState';
import { createFogMemoryOps } from './fogMemoryOps';
import { createMonkTaskOps } from './monkTaskOps';
import { createTechnologyOps } from './technologyOps';
import { createMatchEndOps } from './matchEndOps';
import { createAiDecisionOps } from './aiDecisionOps';
import { createPlacementOps } from './placementOps';
import { createSaveGameOps } from './saveGameOps';
import { createEntityDestroyOps } from './entityDestroyOps';
import { createCombatStateFactory } from './combatStateFactory';
import { createEntityCreateOps } from './entityCreateOps';
import { createHumanInputOps } from './humanInputOps';
import { createCellPassability } from './cellPassability';
import { registerAllSystems } from './registerAllSystems';
import {
  hydrateFromSavedGame,
  seedFreshScenario,
} from './scenarioSeedOps';
import { createDebugSnapshotOps } from './debugSnapshotOps';
import { createEconomyStateOps } from './economyStateOps';
import { createTransformOps } from './transformOps';
import { createVisibilityQueries } from './visibilityQueries';
import { createSelectionInputOps } from './selectionInputOps';
import { createTrainingMarketOps } from './trainingMarketOps';
import { createUnitCommandOps } from './unitCommandOps';
import { createMovementPlanOps } from './movementPlanOps';
import { createOptionsRules } from './optionsRules';
import { createPlayerQueries } from './playerQueries';
import { createSelectionStateOps } from './selectionStateOps';
import { createTargetFindingOps } from './targetFindingOps';
import { createSpawnFinders, createGathererOrderOps } from './bridgeHelpers';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../prototypeScenario';
import {
  MARKET_FEE_RATE,
  MARKET_MIN_RATE,
  MARKET_RATE_STEP,
  MARKET_TRANSACTION_AMOUNT,
  MONK_CONVERT_FLIP_THRESHOLD,
  MONK_CONVERT_PROGRESS_PER_TICK,
  MONK_HEAL_HP_PER_INTERVAL,
  MONK_HEAL_TICK_INTERVAL,
  RELIC_COUNTDOWN_TICKS,
  STANDARD_POPULATION_CAP,
  STANDARD_STARTING_RESOURCES,
  WONDER_COUNTDOWN_TICKS,
} from './bridgeConstants';

export interface WireBridgeOpsDeps {
  world: GameWorld;
  state: BridgeState;
  visibility: VisibilityMap;
  matchState: MatchState;
  savedGame: SaveBlob | undefined;
  scenario: PrototypeScenario;
  worldOccupancy: import('../worldOccupancy').WorldOccupancy;
  tiles: number[][];
  selection: { refs: EntityRef[]; focusCell: Position | null };
  placementMode: { current: BuildableBuildingType | null };
  isBootstrappingScenarioRef: { current: boolean };
  ensurePlayerScoreCounters: (owner: number) => {
    unitsProduced: number;
    buildingsProduced: number;
    resourcesGathered: number;
    unitsKilled: number;
    wonderCompleted: boolean;
  };
  ensureAiState: (owner: number, difficulty?: import('../ai').DifficultyLevel) => import('../ai').AiState;
  inFlightTechSetFor: (owner: number) => Set<import('../types').ResearchableTechnologyType>;
  clearUnitCommand: (id: number) => void;
  setUnitCommand: (id: number, command: import('../createSimulationBridge').UnitCommand) => void;
  getCurrentEntityId: (ref: EntityRef | null) => number | null;
  getEntityRef: (id: number) => EntityRef | null;
  getUnitTaskStateInternal: (id: number, isGarrisonedUnit: (id: number) => boolean) => UnitTaskState;
  enqueueRejection: (reason: string) => void;
  markOutOfBandRenderChange: () => void;
  getSeed: () => string;
}

export type WireBridgeOpsResult = Omit<
  CreateWorldResult,
  | 'world'
  | 'getPopulationState'
  | 'getPlayerResources'
  | 'getMatchState'
  | 'isSelected'
  | 'consumeOutOfBandRenderChange'
  | 'consumeCommandRejection'
> & {
  getHumanWonderCountdownTicks: () => number | null;
  getHumanRelicCountdownTicks: () => number | null;
  getSelectedEntityIds: () => number[];
};

export function wireBridgeOps(deps: WireBridgeOpsDeps): WireBridgeOpsResult {
  const {
    world,
    state,
    visibility,
    matchState,
    savedGame,
    scenario,
    worldOccupancy,
    tiles,
    selection,
    placementMode,
    isBootstrappingScenarioRef,
    ensurePlayerScoreCounters,
    ensureAiState,
    inFlightTechSetFor,
    clearUnitCommand,
    setUnitCommand,
    getCurrentEntityId,
    getEntityRef,
    getUnitTaskStateInternal,
    enqueueRejection,
    markOutOfBandRenderChange,
    getSeed,
  } = deps;
  const { trackedVisibilitySources, movePathCache, trebuchetPackStates, lastSeenStatic } = state;

  const trebuchetStateOps = createTrebuchetStateOps(trebuchetPackStates);

  const {
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } = createFogMemoryOps({
    fogMemory: lastSeenStatic,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  const { getDebugSnapshot } = createDebugSnapshotOps({ world, state });

  const matchEndOps = createMatchEndOps({
    world,
    matchState,
    humanPlayerId: HUMAN_PLAYER_ID,
    state,
  });
  const { getHumanWonderCountdownTicks, getHumanRelicCountdownTicks } = matchEndOps;

  const { getEntityHealth, getSelectionState } = createSelectionStateOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    state,
    placementMode,
    getSelectedEntityIds: () => getSelectedEntityIds(),
    resolveSelectionTile: (id, position) => resolveSelectionTile(id, position),
    getSelectableEntitiesAtCell: (x, y) => getSelectableEntitiesAtCell(x, y),
    getCurrentEntityId,
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    getActionOptions: (owner, buildingType, buildingId) => getActionOptions(owner, buildingType, buildingId),
    getTrainOptions: (owner, buildingType) => getTrainOptions(owner, buildingType),
    getMarketOptions: (owner, buildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner, unitType) => getBuildOptions(owner, unitType),
    getResearchOptions: (owner, buildingType) => getResearchOptions(owner, buildingType),
    getVisibleResearchOptions: (owner, buildingType) => getVisibleResearchOptions(owner, buildingType),
  });

  const transformOps = createTransformOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    worldOccupancy,
    tiles,
    state,
    isBootstrappingScenario: () => isBootstrappingScenarioRef.current,
  });
  const {
    syncUnitTransformToPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  } = transformOps;

  const playerQueries = createPlayerQueries({ world, state });
  const {
    hasTechnology,
    hasCompletedBuilding,
    getPlayerAge,
    getPlayerCivilization,
    isAtLeastAge,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    latestResearchedInChain,
    hasOwnedWonder,
  } = playerQueries;

  const createCombatState = createCombatStateFactory({ hasTechnology });

  const entityCreateOps = createEntityCreateOps({
    world,
    wonderCountdownTicks: WONDER_COUNTDOWN_TICKS,
    state,
    ensurePlayerScoreCounters,
    createCombatState,
    syncSpawnedEntityOccupancy,
    getEntityRef,
  });
  const { addUnitEntity, addBuildingEntity, addResourceEntity } = entityCreateOps;

  const {
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isCellPassableForSpawn,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isPlacementBlocked,
    isGarrisonedUnit,
    getActionOptions,
  } = createCellPassability({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    worldOccupancy,
    tiles,
    state,
  });

  const movementPlanOps = createMovementPlanOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    movePathCache,
    isCellPassableForUnit,
    isCellPassableForWildlife,
  });
  const {
    uniquePositions,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
  } = movementPlanOps;

  const { findScenarioSpawnPosition, findBuildingSpawnPosition } = createSpawnFinders({
    uniquePositions,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
    isCellPassableForSpawn,
    buildingFootprint,
  });
  const { clearGathererOrder } = createGathererOrderOps({ world, state });

  if (!savedGame) {
    seedFreshScenario({
      world,
      scenario,
      tiles,
      humanPlayerId: HUMAN_PLAYER_ID,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
      standardStartingResources: STANDARD_STARTING_RESOURCES,
      standardPopulationCap: STANDARD_POPULATION_CAP,
      defaultDifficulty: DEFAULT_DIFFICULTY,
      state,
      ensureAiState,
      addBuildingEntity,
      addUnitEntity,
      addResourceEntity,
      findScenarioSpawnPosition,
      buildingOccupiesCell,
      isTerrainPassableForUnit,
      isCellBlockedByBuilding,
    });
  }

  if (savedGame) {
    hydrateFromSavedGame({
      world,
      savedGame,
      matchState,
      state,
      setUnitCommand,
      inFlightTechSetFor,
    });
  }

  isBootstrappingScenarioRef.current = false;
  rebuildWorldOccupancyFromWorld();

  const getUnitTaskState = (id: number): UnitTaskState =>
    getUnitTaskStateInternal(id, isGarrisonedUnit);

  function isMatchRunning(): boolean {
    return matchState.outcome === 'running';
  }

  const {
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    isEntityVisibleToHuman,
  } = createVisibilityQueries({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  const {
    getSelectableEntitiesAtCell,
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectUnitsInBox,
    selectOwnedUnitsByTypeInRect,
    getSelectedEntityIds,
    getSelectedEntityId,
    removeSelectedEntity,
    findResourceAtCell,
    resolveSelectionTile,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findOwnedGarrisonBuildingAtCell,
    distanceToBuilding,
  } = createSelectionInputOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    visibility,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isVisibleToHuman,
    isEntityFootprintVisibleToHuman,
    buildingOccupiesCell,
    getEntityRef,
    getCurrentEntityId,
  });

  const entityDestroyOps = createEntityDestroyOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    state,
    removeSelectedEntity,
    clearUnitCommand,
    getApproachCellsForFootprint,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    addResourceEntity,
    markOutOfBandRenderChange,
  });

  const {
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    garrisonUnit,
    ungarrisonBuilding,
    startConstruction,
    findBuildPlacementNear,
  } = createTrainingMarketOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    marketFeeRate: MARKET_FEE_RATE,
    marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    marketRateStep: MARKET_RATE_STEP,
    marketMinRate: MARKET_MIN_RATE,
    state,
    placementMode,
    inFlightTechSetFor,
    getSelectedEntityId,
    getTrainOptions: (owner, buildingType) => getTrainOptions(owner, buildingType),
    getResearchOptions: (owner, buildingType) => getResearchOptions(owner, buildingType),
    getMarketOptions: (owner, buildingType) => getMarketOptions(owner, buildingType),
    getBuildOptions: (owner, unitType) => getBuildOptions(owner, unitType),
    isPlacementBlocked,
    isGarrisonedUnit,
    clearGathererOrder,
    clearUnitCommand,
    clearSelection: () => {
      selection.refs = [];
      selection.focusCell = null;
    },
    setUnitCommand,
    addBuildingEntity,
    findBuildingSpawnPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    getEntityRef,
    markOutOfBandRenderChange,
  });

  const {
    getTrainOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    getMarketOptions,
    getBuildOptions,
  } = createOptionsRules({
    latestResearchedInChain,
    hasTechnology,
    getPlayerAge,
    isAtLeastAge,
    getPlayerCivilization,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    hasCompletedBuilding,
    hasOwnedWonder,
  });

  const targetFindingOps = createTargetFindingOps({ world, visibility, state });
  const { findNearestDropOffBuilding } = targetFindingOps;

  const { applyTechnology } = createTechnologyOps({
    world,
    state,
    createCombatState,
    markOutOfBandRenderChange,
  });

  const aiDecisionOps = createAiDecisionOps({
    world,
    state,
    findBuildPlacementNear,
    aiWatchTowerForwardStep: AI_WATCH_TOWER_FORWARD_STEP,
  });
  const { isAiMilitaryUnit } = aiDecisionOps;

  const monkOps = createMonkTaskOps({
    world,
    state,
    clearUnitCommand,
    clearGathererOrder,
    markOutOfBandRenderChange,
    getEntityRef,
    destroyResourceEntity: (id) => entityDestroyOps.destroyResourceEntity(id),
    buildingOccupiesCell,
    issueUnitMoveCommand: (unitId, target) => issueUnitMoveCommand(unitId, target),
    isAiMilitaryUnit,
    isVisibleToOwner: (owner, x, y) => visibility.isVisible(owner, x, y),
    currentEntityId,
    unitTint,
    aiMonkHealHpFraction: AI_MONK_HEAL_HP_FRACTION,
    monkHealTickInterval: MONK_HEAL_TICK_INTERVAL,
    monkHealHpPerInterval: MONK_HEAL_HP_PER_INTERVAL,
    monkConvertProgressPerTick: MONK_CONVERT_PROGRESS_PER_TICK,
    monkConvertFlipThreshold: MONK_CONVERT_FLIP_THRESHOLD,
  });
  const {
    clearMonkTask,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
  } = monkOps;

  const {
    issueUnitMoveCommand,
    issueSheepMoveCommand,
    getSelectedOwnedSheepIds,
    issueUnitAttackCommand,
    getSelectedHumanUnitIds,
    getSelectedHumanVillagerIds,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    selectEntityAtCell,
    selectEntityById,
    clearSelection,
  } = createUnitCommandOps({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    state,
    selection,
    placementMode,
    isMatchRunning,
    isEntityVisibleToHuman,
    getSelectedEntityIds,
    getSelectableEntitiesAtCell,
    findResourceAtCell,
    findOwnedGarrisonBuildingAtCell,
    findHostileUnitAtCell,
    findHostileBuildingAtCell,
    findHostileWildlifeAtCell,
    findMonkContextTargetAtCell,
    issueMonkContextCommandAtEntity,
    clearMonkTask,
    garrisonUnit,
    isHarvestableResource,
    findNearestDropOffBuilding,
    clearGathererOrder,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
  });

  registerAllSystems({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
    defaultRelicCountdownTicks: RELIC_COUNTDOWN_TICKS,
    state,
    currentEntityId,
    ...playerQueries,
    ...aiDecisionOps,
    startConstruction,
    findBuildPlacementNear,
    enqueueResearch,
    enqueueTraining,
    getTrainOptions,
    getResearchOptions,
    ...targetFindingOps,
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    clearUnitCommand,
    distanceToBuilding,
    ...trebuchetStateOps,
    ...movementPlanOps,
    markOutOfBandRenderChange,
    ensurePlayerScoreCounters,
    ...entityDestroyOps,
    getEntityRef,
    ...entityCreateOps,
    ...monkOps,
    findBuildingSpawnPosition,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    shouldMaintainGatheringOrder,
    findNearestDropOffBuilding,
    ...transformOps,
    isGarrisonedUnit,
    isMatchRunning,
    isAiMilitaryUnit,
    getOrCreateMemoryMap,
    ...matchEndOps,
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
    getPlayerAge,
    getSelectionState,
    getPlacementPreview,
    getEntityHealth,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectUnitsInBox,
    clearSelection,
    issueContextCommand,
    issueContextCommandAtEntity: issueContextCommandAtEntityInternal,
    issueMoveCommand,
    issueAction,
    queueTrainUnit,
    queueResearch,
    issueMarketAction,
    beginBuildingPlacement,
    confirmBuildingPlacement,
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    getSelectedEntityIds,
  };
}
