import { currentEntityId } from './pureHelpers';
import { defaultStanceFor } from '../unitStance';
import { DEFAULT_FORMATION } from '../unitFormation';
import {
  unitFormationsCodec,
  unitStancesCodec,
} from './bridgeStateSerialize';
import type { UnitTaskState } from '../types';
import { bootScenarioOrLoad } from './bootScenarioOrLoad';
import { createControlGroupOps } from './controlGroupOps';
import { registerBridgeSystems } from './registerBridgeSystems';
import { registerCommandHandlers } from './registerCommandHandlers';
import { buildCommandValidatorDeps } from './commandValidatorDeps';
import { registerOutputTail } from './registerOutputTail';
import { bootstrapFlush } from './bootstrapFlush';
import { wirePreSeedOps } from './wirePreSeedOps';
import { wirePostSeedOps } from './wirePostSeedOps';
import { createAiIntentionPushers } from './aiIntentionPushers';
import { setReplayWorldContext } from '../replay/replayWorldContext';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import { createTributeOps } from './tributeOps';
import {
  MARKET_FEE_RATE,
  MARKET_TRANSACTION_AMOUNT,
} from './bridgeConstants';
import { TIER_3_SLOTS } from './bridgeStateSerialize';

export type { WireBridgeOpsDeps, WireBridgeOpsResult } from './wireBridgeOpsTypes';
import type { WireBridgeOpsDeps, WireBridgeOpsResult } from './wireBridgeOpsTypes';

