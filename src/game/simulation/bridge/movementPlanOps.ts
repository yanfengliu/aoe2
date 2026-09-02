// Movement plan ops. Walks A* over a passable-cell predicate and shapes the
// result into a `UnitMovementPlan` (destination + nextStep). The cached
// variant memoizes the full path between calls so a long move order doesn't
// re-solve every tick — invalidates when the original click target opens up
// or the next step gets blocked.

import { findGridPath, type Position } from 'civ-engine';

import { orderApproachCandidates } from './approachOrdering';
import { buildingFootprint, clonePosition, isAtTarget, type GameWorld } from './pureHelpers';
import type { BuildingComponent } from '../types';
import type { UnitMovementPlan } from './movementTypes';
import { createApproachPlanCache } from './approachPlanCache';

type CivWorld = GameWorld;

interface ResolvedMovementPath {
  destination: Position;
  path: Position[];
}

interface CachedMovePath extends ResolvedMovementPath {
  nextPathIndex: number;
}

type IsPassable = (
  entityId: number,
  x: number,
  y: number,
  worldState: CivWorld,
) => boolean;

export interface MovementPlanOpsDeps {
  world: GameWorld;
  mapWidth: number;
  mapHeight: number;
  movePathCache: Map<number, CachedMovePath>;
  isCellPassableForUnit: IsPassable;
  isCellPassableForWildlife: IsPassable;
  /** worldOccupancy.structuralRevision — see the unreachable-plan cache. */
  structuralRevision?: () => number;
}

export interface MovementPlanOps {
  uniquePositions(positions: Position[]): Position[];
  getCellsWithinRange(center: Position, range: number): Position[];
  getApproachCellsForFootprint(
    anchor: Position,
    width: number,
    height: number,
    range?: number,
  ): Position[];
  getNearestMoveCandidates(target: Position): Position[];
  findMovementPathToCandidates(
    unitId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld?: CivWorld,
    isPassable?: IsPassable,
  ): ResolvedMovementPath | null;
  findMovementPlan(
    unitId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld?: CivWorld,
    isPassable?: IsPassable,
  ): UnitMovementPlan | null;
  resolveMovePlanFromCache(
    unitId: number,
    target: Position,
    activeWorld?: CivWorld,
  ): UnitMovementPlan | null;
  findResourceApproachPlan(
    unitId: number,
    resourceId: number,
    activeWorld?: CivWorld,
  ): UnitMovementPlan | null;
  findBuildingApproachPlan(
    unitId: number,
    buildingId: number,
    range?: number,
    activeWorld?: CivWorld,
  ): UnitMovementPlan | null;
  findUnitRangePlan(
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld?: CivWorld,
  ): UnitMovementPlan | null;
  findWildlifeRangePlan(
    resourceId: number,
    targetPosition: Position,
    range: number,
    activeWorld?: CivWorld,
  ): UnitMovementPlan | null;
}

