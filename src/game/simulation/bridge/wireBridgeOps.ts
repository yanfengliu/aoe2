import { buildingFootprint, currentEntityId } from './pureHelpers';
import type { UnitTaskState } from '../types';
import { DEFAULT_DIFFICULTY } from '../ai';
import { createTrebuchetStateOps } from './trebuchetState';
import { createFogMemoryOps } from './fogMemoryOps';
import { createMatchEndOps } from './matchEndOps';
import { createCombatStateFactory } from './combatStateFactory';
import { createEntityCreateOps } from './entityCreateOps';
import { createCellPassability } from './cellPassability';
import {
  hydrateFromSavedGame,
  seedFreshScenario,
} from './scenarioSeedOps';
import { createDebugSnapshotOps } from './debugSnapshotOps';
import { createTransformOps } from './transformOps';
import { createMovementPlanOps } from './movementPlanOps';
import { createOptionsRules } from './optionsRules';
import { createPlayerQueries } from './playerQueries';
import { createSpawnFinders, createGathererOrderOps } from './bridgeHelpers';
import { registerBridgeSystems } from './registerBridgeSystems';
import { registerCommandHandlers } from './registerCommandHandlers';
import { wirePostSeedOps } from './wirePostSeedOps';
import {
  HUMAN_PLAYER_ID,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../prototypeScenario';
import {
  STANDARD_POPULATION_CAP,
  STANDARD_STARTING_RESOURCES,
  WONDER_COUNTDOWN_TICKS,
} from './bridgeConstants';

export type { WireBridgeOpsDeps, WireBridgeOpsResult } from './wireBridgeOpsTypes';
import type {
  WireBridgeOpsDeps,
  WireBridgeOpsResult,
} from './wireBridgeOpsTypes';

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
  const { movePathCache, trebuchetPackStates, lastSeenStatic } = state;

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

  if (!savedGame && scenario) {
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

  const postSeed = wirePostSeedOps({
    world,
    state,
    visibility,
    selection,
    placementMode,
    inFlightTechSetFor,
    clearUnitCommand,
    setUnitCommand,
    getEntityRef,
    getCurrentEntityId,
    markOutOfBandRenderChange,
    isMatchRunning,
    createCombatState,
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isPlacementBlocked,
    isGarrisonedUnit,
    isHarvestableResource,
    getActionOptions,
    getApproachCellsForFootprint,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncUnitTransformToPosition,
    addBuildingEntity,
    addResourceEntity,
    findBuildingSpawnPosition,
    clearGathererOrder,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    getVisibleResearchOptions,
  });
  const {
    visibilityQueries,
    selectionInputOps,
    entityDestroyOps,
    trainingMarketOps,
    selectionStateOps,
    targetFindingOps,
    technologyOps,
    aiDecisionOps,
    monkOps,
    unitCommandOps,
  } = postSeed;
  const { isEntityVisibleToHuman } = visibilityQueries;
  const {
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectByRefs,
    selectUnitsInBox,
    selectOwnedUnitsByTypeInRect,
    getSelectedEntityIds,
    getSelectedEntityRefs,
    getSelectedEntityId,
    distanceToBuilding,
  } = selectionInputOps;
  const {
    enqueueTraining,
    enqueueResearch,
    executeMarketAction,
    ungarrisonBuilding,
    startConstruction,
    findBuildPlacementNear,
  } = trainingMarketOps;
  const { getEntityHealth, getSelectionState } = selectionStateOps;
  const { applyTechnology } = technologyOps;
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
  } = unitCommandOps;

  const finalize = registerBridgeSystems({
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
  });

  // Phase 1A: command-handler scaffold registration (DESIGN v17 §6.4 Tier 0).
  // Empty until Phase 1B commits add per-command validators + handlers.
  registerCommandHandlers(world, {});

  return {
    ...finalize,
    getPlayerAge,
    getSelectionState,
    getEntityHealth,
    selectEntityAtCell,
    selectEntityById,
    selectOwnedUnitsByTypeInRect,
    filterSelectableUnitIds,
    selectUnitsByIds,
    selectByRefs,
    selectUnitsInBox,
    clearSelection,
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    getSelectedEntityIds,
    getSelectedEntityRefs,
  };
}
