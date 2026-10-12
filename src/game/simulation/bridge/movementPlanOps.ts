// Movement plan ops. Walks A* over a passable-cell predicate and shapes the
// result into a `UnitMovementPlan` (destination + nextStep). The cached
// variant memoizes the full path between calls so a long move order doesn't
// re-solve every tick — invalidates when the original click target opens up
// or the next step gets blocked.

import { findGridPath, type Position } from 'civ-engine';

import { orderApproachCandidates } from './approachOrdering';
import { buildingFootprint, clonePosition, type GameWorld } from './pureHelpers';
import type { BuildingComponent } from '../types';
import type { UnitMovementPlan } from './movementTypes';
import { createApproachPlanCache } from './approachPlanCache';
import { createMoveDestinationSearch, type CachedMovePath } from './moveDestinationSearch';

type CivWorld = GameWorld;

interface ResolvedMovementPath {
  destination: Position;
  path: Position[];
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
  /** Names what holds a cell, for the walk order that cannot be carried out. */
  describeBlockedCell?: (x: number, y: number) => string | null;
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
  /** One sentence when a walk order cannot be carried out, else null. */
  describeWalkOrderReach(
    unitIds: readonly number[],
    target: Position,
    activeWorld?: CivWorld,
  ): string | null;
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
  const destinationSearch = createMoveDestinationSearch({
    mapWidth,
    mapHeight,
    movePathCache,
    isCellPassableForUnit,
    ...(deps.describeBlockedCell ? { describeBlockedCell: deps.describeBlockedCell } : {}),
  });

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

  function isGridCell(position: Position): boolean {
    return Number.isInteger(position.x) && Number.isInteger(position.y)
      && position.x >= 0 && position.y >= 0 && position.x < mapWidth && position.y < mapHeight;
  }

  /** The cells A* can reach from `start`: orthogonal steps through passable cells, as findGridPath walks. */
  function floodReachable(start: Position, passable: (x: number, y: number) => boolean): Uint8Array {
    const reached = new Uint8Array(mapWidth * mapHeight);
    if (!isGridCell(start) || !passable(start.x, start.y)) return reached;
    // 0 unknown, 1 reached, 2 read as blocked: each cell's passability is read once.
    const queue = [start.y * mapWidth + start.x];
    reached[queue[0]!] = 1;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head]!;
      const x = index % mapWidth;
      const y = (index - x) / mapWidth;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= mapWidth || ny >= mapHeight) continue;
        const next = ny * mapWidth + nx;
        if (reached[next] !== 0) continue;
        if (passable(nx, ny)) {
          reached[next] = 1;
          queue.push(next);
        } else {
          reached[next] = 2;
        }
      }
    }
    for (let index = 0; index < reached.length; index += 1) if (reached[index] === 2) reached[index] = 0;
    return reached;
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

    // First reachable candidate wins, so a start that reaches few of them used
    // to pay one failed A* per candidate: a boxed-in sheep ordered across
    // aoe2-prototype ran 1,756-2,731 a tick (work 123). A* here steps
    // orthogonally and refuses a blocked start, so it can never reach a goal
    // outside the start's 4-connected passable region. After the first
    // failure that region is flooded once and every candidate outside it is
    // skipped. Every candidate inside it still goes to findGridPath, whose
    // 10,000-iteration cap (civ-engine's default; builderReachability.ts has
    // the same boundary) can still turn it down on a map past about 8,000
    // cells, exactly as before. So the candidate chosen and its path are the
    // ones the search-per-candidate loop chose (tests/simulation/
    // movementPlanCandidateReach.test.ts). A candidate the flood cannot index
    // also goes to findGridPath, which judges it as before.
    let reachable: Uint8Array | null = null;
    for (const destination of uniqueCandidates) {
      if (reachable && isGridCell(destination) && reachable[destination.y * mapWidth + destination.x] === 0) {
        continue;
      }
      const pathResult = findGridPath({
        width: mapWidth,
        height: mapHeight,
        start,
        goal: destination,
        blocked: (x, y) => !isPassable(unitId, x, y, activeWorld),
      });
      if (!pathResult) {
        reachable ??= floodReachable(start, (x, y) => isPassable(unitId, x, y, activeWorld));
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
      getApproachCellsForFootprint(resourcePosition, 1, 1, 1), // never sorted
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
    nearestFirst = true, // every building approach sorts; see approachOrdering
  ): UnitMovementPlan | null {
    const position = activeWorld.getComponent<Position>(unitId, 'position');
    const buildingPosition = activeWorld.getComponent<Position>(buildingId, 'position');
    const building = activeWorld.getComponent<BuildingComponent>(buildingId, 'building');
    if (!position || !buildingPosition || !building) {
      return null;
    }

    const cacheKey = `b${unitId}:${buildingId}:${range}:${nearestFirst ? 'n' : 'e'}`;
    if (cachedUnreachable(cacheKey)) return null;
    const reused = approachPlans.get(cacheKey, deps.structuralRevision?.(), position);
    if (reused) return reused.plan;
    // Cells AFTER both cache checks: hoisting them above cost 1,470,428
    // discarded allocations per 20,000 ticks (92.2% of calls hit the cache).
    const { width, height } = buildingFootprint(building.buildingType);
    const cells = getApproachCellsForFootprint(buildingPosition, width, height, range);
    const plan = findMovementPlan(
      unitId,
      position,
      nearestFirst ? orderApproachCandidates(position, cells) : cells,
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
    resolveMovePlanFromCache: (unitId, target, activeWorld = world) => (
      destinationSearch.resolveMovePlanFromCache(unitId, target, activeWorld)
    ),
    describeWalkOrderReach: (unitIds, target, activeWorld = world) => (
      destinationSearch.describeWalkOrderReach(unitIds, target, activeWorld)
    ),
    findResourceApproachPlan,
    findBuildingApproachPlan,
    findUnitRangePlan,
    findWildlifeRangePlan,
  };
}
