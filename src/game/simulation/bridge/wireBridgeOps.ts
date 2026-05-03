import type { Position } from 'civ-engine';

import { buildingFootprint, currentEntityId } from './pureHelpers';
import { hasPendingUnitCommand } from './pendingCommandQuery';
import type {
  BuildableBuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitTaskState,
} from '../types';
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
import { registerOutputTail } from './registerOutputTail';
import { VisibilityCell } from './visibilityCell';
import { bootstrapFlush } from './bootstrapFlush';
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
    accessor,
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
  const { movePathCache } = state;

  // Phase 2D — accessor is constructed in `createWorld.ts` (so
  // bridgeHelpers can also consume it) and threaded in via deps.
  // visibility cell still constructed here since it's bridge-internal.
  const visibilityCell = new VisibilityCell(visibility);
  // Phase 2E: closure-scoped fingerprint cache shared between the
  // bootstrap syncVisibilitySources call (in registerBridgeSystems) and
  // the per-tick visibilitySystem. The per-tick system uses these to
  // detect "no source moved this tick" and skip the visibility cell's
  // markDirty path; without sharing the bootstrap-populated cache, tick 1
  // would redundantly re-setSource every entity. Save/load doesn't
  // round-trip these — every bridge construction (fresh world or post-
  // load) starts with an empty Map and the bootstrap call (which runs
  // after world hydration, before tick 1) repopulates it from world.query.
  const visibilityFingerprints = new Map<
    number,
    import('./visibility').VisibilitySourceFingerprint
  >();

  const trebuchetStateOps = createTrebuchetStateOps(accessor);

  const {
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } = createFogMemoryOps({
    accessor,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  const { getDebugSnapshot } = createDebugSnapshotOps({ world, state, accessor });

  const matchEndOps = createMatchEndOps({
    world,
    matchState,
    humanPlayerId: HUMAN_PLAYER_ID,
    state,
    accessor,
  });
  const { getHumanWonderCountdownTicks, getHumanRelicCountdownTicks } = matchEndOps;

  const transformOps = createTransformOps({
    world,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    worldOccupancy,
    tiles,
    accessor,
    isBootstrappingScenario: () => isBootstrappingScenarioRef.current,
  });
  const {
    syncUnitTransformToPosition,
    setPositionAndSyncOccupancy,
    clearPositionAndSyncOccupancy,
    syncSpawnedEntityOccupancy,
    rebuildWorldOccupancyFromWorld,
  } = transformOps;

  const playerQueries = createPlayerQueries({ world, state, accessor });
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
    accessor,
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
    accessor,
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
  const { clearGathererOrder } = createGathererOrderOps({ world, state, accessor });

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
      accessor,
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
      accessor,
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
    accessor,
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
    accessor,
    visibilityCell,
    visibilityFingerprints,
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
    findBuildPlacementNear,
    getTrainOptions,
    getResearchOptions,
    // Phase 1C — AI intention pushers. Mirror `pushUnitAttackIntention` /
    // `pushUnitMoveIntention` shape: write to `state.pendingCommands`;
    // dispatcher submits between ticks; handler applies at start of next
    // tick's processCommands.
    pushQueueTrainIntention: (buildingId: number, unitType: TrainableUnitType) => {
      state.pendingCommands.push({
        type: 'queue.train',
        data: { buildingId, unitType },
      });
    },
    pushQueueResearchIntention: (
      buildingId: number,
      technologyType: ResearchableTechnologyType,
    ) => {
      state.pendingCommands.push({
        type: 'queue.research',
        data: { buildingId, technologyType },
      });
    },
    pushBuildingPlaceConfirmIntention: (
      builderId: number,
      buildingType: BuildableBuildingType,
      anchor: Position,
    ) => {
      state.pendingCommands.push({
        type: 'building.placeConfirm',
        data: { builderId, buildingType, position: anchor },
      });
    },
    // Pass the queue by reference. aiSystem captures this once at register
    // time and reads it every tick to fold pending intentions into its
    // gates. The dispatcher must mutate `state.pendingCommands` IN PLACE
    // (push + length=0 to drain) — never reassign `state.pendingCommands = []`,
    // or aiSystem's captured reference goes stale and the gates silently
    // break.
    pendingCommands: state.pendingCommands,
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
    hasPendingUnitCommand: (unitId: number) => hasPendingUnitCommand(state.pendingCommands, unitId),
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
    accessor,
    setUnitMoveCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    setSheepMoveCommandDirect,
    enqueueTrainingDirect: enqueueTraining,
    queueTrainValidatorDeps: {
      accessor,
      getTrainOptions,
    },
    enqueueResearchDirect: enqueueResearch,
    queueResearchValidatorDeps: {
      accessor,
      getResearchOptions,
      inFlightTechSetFor,
    },
    executeMarketActionDirect,
    marketActionValidatorDeps: {
      accessor,
      getMarketOptions,
      playerOwnsCompletedMarket,
      marketFeeRate: MARKET_FEE_RATE,
      marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    },
    startConstructionDirect: startConstruction,
    buildingPlaceConfirmValidatorDeps: {
      accessor,
      getBuildOptions,
      isPlacementBlocked,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
    },
    buildingSetRallyPointValidatorDeps: {
      accessor,
      mapWidth: MAP_WIDTH,
      mapHeight: MAP_HEIGHT,
    },
    ungarrisonBuildingDirect: ungarrisonBuilding,
    buildingActionValidatorDeps: { accessor },
    beginTrebuchetPackDirect: trebuchetStateOps.beginTrebuchetPack,
    trebuchetPackValidatorDeps: { accessor },
    beginTrebuchetUnpackDirect: trebuchetStateOps.beginTrebuchetUnpack,
    trebuchetUnpackValidatorDeps: { accessor },
  });

  // Phase 2C/2D — bridge-state migration. Accessor and visibility cell
  // were constructed at the TOP of wireBridgeOps (so ops modules consuming
  // migrated slots like `villagerOrdinals` could receive them as deps).
  // Now register the output tail + run bootstrapFlush to populate the
  // Tier-3 slots before tick 1.
  registerOutputTail({ world, accessor, visibilityCell, matchState });
  bootstrapFlush({
    world,
    accessor,
    visibilityCell,
    matchState,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
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