export function createMovementPlanOps(deps: MovementPlanOpsDeps): MovementPlanOps {
  const {
    world,
    mapWidth,
    mapHeight,
    movePathCache,
    isCellPassableForUnit,
    isCellPassableForWildlife,
  } = deps;

  function uniquePositions(positions: Position[]): Position[] {
    const seen = new Set<string>();
    const unique: Position[] = [];

    for (const position of positions) {
      const key = `${position.x},${position.y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      unique.push(position);
    }

    return unique;
  }

  function getCellsWithinRange(center: Position, range: number): Position[] {
    const cells: Position[] = [];

    for (let y = center.y - range; y <= center.y + range; y += 1) {
      for (let x = center.x - range; x <= center.x + range; x += 1) {
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
          continue;
        }

        const distance = Math.abs(center.x - x) + Math.abs(center.y - y);
        if (distance > range) {
          continue;
        }

        cells.push({ x, y });
      }
    }

    return cells;
  }

  function getApproachCellsForFootprint(
    anchor: Position,
    width: number,
    height: number,
    range = 1,
  ): Position[] {
    const candidates: Position[] = [];
    const minX = anchor.x - range;
    const maxX = anchor.x + width - 1 + range;
    const minY = anchor.y - range;
    const maxY = anchor.y + height - 1 + range;

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
          continue;
        }

        const dx =
          x < anchor.x ? anchor.x - x
          : x > anchor.x + width - 1 ? x - (anchor.x + width - 1)
          : 0;
        const dy =
          y < anchor.y ? anchor.y - y
          : y > anchor.y + height - 1 ? y - (anchor.y + height - 1)
          : 0;
        const distance = dx + dy;
        if (distance === 0 || distance > range) {
          continue;
        }

        candidates.push({ x, y });
      }
    }

    return uniquePositions(candidates);
  }

  function getNearestMoveCandidates(target: Position): Position[] {
    const candidates: Position[] = [];
    const maxRadius = Math.max(mapWidth, mapHeight);

    for (let radius = 0; radius <= maxRadius; radius += 1) {
      for (let y = target.y - radius; y <= target.y + radius; y += 1) {
        for (let x = target.x - radius; x <= target.x + radius; x += 1) {
          if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
            continue;
          }

          const distance = Math.abs(target.x - x) + Math.abs(target.y - y);
          if (distance !== radius) {
            continue;
          }

          candidates.push({ x, y });
        }
      }
    }

    return uniquePositions(candidates);
  }

  function findMovementPathToCandidates(
    unitId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld: CivWorld = world,
    isPassable: IsPassable = isCellPassableForUnit,
  ): ResolvedMovementPath | null {
    // Candidate ORDER is the choice (first reachable wins) and belongs to the
    // caller: approaches sort nearest-first, moves keep their slot allocation.
    const uniqueCandidates = uniquePositions(candidates).filter((candidate) =>
      isPassable(unitId, candidate.x, candidate.y, activeWorld),
    );

    if (preferCurrentCell) {
      const currentCellCandidate = uniqueCandidates.find(
        (candidate) => candidate.x === start.x && candidate.y === start.y,
      );
      if (currentCellCandidate) {
        return {
          destination: clonePosition(currentCellCandidate),
          path: [clonePosition(start)],
        };
      }
    }

    for (const destination of uniqueCandidates) {
      const pathResult = findGridPath({
        width: mapWidth,
        height: mapHeight,
        start,
        goal: destination,
        blocked: (x, y) => !isPassable(unitId, x, y, activeWorld),
      });
      if (!pathResult) {
        continue;
      }

      return {
        destination: clonePosition(destination),
        path: pathResult.path.map((step) => clonePosition(step)),
      };
    }

    return null;
  }

  function findMovementPlan(
    unitId: number,
    start: Position,
    candidates: Position[],
    preferCurrentCell: boolean,
    activeWorld: CivWorld = world,
    isPassable: IsPassable = isCellPassableForUnit,
  ): UnitMovementPlan | null {
    const movementPath = findMovementPathToCandidates(
      unitId,
      start,
      candidates,
      preferCurrentCell,
      activeWorld,
      isPassable,
    );
    if (movementPath) {
      return {
        destination: movementPath.destination,
        nextStep: movementPath.path[1] ?? movementPath.destination,
      };
    }

    return null;
  }

  function resolveMovePlanFromCache(
    unitId: number,
    target: Position,
    activeWorld: CivWorld = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (!position) {
      movePathCache.delete(unitId);
      return null;
    }

    const cachedMovePath = movePathCache.get(unitId);
    if (cachedMovePath) {
      while (
        cachedMovePath.nextPathIndex < cachedMovePath.path.length
        && isAtTarget(position, cachedMovePath.path[cachedMovePath.nextPathIndex]!)
      ) {
        cachedMovePath.nextPathIndex += 1;
      }

      const previousPathIndex = Math.max(0, cachedMovePath.nextPathIndex - 1);
      const previousStep = cachedMovePath.path[previousPathIndex];
      if (
        !isAtTarget(cachedMovePath.destination, target)
        && isCellPassableForUnit(unitId, target.x, target.y, activeWorld)
      ) {
        movePathCache.delete(unitId);
      } else if (previousStep && isAtTarget(position, previousStep)) {
        const nextStep = cachedMovePath.path[cachedMovePath.nextPathIndex] ?? cachedMovePath.destination;
        if (
          isAtTarget(position, cachedMovePath.destination)
          && !isAtTarget(cachedMovePath.destination, target)
        ) {
          movePathCache.delete(unitId);
        } else {
          if (
            isAtTarget(position, nextStep)
            || isCellPassableForUnit(unitId, nextStep.x, nextStep.y, activeWorld)
          ) {
            return {
              destination: cachedMovePath.destination,
              nextStep,
            };
          }
        }
      }
    }

    const refreshedMovementPath = findMovementPathToCandidates(
      unitId,
      position,
      getNearestMoveCandidates(target),
      false,
      activeWorld,
      isCellPassableForUnit,
    );
    if (!refreshedMovementPath) {
      movePathCache.delete(unitId);
      return null;
    }
    const refreshedMovePath: CachedMovePath = {
      destination: refreshedMovementPath.destination,
      path: refreshedMovementPath.path,
      nextPathIndex: refreshedMovementPath.path.length > 1 ? 1 : 0,
    };
    movePathCache.set(unitId, refreshedMovePath);

    return {
      destination: refreshedMovePath.destination,
      nextStep: refreshedMovePath.path[refreshedMovePath.nextPathIndex] ?? refreshedMovePath.destination,
    };
  }

  // Unreachable-plan cache (v0.3.160). Units never block
  // `isCellPassableForUnit`, so whether ANY path exists between two cells can
  // only change when a building, resource, or terrain cell changes — i.e.
  // when worldOccupancy.structuralRevision bumps. Without this, every carrier
  // stuck behind a sealed corridor re-ran a full-map failing A* PER APPROACH
  // CANDIDATE every retry interval: profiled at 12.3 s/tick on the
  // feudal-stone fixture by tick 8,340 (16 villagers against a farm wall).
  const unreachablePlans = new Map<string, number>();
  const UNREACHABLE_CACHE_LIMIT = 4096;

  function cachedUnreachable(key: string): boolean {
    const revision = deps.structuralRevision?.();
    if (revision === undefined) return false;
    return unreachablePlans.get(key) === revision;
  }

  function rememberUnreachable(key: string): void {
    const revision = deps.structuralRevision?.();
    if (revision === undefined) return;
    if (unreachablePlans.size >= UNREACHABLE_CACHE_LIMIT) unreachablePlans.clear();
    unreachablePlans.set(key, revision);
  }

  // See approachPlanCache.ts for why replaying a stored answer cannot change a
  // decision: the key pins the unit's start CELL and the structural revision,
  // and the only other input the search reads that can change — the asking
  // unit's owner, at a gate — is announced as a revision bump when it does.
  const approachPlans = createApproachPlanCache<UnitMovementPlan>();

  function findResourceApproachPlan(
    unitId: number,
    resourceId: number,
    activeWorld: CivWorld = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    const resourcePosition = activeWorld.getComponent<Position>(resourceId, 'position');
    if (!position || !resourcePosition) {
      return null;
    }

    const cacheKey = `r${unitId}:${resourceId}`;
    if (cachedUnreachable(cacheKey)) return null;
    const reused = approachPlans.get(cacheKey, deps.structuralRevision?.(), position);
    if (reused) return reused.plan;
    const plan = findMovementPlan(
      unitId,
      position,
      orderApproachCandidates(position, getApproachCellsForFootprint(resourcePosition, 1, 1, 1)),
      true,
      activeWorld,
    );
    if (!plan) rememberUnreachable(cacheKey);
    else unreachablePlans.delete(cacheKey);
    approachPlans.set(cacheKey, deps.structuralRevision?.(), position, plan);
    return plan;
  }

  function findBuildingApproachPlan(
    unitId: number,
    buildingId: number,
    range = 1,
    activeWorld: CivWorld = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    const buildingPosition = activeWorld.getComponent<Position>(buildingId, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !buildingPosition || !building) {
      return null;
    }

    const footprint = buildingFootprint(building.buildingType);
    const cacheKey = `b${unitId}:${buildingId}:${range}`;
    if (cachedUnreachable(cacheKey)) return null;
    const reused = approachPlans.get(cacheKey, deps.structuralRevision?.(), position);
    if (reused) return reused.plan;
    const plan = findMovementPlan(
      unitId,
      position,
      orderApproachCandidates(position, getApproachCellsForFootprint(
        buildingPosition, footprint.width, footprint.height, range,
      )),
      true,
      activeWorld,
    );
    if (!plan) rememberUnreachable(cacheKey);
    else unreachablePlans.delete(cacheKey);
    approachPlans.set(cacheKey, deps.structuralRevision?.(), position, plan);
    return plan;
  }

  function findUnitRangePlan(
    unitId: number,
    targetPosition: Position,
    range: number,
    activeWorld: CivWorld = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    if (!position) {
      return null;
    }

    const candidates = getCellsWithinRange(targetPosition, range)
      .filter((candidate) => !(candidate.x === targetPosition.x && candidate.y === targetPosition.y));
    return findMovementPlan(unitId, position, candidates, true, activeWorld);
  }

  function findWildlifeRangePlan(
    resourceId: number,
    targetPosition: Position,
    range: number,
    activeWorld: CivWorld = world,
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(resourceId, 'position');
    if (!position) {
      return null;
    }

    const candidates = getCellsWithinRange(targetPosition, range)
      .filter((candidate) => !(candidate.x === targetPosition.x && candidate.y === targetPosition.y));
    return findMovementPlan(
      resourceId,
      position,
      candidates,
      true,
      activeWorld,
      isCellPassableForWildlife,
    );
  }

  return {
    uniquePositions,
    getCellsWithinRange,
    getApproachCellsForFootprint,
    getNearestMoveCandidates,
    findMovementPathToCandidates,
    findMovementPlan,
    resolveMovePlanFromCache,
    findResourceApproachPlan,
    findBuildingApproachPlan,
    findUnitRangePlan,
    findWildlifeRangePlan,
  };
}
