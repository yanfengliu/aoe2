import type { BuildingComponent } from '../types';
// Pre-seed factory wireup. Runs before the scenario has been seeded /
// hydrated; constructs the read/query/geometry ops (trebuchet state, fog
// memory, debug snapshot, match-end, transform, player queries, options
// rules, research availability, combat state, entity create, cell
// passability, movement plan, spawn finders, gatherer order). Keeps
// wireBridgeOps thin by isolating the first-half wiring.

import { bonusAttackRange } from '../teamCombatBonuses';
import { matchSettingsCodec, playerCivilizationsCodec, playerTeamsCodec } from './bridgeStateSerialize';
import { buildingFootprint } from './pureHelpers';
import { createTrebuchetStateOps } from './trebuchetState';
import { createFogMemoryOps } from './fogMemoryOps';
import { createMatchEndOps } from './matchEndOps';
import { createCombatStateFactory } from './combatStateFactory';
import { createEntityCreateOps } from './entityCreateOps';
import { createCellPassability } from './cellPassability';
import { createDebugSnapshotOps } from './debugSnapshotOps';
import { createTransformOps } from './transformOps';
import { createMovementPlanOps } from './movementPlanOps';
import { createOptionsRules } from './optionsRules';
import { createPlayerQueries } from './playerQueries';
import { createSpawnFinders, createGathererOrderOps } from './bridgeHelpers';
import { createResearchAvailability } from './researchAvailability';
import { civDenies } from '../civTechTree';
import { VisibilityCell } from './visibilityCell';
import { HUMAN_PLAYER_ID } from '../prototypeScenario';
import { WONDER_COUNTDOWN_TICKS } from './bridgeConstants';
import type { WireBridgeOpsDeps } from './wireBridgeOpsTypes';

export type WirePreSeedOpsDeps = Pick<
  WireBridgeOpsDeps,
  | 'world'
  | 'state'
  | 'accessor'
  | 'visibility'
  | 'matchState'
  | 'worldOccupancy'
  | 'tiles'
  | 'isBootstrappingScenarioRef'
  | 'ensurePlayerScoreCounters'
  | 'getEntityRef'
>;

export function wirePreSeedOps(deps: WirePreSeedOpsDeps) {
  const {
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
  } = deps;
  const { movePathCache } = state;

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

  const { getDebugSnapshot } = createDebugSnapshotOps({ world, accessor });

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
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    worldOccupancy,
    tiles,
    accessor,
    unitAttackFeed: state.unitAttackFeed,
    isBootstrappingScenario: () => isBootstrappingScenarioRef.current,
  });
  const {
    placeFreshSpawnUnit,
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
    countCompletedAgePrerequisites,
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
    rawCivilizationOf: (owner) => accessor.get(playerCivilizationsCodec).get(owner),
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    hasCompletedBuilding,
    hasOwnedWonder,
    // Nomad (§5.4): the owner may place their FIRST Town Center in any age —
    // only while they own none at all, standing or under construction.
    nomadFirstTownCenter: (owner: number) => {
      if (!accessor.get(matchSettingsCodec).nomadStart) return false;
      for (const id of world.query('building')) {
        const building = world.getComponent<BuildingComponent>(id, 'building');
        if (building && building.owner === owner && building.buildingType === 'town-center') {
          return false;
        }
      }
      return true;
    },
  });

  // agent-affordances A1: shared reason engine (validator messages + buildingOptionsOps).
  const { researchUnavailableReason } = createResearchAvailability({
    getPlayerAge,
    hasTechnology,
    countCompletedAgePrerequisites,
    getResearchOptions,
    civilizationDenying: (owner, tech) => {
      const civ = accessor.get(playerCivilizationsCodec).get(owner);
      return civ !== undefined && civDenies(civ, tech) ? civ : undefined;
    },
  });

  const createCombatState = createCombatStateFactory({
    hasTechnology,
    getCivilization: getPlayerCivilization,
    getAge: getPlayerAge,
    teamAttackRangeBonus: (owner, unitType) => bonusAttackRange(
      accessor.get(playerTeamsCodec),
      accessor.get(playerCivilizationsCodec),
      owner,
      unitType,
    ),
  });

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
    isTerrainPassableForUnitId,
    isCellBlockedByBuilding,
    isCellBlockedByResource,
    isCellPassableForSpawn,
    isCellPassableForSpawnInDomain,
    isCellPassableForUnit,
    isCellPassableForWildlife,
    isHarvestableResource,
    isPlacementBlocked,
    describePlacementBlockers,
    findOpenPlacementAnchors,
    isGarrisonedUnit,
    getActionOptions,
  } = createCellPassability({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    worldOccupancy,
    tiles,
    accessor,
  });

  const movementPlanOps = createMovementPlanOps({
    world,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
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
    isCellPassableForSpawnInDomain,
    buildingFootprint,
  });
  const { clearGathererOrder } = createGathererOrderOps({ world, state, accessor });

  return {
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
  };
}
