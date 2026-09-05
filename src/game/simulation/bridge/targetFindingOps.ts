// Phase 3 target-finding helpers. Pure geometry + filter queries the
// combat, AI, and villager systems call to pick a target from the
// current world state. Factored out of `createSimulationBridge.ts` so
// the priority tables + visible-target / nearest-drop-off helpers live
// next to each other. Same flat dep-bag factory as the other `bridge/`
// extractions.
//
// All helpers take whatever varies per call (viewer owner, origin,
// range, activeWorld) as arguments so the factory deps stay small —
// world + visibility + the three side maps this module reads.

import type { Position } from 'civ-engine';
import { targetPriority } from './targetPriority';
import { isEnemyOwner } from '../alliances';
import { playerTeamsCodec } from './bridgeStateSerialize';

import type {
  BuildingComponent,
  BuildingType,
  EconomyResourceKind,
  UnitComponent,
  UnitType,
} from '../types';
import type {
  GameWorld,
} from './pureHelpers';
import { manhattanDistanceToFootprint } from './footprintDistance';
import { collectDropOffBuildings } from './dropOffBuildings';
import { createEnemyDefenceLookup, isFootprintInsideDefenceReach } from './enemyDefenceRange';
import {
  distanceFromBuildingFootprint,
  isFootprintVisible,
  manhattanDistance,
} from './pureHelpers';
import { getBuildingFootprint } from '../../content/buildingFootprints';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  combatStatesCodec,
} from './bridgeStateSerialize';

interface VisibilityQuery {
  isVisible: (playerId: number, x: number, y: number) => boolean;
}

export interface TargetFindingDeps {
  world: GameWorld;
  visibility: VisibilityQuery;
  // Phase 2D: combatStates + constructionStates migrated to world.state.aoe2.*
  // via accessor; the BridgeState dep is no longer needed here.
  accessor: BridgeStateAccessor;
}

export interface TargetFindingOps {
  // Per-unitType targeting priority. Lower numbers are picked first
  // (ties break by Manhattan distance downstream).
  targetPriority(unitType: UnitType): number;
  // Per-buildingType targeting priority. Same lower-first convention.
  buildingTargetPriority(buildingType: BuildingType): number;
  // Scan every enemy unit visible to `viewerOwner`, pick the one with
  // the best priority/distance.
  findPreferredVisibleEnemyUnit(viewerOwner: number, origin: Position): number | null;
  // Footprint-aware variant. Measures distance from the nearest
  // footprint cell so a 4x4 Castle's stated range lands evenly all
  // the way around the footprint (not just from the anchor corner).
  findPreferredVisibleEnemyUnitInRangeOfBuilding(
    viewerOwner: number,
    buildingAnchor: Position,
    footprint: { width: number; height: number },
    range: number,
  ): number | null;
  // Scan every enemy building visible to `viewerOwner`, pick the one
  // with the best priority/distance.
  findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null;
  // Nearest owned, complete building that accepts drop-off of
  // `resourceKind`. `activeWorld` parameter lets system-loop callers
  // thread the world reference they already hold.
  findNearestDropOffBuilding(
    activeWorld: GameWorld,
    owner: number,
    resourceKind: EconomyResourceKind,
    origin: Position,
  ): number | null;
  // Scan for the nearest hostile unit within `aggroRange` of `origin`.
  // Used by wildlife aggro + similar auto-target behaviors.
  findNearestHostileWildlifeTarget(
    origin: Position,
    aggroRange: number,
    activeWorld?: GameWorld,
  ): number | null;
  // Personal-LOS variant of `findPreferredVisibleEnemyUnit`. Auto-
  // aggression (canonical AoE2 Aggressive Stance) uses the unit's own
  // sight radius — not the player-level fog state — so a Knight
  // standing next to an enemy spearman engages even if no allied
  // structure illuminates that tile. Returns the highest-priority
  // enemy unit within `radius` Manhattan distance from `origin`.
  findPreferredEnemyUnitInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null;
  // Personal-LOS variant of `findPreferredVisibleEnemyBuilding`. Same
  // contract as `findPreferredEnemyUnitInRadius` for buildings.
  // Foundations under construction ARE valid targets (canonical AoE2:
  // damageable while building); the per-tick HP ramp lives in
  // playerCommandsSystem and the foundation's currentHp survives
  // damage taken during construction.
  findPreferredEnemyBuildingInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null;
}

