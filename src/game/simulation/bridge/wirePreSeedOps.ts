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
import {
  createBuilderReachability,
  withBuilderReachability,
  type BuilderReachabilityStats,
} from './builderReachability';
import { createDebugSnapshotOps } from './debugSnapshotOps';
import type { PlacementSearchStats } from './placementSearch';
import { createTransformOps } from './transformOps';
import { createMovementPlanOps } from './movementPlanOps';
import { createDropOffWalkFields, type DropOffWalkFieldStats } from './dropOffWalkField';
import { collectDropOffBuildings, preferSafeDropOffs } from './dropOffBuildings';
import { createEnemyDefenceLookup } from './enemyDefenceRange';
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
    noteMemoryChanged,
    getFogMemoryEntities,
    getHumanFogMemorySize,
  } = createFogMemoryOps({
    accessor,
    humanPlayerId: HUMAN_PLAYER_ID,
    visibility,
  });

  // The walk field is wired below, after cell passability exists; the
  // snapshot reads its statistics through this cell.
  let walkFieldStats: DropOffWalkFieldStats | null = null;
  let builderReachStats: BuilderReachabilityStats | null = null;
  // The AI site search is wired after the scenario is seeded (wirePostSeedOps),
  // so it hands its counters back through this setter.
  let aiSitePlacementStats: PlacementSearchStats | null = null;
  const setAiSitePlacementStats = (stats: PlacementSearchStats): void => {
    aiSitePlacementStats = stats;
  };
  const { getDebugSnapshot } = createDebugSnapshotOps({
    world,
    accessor,
    walkFieldStats: () => walkFieldStats,
    builderReachStats: () => builderReachStats,
    aiSitePlacementStats: () => aiSitePlacementStats,
  });

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

  // agent-affordances A1: shared reason engine (validator messages +
  // buildingOptionsOps). The `Summary` half is the same answer sized for a
  // command tooltip — see commandAvailability.ts.
  const { researchUnavailableReason, researchUnavailableSummary } = createResearchAvailability({
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

  const placementOccupancy = createCellPassability({
    world,
    humanPlayerId: HUMAN_PLAYER_ID,
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    worldOccupancy,
    tiles,
    accessor,
  });
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
    isGarrisonedUnit,
    getActionOptions,
  } = placementOccupancy;

  // The gather comparator's walk metric (dropOffWalkField.ts; register entry
  // 2026-09-01) rides on the movement-plan ops object, which every system dep
  // bag already spreads. Its drop-offs are exactly the ones the nearest-
  // drop-off lookup would return: complete, and the safe ones first.
  const enemyStaticDefences = createEnemyDefenceLookup(accessor);
  const dropOffWalkFields = createDropOffWalkFields({
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    isCellPassableForUnit,
    structuralRevision: () => worldOccupancy.structuralRevision(),
    listDropOffBuildings: (activeWorld, owner, kind) => preferSafeDropOffs(
      collectDropOffBuildings(activeWorld, accessor, owner, kind),
      enemyStaticDefences(activeWorld, owner),
    ),
  });
  const { fieldFor: findDropOffWalkField } = dropOffWalkFields;
  walkFieldStats = dropOffWalkFields.stats;
  const movementPlanOps = {
    ...createMovementPlanOps({
      world,
      mapWidth: world.grid.width,
      mapHeight: world.grid.height,
      movePathCache,
      isCellPassableForUnit,
      isCellPassableForWildlife,
      structuralRevision: () => worldOccupancy.structuralRevision(),
      // What is in the way, in the placement validator's own words, so the
      // "cannot reach that cell" toast names it (moveDestinationSearch.ts).
      describeBlockedCell: (x, y) => placementOccupancy.describePlacementBlockers(x, y, 1, 1)?.cause ?? null,
    }),
    findDropOffWalkField,
  };
  const {
    uniquePositions,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
  } = movementPlanOps;

  // Reachability (builderReachability.ts; register entry 2026-09-06): a
  // placement the game accepts has to be one a builder can walk to, and so does
  // every anchor it suggests. Folded into the three placement answers here so
  // the preview, the validator, the authoritative re-check and the suggestion
  // cannot disagree — the pairing `isPlacementBlocked` already keeps for shore
  // placement. The ring comes from the movement ops, so "beside the footprint"
  // has one definition.
  const builderReachability = createBuilderReachability({
    mapWidth: world.grid.width,
    mapHeight: world.grid.height,
    isCellPassableForUnit,
    structuralRevision: () => worldOccupancy.structuralRevision(),
    getApproachCellsForFootprint,
  });
  const {
    isPlacementBlocked,
    describePlacementBlockers,
    findOpenPlacementAnchors,
  } = withBuilderReachability(placementOccupancy, builderReachability, world);
  builderReachStats = builderReachability.stats;

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
    noteMemoryChanged,
    getFogMemoryEntities,
    getHumanFogMemorySize,
    getDebugSnapshot,
    setAiSitePlacementStats,
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
    researchUnavailableReason, researchUnavailableSummary,
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
