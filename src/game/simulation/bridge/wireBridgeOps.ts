import type { Position } from 'civ-engine';

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
  MARKET_FEE_RATE,
  MARKET_TRANSACTION_AMOUNT,
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
    executeMarketActionDirect,
    playerOwnsCompletedMarket,
    ungarrisonBuilding,
    startConstruction,
    findBuildPlacementNear,
  } = trainingMarketOps;
  const { getEntityHealth, getSelectionState } = selectionStateOps;
  const { applyTechnology } = technologyOps;
  const {
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    issueSheepMoveCommand,
    getSelectedOwnedSheepIds,
    issueUnitAttackCommand,
    // setUnitAttackCommandDirect + setUnitGatherCommandDirect are used by the
    // registerCommandHandlers call below, but NOT threaded into any system —
    // no deterministic-resolution system calls attack or gather today, and
    // their AI-decision counterparts (when they exist) push intentions
    // instead. Bridge facade routes HUD-time calls through submitWithResult.
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    setSheepMoveCommandDirect,
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
    // Phase 1B unit.attack (DESIGN v17 §6.5): AI-decision systems push to
    // `pendingCommands`. Returns `true` so callers can preserve `if (issued)`
    // flow.
    pushUnitAttackIntention: (
      attackerId: number,
      targetId: number,
      targetKind: 'unit' | 'building' | 'resource',
    ) => {
      state.pendingCommands.push({
        type: 'unit.attack',
        data: { unitId: attackerId, targetEntityId: targetId, targetEntityKind: targetKind },
      });
      return true;
    },
    // Phase 1B unit.attack (post review-impl-3): preserves the pre-1B
    // priority where aiSystem's strategic target wins over autoAggression's
    // local target when both want the same unit on the same tick. Linear
    // scan over the queue (typically <10 entries per tick during AI macro);
    // returns true if any unit.move/unit.attack intention is queued for the
    // given unit.
    hasPendingUnitCommand: (unitId: number) => {
      for (const cmd of state.pendingCommands) {
        if ((cmd.type === 'unit.move' || cmd.type === 'unit.attack')
            && cmd.data.unitId === unitId) {
          return true;
        }
      }
      return false;
    },
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    // Phase 1B unit.move (DESIGN v17 §6.5): AI-decision systems push to
    // `pendingCommands` during `execute`; the dispatcher submits between
    // ticks. Returns `true` so callers can preserve their existing
    // `if (issued)` flow even though the actual handler runs at next step.
    pushUnitMoveIntention: (unitId: number, target: Position) => {
      state.pendingCommands.push({ type: 'unit.move', data: { unitId, target } });
      return true;
    },
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
  });

  // Phase 1A scaffold + Phase 1B per-command registrations (DESIGN v17 §6.4).
  // Each Phase 1B commit threads its direct-mutation helper into deps so the
  // handler delegates to the same code path deterministic systems use.
  registerCommandHandlers(world, {
    setUnitMoveCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    setSheepMoveCommandDirect,
    enqueueTrainingDirect: enqueueTraining,
    queueTrainValidatorDeps: {
      constructionStates: state.constructionStates,
      playerResources: state.playerResources,
      getTrainOptions,
    },
    enqueueResearchDirect: enqueueResearch,
    queueResearchValidatorDeps: {
      constructionStates: state.constructionStates,
      playerResources: state.playerResources,
      getResearchOptions,
      inFlightTechSetFor,
    },
    executeMarketActionDirect,
    marketActionValidatorDeps: {
      playerResources: state.playerResources,
      marketExchangeRates: state.marketExchangeRates,
      getMarketOptions,
      playerOwnsCompletedMarket,
      marketFeeRate: MARKET_FEE_RATE,
      marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    },
    startConstructionDirect: startConstruction,
    buildingPlaceConfirmValidatorDeps: {
      playerResources: state.playerResources,
      getBuildOptions,
      isPlacementBlocked,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
    },
    rallyPoints: state.rallyPoints,
    buildingSetRallyPointValidatorDeps: {
      constructionStates: state.constructionStates,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
    },
    ungarrisonBuildingDirect: ungarrisonBuilding,
    buildingActionValidatorDeps: {
      constructionStates: state.constructionStates,
    },
  });

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