export function createTargetFindingOps(deps: TargetFindingDeps): TargetFindingOps {
  // Every "is this an enemy" test in this module goes through the owner's TEAM
  // rather than its id, so an ally is never shot at, never auto-engaged and
  // never picked as an AI target. Read fresh per call: teams are scenario
  // state, and a stale copy would have a unit firing on a new ally.
  const teams = (): ReadonlyMap<number, number> => deps.accessor.get(playerTeamsCodec);
  const { world, visibility, accessor } = deps;
  // A carrier keeps out of the enemy's arrows on the way home as well (§6.4):
  // the nearest drop-off is the nearest SAFE one, and the nearest of all only
  // when no drop-off for the resource stands outside their reach.
  const enemyStaticDefences = createEnemyDefenceLookup(accessor);

  // Per-buildingType targeting priority for AI / unit-vs-building target
  // selection. Lower numbers are picked first (after the priority sort,
  // ties break by Manhattan distance). Castles and Town Centers are
  // intentionally pushed to the bottom: they have huge HP pools and are
  // poor first-strikes (per a prior review finding). Watch Towers are still
  // worth attacking quickly. Everything else stays in the middle so the
  // sort is stable for buildings without an explicit reason to defer.
  function buildingTargetPriority(buildingType: BuildingType): number {
    switch (buildingType) {
      case 'watch-tower':
      case 'bombard-tower':
        return 2;
      case 'wonder':
        // Slice 8: a Wonder with an active countdown is the single most
        // important target on the map — if it stands, its owner wins. Rank
        // it first so AI / auto-target picks swarm the Wonder.
        return 1;
      case 'town-center':
        return 9;
      case 'castle':
        return 10;
      case 'stone-wall':
      case 'palisade-wall':
        // FU3: walls sit behind every production / tech building. They're
        // attacked only when no better target is visible (ram punch-through
        // behavior). Units still attack a wall if it blocks their path to
        // a real objective — the pathing fallback handles that.
        return 11;
      default:
        return 5;
    }
  }

  function findPreferredVisibleEnemyUnit(viewerOwner: number, origin: Position): number | null {
    const candidates = [...world.query('position', 'unit')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } =>
          entry.position !== undefined
          && entry.unit !== undefined
          && isEnemyOwner(teams(), viewerOwner, entry.unit.owner)
          && visibility.isVisible(viewerOwner, entry.position.x, entry.position.y),
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

    return candidates[0]?.id ?? null;
  }

  // FU3: range check for large buildings that measures distance from the
  // NEAREST footprint cell to the target (not from the anchor cell). The
  // anchor of a 4x4 Castle is its top-left corner, so a target at range 8
  // off the south-east corner used to be reported as distance 8 + 3 = 11
  // — three cells outside the stated range. This helper fixes that by
  // folding the footprint into the distance math so the Castle's stated
  // range lands evenly all the way around the footprint.
  function findPreferredVisibleEnemyUnitInRangeOfBuilding(
    viewerOwner: number,
    buildingAnchor: Position,
    footprint: { width: number; height: number },
    range: number,
    // Cells from the footprint the building CANNOT reach: a Tower or Castle
    // shoots down from arrow slits, so an attacker pressed against the wall is
    // underneath them. 0 for everything else, and 0 once the owner researches
    // Murder Holes. See buildingMinimumRange.ts.
    minimumRange = 0,
  ): number | null {
    // The queryInRadius hook uses Manhattan distance from the anchor
    // cell; expand the query radius by the building's max span so targets
    // at the far edge of the footprint are still included in the initial
    // candidate list. We then re-filter by footprint distance before
    // returning.
    const anchorQueryRadius = range + Math.max(footprint.width, footprint.height) - 1;
    const candidates = [...world.queryInRadius(
      buildingAnchor.x,
      buildingAnchor.y,
      anchorQueryRadius,
      'position',
      'unit',
    )]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        unit: world.getComponent<UnitComponent>(id, 'unit'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; unit: UnitComponent } => {
          if (
            entry.position === undefined
            || entry.unit === undefined
            || !isEnemyOwner(teams(), viewerOwner, entry.unit.owner)
          ) {
            return false;
          }
          if (!visibility.isVisible(viewerOwner, entry.position.x, entry.position.y)) {
            return false;
          }
          const distance = distanceFromBuildingFootprint(
            buildingAnchor, footprint, entry.position,
          );
          return distance <= range && distance > minimumRange;
        },
      )
      .sort((left, right) => {
        const priorityDelta = targetPriority(left.unit.unitType) - targetPriority(right.unit.unitType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return (
          distanceFromBuildingFootprint(buildingAnchor, footprint, left.position)
          - distanceFromBuildingFootprint(buildingAnchor, footprint, right.position)
        );
      });

    return candidates[0]?.id ?? null;
  }

  function findPreferredVisibleEnemyBuilding(viewerOwner: number, origin: Position): number | null {
    // Iter-2 M2-1: visibility check goes through the building footprint,
    // not just the anchor cell, so partially-visible large buildings
    // (Castles, Town Centers, Wonders) are targetable as soon as ANY
    // cell of the footprint is in fog. Mirrors the contract createProjector
    // already uses to decide whether to render the building.
    const candidates = [...world.query('position', 'building')]
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'position'),
        building: world.getComponent<BuildingComponent>(id, 'building'),
      }))
      .filter(
        (
          entry,
        ): entry is { id: number; position: Position; building: BuildingComponent } => {
          if (
            entry.position === undefined
            || entry.building === undefined
            || !isEnemyOwner(teams(), viewerOwner, entry.building.owner)
          ) {
            return false;
          }
          const footprint = getBuildingFootprint(entry.building.buildingType);
          return isFootprintVisible(
            visibility,
            viewerOwner,
            entry.position.x,
            entry.position.y,
            footprint.width,
            footprint.height,
          );
        },
      )
      .sort((left, right) => {
        const priorityDelta =
          buildingTargetPriority(left.building.buildingType)
          - buildingTargetPriority(right.building.buildingType);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        return manhattanDistance(origin, left.position) - manhattanDistance(origin, right.position);
      });

    return candidates[0]?.id ?? null;
  }

  function findNearestDropOffBuilding(
    activeWorld: GameWorld,
    owner: number,
    resourceKind: EconomyResourceKind,
    origin: Position,
    excludeIds?: ReadonlySet<number>,
  ): number | null {
    let nearestBuildingId: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    let nearestSafeBuildingId: number | null = null;
    let nearestSafeDistance = Number.POSITIVE_INFINITY;
    const defences = enemyStaticDefences(activeWorld, owner);

    // The same enumeration the drop-off walk field reads, so the two cannot
    // disagree about which buildings count (dropOffBuildings.ts).
    for (const { id, position, footprint } of collectDropOffBuildings(activeWorld, accessor, owner, resourceKind)) {
      // `excludeIds` lets the drop-off reroute skip ones already found unreachable.
      if (excludeIds?.has(id)) continue;

      // To the building's nearest OCCUPIED cell, not its origin corner. A 4x4
      // Town Centre's origin is up to three tiles from the cell a carrier
      // actually walks to, and wrong by a different amount from each side —
      // which let two adjacent cells disagree about which drop-off was
      // nearest. Measured on `seed-7`: a carrier holding ten wood paced
      // between (49,21) and (50,21) forever, traffic granting `proceed` every
      // tick, because measured to origins the Town Centre went from tied to
      // strictly worse across that one step.
      const distance = manhattanDistanceToFootprint(origin, position, footprint);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestBuildingId = id;
      }
      if (
        distance < nearestSafeDistance
        && !isFootprintInsideDefenceReach(position, footprint, defences)
      ) {
        nearestSafeDistance = distance;
        nearestSafeBuildingId = id;
      }
    }

    return nearestSafeBuildingId ?? nearestBuildingId;
  }

  function findNearestHostileWildlifeTarget(
    origin: Position,
    aggroRange: number,
    activeWorld: GameWorld = world,
  ): number | null {
    let bestUnitId: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const unitId of activeWorld.queryInRadius(
      origin.x,
      origin.y,
      aggroRange,
      'unit',
    )) {
      const unit = activeWorld.getComponent<UnitComponent>(unitId, 'unit');
      const position = activeWorld.getComponent<Position>(unitId, 'position');
      const combat = accessor.get(combatStatesCodec).get(unitId);
      if (!unit || !position || !combat || combat.currentHp <= 0) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance > aggroRange) {
        continue;
      }

      if (distance < bestDistance || (distance === bestDistance && unitId < (bestUnitId ?? Number.POSITIVE_INFINITY))) {
        bestDistance = distance;
        bestUnitId = unitId;
      }
    }

    return bestUnitId;
  }

  function findPreferredEnemyUnitInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null {
    let bestId: number | null = null;
    let bestPriority = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const id of world.queryInRadius(origin.x, origin.y, radius, 'position', 'unit')) {
      const position = world.getComponent<Position>(id, 'position');
      const unit = world.getComponent<UnitComponent>(id, 'unit');
      if (!position || !unit || !isEnemyOwner(teams(), viewerOwner, unit.owner)) {
        continue;
      }

      const combat = accessor.get(combatStatesCodec).get(id);
      if (combat && combat.currentHp <= 0) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance > radius) {
        continue;
      }

      const priority = targetPriority(unit.unitType);
      if (
        priority < bestPriority
        || (priority === bestPriority && distance < bestDistance)
      ) {
        bestPriority = priority;
        bestDistance = distance;
        bestId = id;
      }
    }

    return bestId;
  }

  function findPreferredEnemyBuildingInRadius(
    viewerOwner: number,
    origin: Position,
    radius: number,
  ): number | null {
    let bestId: number | null = null;
    let bestPriority = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const id of world.queryInRadius(origin.x, origin.y, radius, 'position', 'building')) {
      const position = world.getComponent<Position>(id, 'position');
      const building = world.getComponent<BuildingComponent>(id, 'building');
      if (!position || !building || !isEnemyOwner(teams(), viewerOwner, building.owner)) {
        continue;
      }

      const distance = manhattanDistance(origin, position);
      if (distance > radius) {
        continue;
      }

      const priority = buildingTargetPriority(building.buildingType);
      if (
        priority < bestPriority
        || (priority === bestPriority && distance < bestDistance)
      ) {
        bestPriority = priority;
        bestDistance = distance;
        bestId = id;
      }
    }

    return bestId;
  }

  return {
    targetPriority,
    buildingTargetPriority,
    findPreferredVisibleEnemyUnit,
    findPreferredVisibleEnemyUnitInRangeOfBuilding,
    findPreferredVisibleEnemyBuilding,
    findNearestDropOffBuilding,
    findNearestHostileWildlifeTarget,
    findPreferredEnemyUnitInRadius,
    findPreferredEnemyBuildingInRadius,
  };
}