export function wireBridgeOps(deps: WireBridgeOpsDeps): WireBridgeOpsResult {
  const {
    world,
    systemMode = 'live',
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
  const {
    visibilityCell,
    visibilityFingerprints,
    trebuchetStateOps,
    getOrCreateMemoryMap,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getDebugSnapshot,
    matchEndOps,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    transformOps,
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    rebuildWorldOccupancyFromWorld,
    playerQueries,
    getPlayerAge,
    getTrainOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    getMarketOptions,
    getBuildOptions,
    researchUnavailableReason,
    createCombatState,
    entityCreateOps,
    addUnitEntity,
    addBuildingEntity,
    addResourceEntity,
    buildingOccupiesCell,
    isTerrainPassableForUnit,
    isTerrainPassableForUnitId,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isPlacementBlocked,
    describePlacementBlockers,
    findOpenPlacementAnchors,
    isGarrisonedUnit,
    getActionOptions,
    movementPlanOps,
    getApproachCellsForFootprint,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    clearGathererOrder,
  } = wirePreSeedOps({
    world,
    state,
    accessor,
    visibility,
    matchState,
    worldOccupancy,
    tiles,
    isBootstrappingScenarioRef,
    ensurePlayerScoreCounters,
    getEntityRef,
  });

  bootScenarioOrLoad({
    world, scenario, savedGame, matchState, state, accessor, tiles,
    difficulty: deps.difficulty,
    victory: deps.victory,
    resourcePreset: deps.resourcePreset,
    populationCap: deps.populationCap,
    ensureAiState,
    inFlightTechSetFor,
    addBuildingEntity,
    addUnitEntity,
    addResourceEntity,
    findScenarioSpawnPosition,
    buildingOccupiesCell,
    isTerrainPassableForUnitId,
    isCellBlockedByBuilding,
  });

  isBootstrappingScenarioRef.current = false;
  rebuildWorldOccupancyFromWorld();

  const getUnitTaskState = (id: number): UnitTaskState =>
    getUnitTaskStateInternal(id, isGarrisonedUnit);

  function isMatchRunning(): boolean {
    return matchState.outcome === 'running';
  }

  const postSeed = wirePostSeedOps({
    world,
    tiles,
    worldOccupancy,
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
    placeFreshSpawnUnit,
    clearPositionAndSyncOccupancy,
    addBuildingEntity,
    addResourceEntity,
    findScenarioSpawnPosition,
    findBuildingSpawnPosition,
    clearGathererOrder,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    getVisibleResearchOptions,
    researchUnavailableReason,
    findOpenPlacementAnchors,
  });
  const {
    agentOptionsOps,
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
    garrisonUnit,
    ungarrisonBuilding,
    startConstructionWithBuildersDirect,
    findBuildPlacementNear,
  } = trainingMarketOps;
  const { getEntityHealth, getWildlifeAlive, getUnitActiveVerb, getSelectionState } = selectionStateOps;
  // Tribute (spec §6.8): needs the Market query from trainingMarketOps and the
  // match gate, so it wires here rather than in registerBridgeSystems.
  const tributeOps = createTributeOps({
    world,
    accessor,
    humanPlayerId: HUMAN_PLAYER_ID,
    isMatchRunning,
    playerOwnsCompletedMarket,
    enqueueRejection,
  });
  const { applyTechnology } = technologyOps;
  const {
    issueUnitMoveCommand,
    setUnitMoveCommandDirect,
    setUnitAttackMoveCommandDirect,
    setUnitPatrolCommandDirect,
    issueUnitAttackMoveCommand,
    issueUnitPatrolCommand,
    resumePatrolLeg,
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
    getSelectedHumanBuilderIds,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    selectEntityAtCell,
    selectEntityById,
    clearSelection,
  } = unitCommandOps;

  const { assignControlGroup, recallControlGroup } = createControlGroupOps({
    accessor,
    getSelectedEntityRefs,
    selectByRefs,
  });

  const finalize = registerBridgeSystems({
    selectUnitsByIds,
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
    getBuildOptions,
    garrisonUnit,
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
    gameLength: scenario?.gameLength,
    findBuildPlacementNear,
    allocateGroupMoveTargets: worldOccupancy.allocateGroupMoveTargets.bind(worldOccupancy),
    getTrainOptions,
    getResearchOptions,
    // Phase 1B/1C — AI intention pushers + the pending-command queue by
    // reference. Spread in from aiIntentionPushers (order-independent —
    // registerBridgeSystems destructures its deps by name).
    ...createAiIntentionPushers({ state }),
    issueUnitAttackCommand,
    issueUnitMoveCommand,
    issueUnitAttackMoveCommand,
    issueUnitPatrolCommand,
    resumePatrolLeg,
    setUnitMoveCommandDirect,
    distanceToBuilding,
    findBuildingSpawnPosition,
    applyTechnology,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    // The shore test for fish: a cell a land unit can stand on.
    isLandCell: (x: number, y: number) => isTerrainPassableForUnit(x, y),
    isGarrisonedUnit,
    isPlacementBlocked,
    getOrCreateMemoryMap,
    getSelectedEntityId,
    getSelectedEntityIds,
    getSelectedOwnedSheepIds,
    getSelectedHumanUnitIds,
    getSelectedHumanBuilderIds,
    isEntityVisibleToHuman,
    issueUnitContextCommand,
    issueUnitContextCommandAtEntity,
    issueSheepMoveCommand,
  });

  // Phase 1A scaffold + Phase 1B per-command registrations (DESIGN v17 §6.4).
  // Each Phase 1B commit threads its direct-mutation helper into deps so the
  // handler delegates to the same code path deterministic systems use.
  const { validatorDeps } = buildCommandValidatorDeps({
    accessor,
    researchUnavailableReason,
    getTrainOptions,
    getResearchOptions,
    getMarketOptions,
    getBuildOptions,
    inFlightTechSetFor,
    playerOwnsCompletedMarket,
    isPlacementBlocked,
    describePlacementBlockers,
    findOpenPlacementAnchors,
    isCellVisibleToOwner: (owner, x, y) => visibility.isVisible(owner, x, y),
    marketFeeRate: MARKET_FEE_RATE,
    marketTransactionAmount: MARKET_TRANSACTION_AMOUNT,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
  });
  registerCommandHandlers(world, {
    accessor,
    humanPlayerId: HUMAN_PLAYER_ID,
    // M6 control: a unit's stance is stored only when it DIFFERS from its
    // type's default, so an untouched match writes nothing to the slot.
    setUnitStance: (unitId, stance) => {
      const unit = world.getComponent<import('../types').UnitComponent>(unitId, 'unit');
      const isDefault = unit ? stance === defaultStanceFor(unit.unitType) : false;
      accessor.mutate(unitStancesCodec, (stances) => {
        if (isDefault) stances.delete(unitId);
        else stances.set(unitId, stance);
      });
    },
    // Same only-if-non-default storage: an untouched match writes nothing.
    setUnitFormation: (unitId, formation) => {
      accessor.mutate(unitFormationsCodec, (formations) => {
        if (formation === DEFAULT_FORMATION) formations.delete(unitId);
        else formations.set(unitId, formation);
      });
    },
    setUnitMoveCommandDirect,
    setUnitAttackMoveCommandDirect,
    setUnitPatrolCommandDirect,
    setUnitAttackCommandDirect,
    setUnitGatherCommandDirect,
    routeUnitContextCommandDirect,
    routeUnitContextAtEntityCommandDirect,
    routeMonkContextAtEntityCommandDirect,
    setSheepMoveCommandDirect,
    enqueueTrainingDirect: enqueueTraining,
    enqueueResearchDirect: enqueueResearch,
    executeMarketActionDirect,
    executeTributeDirect: tributeOps.executeTributeDirect,
    startConstructionWithBuildersDirect,
    ungarrisonBuildingDirect: ungarrisonBuilding,
    beginTrebuchetPackDirect: trebuchetStateOps.beginTrebuchetPack,
    beginTrebuchetUnpackDirect: trebuchetStateOps.beginTrebuchetUnpack,
    ...validatorDeps,
  });

  // Phase 2C/2D — bridge-state migration. Accessor and visibility cell
  // were constructed at the TOP of wireBridgeOps (so ops modules consuming
  // migrated slots like `villagerOrdinals` could receive them as deps).
  // Now register the output tail + run bootstrapFlush to populate the
  // Tier-3 slots before tick 1.
  const syncReplayUnitAttacks = systemMode !== 'replay'
    || world.getState(TIER_3_SLOTS.replayUnitAttacks) !== undefined;
  registerOutputTail({
    world,
    accessor,
    visibilityCell,
    matchState,
    pendingCommands: state.pendingCommands,
    unitAttackFeed: state.unitAttackFeed,
    syncReplayUnitAttacks,
  });
  bootstrapFlush({
    world,
    accessor,
    visibilityCell,
    matchState,
    pendingCommands: state.pendingCommands,
    unitAttackFeed: state.unitAttackFeed,
    syncReplayUnitAttacks,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
  });

  if (systemMode === 'replay') {
    setReplayWorldContext(world, { accessor, visibility, visibilityCell, matchState, pendingCommands: state.pendingCommands, seed: getSeed() });
  }

  const selectionMutation = <Result>(mutate: () => Result): Result => {
    const result = mutate();
    // Selection lives outside ECS component storage, but projected entities
    // carry `selected`. Invalidate even on an empty/clearing selection so a
    // paused renderer cannot retain a stale ring or selected health cue.
    markOutOfBandRenderChange();
    return result;
  };

  return {
    ...finalize,
    assignControlGroup,
    recallControlGroup,
    ...agentOptionsOps,
    sendTribute: tributeOps.sendTribute,
    listTributeTargets: tributeOps.listTributeTargets,
    humanTributeFeeRate: tributeOps.humanTributeFeeRate,
    getPlayerAge,
    getSelectionState,
    getEntityHealth,
    getWildlifeAlive,
    getUnitActiveVerb,
    selectEntityAtCell: (x, y) => selectionMutation(() => selectEntityAtCell(x, y)),
    selectEntityById: (id) => selectionMutation(() => selectEntityById(id)),
    selectOwnedUnitsByTypeInRect: (unitType, minX, minY, maxX, maxY) => selectionMutation(
      () => selectOwnedUnitsByTypeInRect(unitType, minX, minY, maxX, maxY),
    ),
    filterSelectableUnitIds,
    selectUnitsByIds: (ids) => selectionMutation(() => selectUnitsByIds(ids)),
    selectByRefs: (refs) => selectionMutation(() => selectByRefs(refs)),
    selectUnitsInBox: (minX, minY, maxX, maxY) => selectionMutation(
      () => selectUnitsInBox(minX, minY, maxX, maxY),
    ),
    clearSelection: () => selectionMutation(clearSelection),
    getDebugSnapshot,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getHumanWonderCountdownTicks,
    getHumanRelicCountdownTicks,
    getSelectedEntityIds,
    getSelectedEntityRefs,
  };
}
