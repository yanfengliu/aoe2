// Where a walk order actually ends, and whether the player can be told it
// cannot end where they asked.
//
// Split out of movementPlanOps (2026-09-06) with the walk-order defect the
// standing loop found by playing: on a 93-minute Black Forest match the whole
// army was ordered across the map and NOTHING happened — no step, no message.
// Two mechanisms, both here:
//
//  1. The old fallback walked `getNearestMoveCandidates(target)` — every cell
//     within `max(mapWidth, mapHeight)` MANHATTAN cells of the target — and ran
//     a full A* per candidate until one succeeded. On a 60x36 map the greatest
//     distance between two cells is 94 and that radius is 60, so a unit sealed
//     in a pocket far from the ordered cell had NO candidate it could reach:
//     the resolver returned null and `playerCommandsSystem` cleared the order.
//     A BFS out of the unit's own cell has no radius to run out of, and costs
//     one pass over the cells it can actually reach instead of thousands of
//     failing A* searches over the whole map.
//  2. Nothing ever said the order could not be carried out.
//     `describeWalkOrderReach` is the sentence, in the same shape the placement
//     validator uses: what happened, which cell caused it, what would satisfy it.
//
// The destination this picks is the reachable cell with the smallest
// (manhattan-to-target, y, x) — deliberately the same key the old candidate
// scan used (rings by manhattan distance, then row-major within a ring, first
// reachable wins), so every order the old scan COULD carry out ends in exactly
// the same cell.

import { findGridPath, type Position } from 'civ-engine';

import type { UnitComponent } from '../types';
import { unitDomain, type UnitDomain } from '../unitDomain';
import { isAtTarget, type GameWorld } from './pureHelpers';
import type { UnitMovementPlan } from './movementTypes';

type IsPassable = (
  entityId: number,
  x: number,
  y: number,
  worldState: GameWorld,
) => boolean;

export interface ResolvedWalkPath {
  destination: Position;
  path: Position[];
}

/** A resolved walk path plus how far along it the unit already is. */
export interface CachedMovePath extends ResolvedWalkPath {
  nextPathIndex: number;
}

export interface MoveDestinationSearchDeps {
  mapWidth: number;
  mapHeight: number;
  /** Per-unit standing path, so a long order does not re-solve every tick. */
  movePathCache: Map<number, CachedMovePath>;
  isCellPassableForUnit: IsPassable;
  /** Names whatever holds a cell — 'forest', 'a house (building)', … — so the
   *  player-facing sentence can say what is in the way. Optional: without it
   *  the sentence still names the cell and the remedy. */
  describeBlockedCell?: (x: number, y: number) => string | null;
}

export interface MoveDestinationSearch {
  /** The path a walk order actually takes: to the ordered cell when it can be
   *  reached, otherwise to the reachable cell closest to it. Null only when the
   *  unit's own cell is impassable (nowhere to walk from). */
  resolveWalkPath(
    unitId: number,
    start: Position,
    target: Position,
    activeWorld: GameWorld,
  ): ResolvedWalkPath | null;
  /** The step a standing walk order takes this tick: reuses the cached path
   *  while it stays valid, re-solves when it does not. */
  resolveMovePlanFromCache(
    unitId: number,
    target: Position,
    activeWorld: GameWorld,
  ): UnitMovementPlan | null;
  /** One sentence for the player when some of a selection cannot reach the
   *  ordered cell at all, or null when every one of them can. */
  describeWalkOrderReach(
    unitIds: readonly number[],
    target: Position,
    activeWorld: GameWorld,
  ): string | null;
}

/** How far a seed may wander from a cell the player clicked that nothing can
 *  stand on (a tree, water) before we stay quiet rather than guess. */
const SEED_SEARCH_RADIUS = 8;
/** How much of a wall is sampled before naming it. Bounds the only work the
 *  message adds, and a wall is one or two kinds of thing long before this. */
const BARRIER_SAMPLE_LIMIT = 512;

export function createMoveDestinationSearch(
  deps: MoveDestinationSearchDeps,
): MoveDestinationSearch {
  const {
    mapWidth, mapHeight, movePathCache, isCellPassableForUnit, describeBlockedCell,
  } = deps;
  const cellCount = mapWidth * mapHeight;
  const indexOfCell = (x: number, y: number): number => y * mapWidth + x;

  interface Flood {
    /** 1 for every cell the unit can reach, indexed by `indexOfCell`. */
    readonly reached: Uint8Array;
    /** Predecessor cell index, -1 at the start and for unreached cells. */
    readonly cameFrom: Int32Array;
    /** Cells that stopped the flood, for naming what is in the way. */
    readonly frontier: Position[];
  }

  // 4-connected, over exactly the predicate `findGridPath` is handed, so
  // "reachable" here and "a path exists" there are the same claim.
  function flood(unitId: number, start: Position, activeWorld: GameWorld): Flood | null {
    if (!isCellPassableForUnit(unitId, start.x, start.y, activeWorld)) return null;
    const reached = new Uint8Array(cellCount);
    const cameFrom = new Int32Array(cellCount).fill(-1);
    const frontier: Position[] = [];
    const queue = new Int32Array(cellCount);
    let head = 0;
    let tail = 0;
    const startIndex = indexOfCell(start.x, start.y);
    reached[startIndex] = 1;
    queue[tail] = startIndex;
    tail += 1;
    while (head < tail) {
      const current = queue[head]!;
      head += 1;
      const x = current % mapWidth;
      const y = (current - x) / mapWidth;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= mapWidth || ny < 0 || ny >= mapHeight) continue;
        const next = indexOfCell(nx, ny);
        if (reached[next] !== 0) continue;
        if (!isCellPassableForUnit(unitId, nx, ny, activeWorld)) {
          reached[next] = 2; // seen, not walkable — only so it is named once
          frontier.push({ x: nx, y: ny });
          continue;
        }
        reached[next] = 1;
        cameFrom[next] = current;
        queue[tail] = next;
        tail += 1;
      }
    }
    return { reached, cameFrom, frontier };
  }

  /** The reachable cell with the smallest (manhattan-to-target, y, x). */
  function closestReachedTo(reached: Uint8Array, target: Position): number {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let y = 0; y < mapHeight; y += 1) {
      const rowDistance = Math.abs(y - target.y);
      if (rowDistance >= bestDistance) continue; // no x in this row can win
      for (let x = 0; x < mapWidth; x += 1) {
        const index = indexOfCell(x, y);
        if (reached[index] !== 1) continue;
        const distance = rowDistance + Math.abs(x - target.x);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      }
    }
    return best;
  }

  function pathFromFlood(cameFrom: Int32Array, start: Position, endIndex: number): Position[] {
    const reversed: Position[] = [];
    let cursor = endIndex;
    const startIndex = indexOfCell(start.x, start.y);
    while (cursor !== -1 && cursor !== startIndex) {
      const x = cursor % mapWidth;
      reversed.push({ x, y: (cursor - x) / mapWidth });
      cursor = cameFrom[cursor]!;
    }
    reversed.push({ x: start.x, y: start.y });
    return reversed.reverse();
  }

  function resolveWalkPath(
    unitId: number,
    start: Position,
    target: Position,
    activeWorld: GameWorld,
  ): ResolvedWalkPath | null {
    // Fast path: the ordered cell itself. This is the case that used to cost a
    // single A* and still does — the flood below only runs once the order
    // cannot be carried out as given.
    if (isCellPassableForUnit(unitId, target.x, target.y, activeWorld)) {
      const direct = findGridPath({
        width: mapWidth,
        height: mapHeight,
        start,
        goal: target,
        blocked: (x, y) => !isCellPassableForUnit(unitId, x, y, activeWorld),
      });
      if (direct) {
        return {
          destination: { x: target.x, y: target.y },
          path: direct.path.map((step) => ({ x: step.x, y: step.y })),
        };
      }
    }

    const reach = flood(unitId, start, activeWorld);
    if (!reach) return null;
    const bestIndex = closestReachedTo(reach.reached, target);
    if (bestIndex === -1) return null;
    const bestX = bestIndex % mapWidth;
    const destination = { x: bestX, y: (bestIndex - bestX) / mapWidth };
    if (destination.x === start.x && destination.y === start.y) {
      return { destination, path: [{ x: start.x, y: start.y }] };
    }
    // A* first so a route the old scan could already produce is unchanged; the
    // flood's own path is the backstop for the case A* refuses (its iteration
    // cap reports "unreachable" identically to "no route").
    const routed = findGridPath({
      width: mapWidth,
      height: mapHeight,
      start,
      goal: destination,
      blocked: (x, y) => !isCellPassableForUnit(unitId, x, y, activeWorld),
    });
    return {
      destination,
      path: routed
        ? routed.path.map((step) => ({ x: step.x, y: step.y }))
        : pathFromFlood(reach.cameFrom, start, bestIndex),
    };
  }

  function resolveMovePlanFromCache(
    unitId: number,
    target: Position,
    activeWorld: GameWorld,
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
        } else if (
          isAtTarget(position, nextStep)
          || isCellPassableForUnit(unitId, nextStep.x, nextStep.y, activeWorld)
        ) {
          return { destination: cachedMovePath.destination, nextStep };
        }
      }
    }

    const refreshed = resolveWalkPath(unitId, position, target, activeWorld);
    if (!refreshed) {
      movePathCache.delete(unitId);
      return null;
    }
    const refreshedMovePath: CachedMovePath = {
      destination: refreshed.destination,
      path: refreshed.path,
      nextPathIndex: refreshed.path.length > 1 ? 1 : 0,
    };
    movePathCache.set(unitId, refreshedMovePath);

    return {
      destination: refreshedMovePath.destination,
      nextStep: refreshedMovePath.path[refreshedMovePath.nextPathIndex] ?? refreshedMovePath.destination,
    };
  }

  /** A cell near `target` that this unit could stand on, for seeding the
   *  reachability question when the player clicked a tree or open water. */
  function seedNear(unitId: number, target: Position, activeWorld: GameWorld): Position | null {
    for (let radius = 0; radius <= SEED_SEARCH_RADIUS; radius += 1) {
      for (let y = target.y - radius; y <= target.y + radius; y += 1) {
        for (let x = target.x - radius; x <= target.x + radius; x += 1) {
          if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue;
          if (Math.abs(x - target.x) + Math.abs(y - target.y) !== radius) continue;
          if (isCellPassableForUnit(unitId, x, y, activeWorld)) return { x, y };
        }
      }
    }
    return null;
  }

  /** What is in the way, named by what holds MOST of the wall rather than by
   *  the first cells the flood happened to touch: seeded beside the units, the
   *  first two were the player's own town centre and a berry bush, while the
   *  wall was forest. Ties keep first-seen order, so the answer is stable. */
  function nameBarrier(frontier: Position[]): { text: string; plural: boolean } {
    if (!describeBlockedCell) return { text: 'blocked ground', plural: false };
    const counts = new Map<string, number>();
    for (const cell of frontier.slice(0, BARRIER_SAMPLE_LIMIT)) {
      const cause = describeBlockedCell(cell.x, cell.y);
      if (cause) counts.set(cause, (counts.get(cause) ?? 0) + 1);
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([cause]) => cause);
    if (ranked.length === 0) return { text: 'blocked ground', plural: false };
    return { text: ranked.slice(0, 2).join(' and '), plural: ranked.length > 1 };
  }

  function describeWalkOrderReach(
    unitIds: readonly number[],
    target: Position,
    activeWorld: GameWorld,
  ): string | null {
    if (unitIds.length === 0) return null;
    // Reachability over a grid is symmetric, so one flood out of the ordered
    // cell answers for the whole selection instead of one per unit. Domain is
    // the only thing that changes the predicate within one owner's selection
    // (a ship and a soldier disagree about every cell), so at most two floods.
    const floodByDomain = new Map<UnitDomain, Flood | null>();
    let blocked = 0;
    // Counted, not `unitIds.length`: a garrisoned unit has no position at all
    // (garrisonOps clears it), so it is not one of the units being talked about.
    let considered = 0;
    let firstBlocked: { unitId: number; position: Position } | null = null;
    for (const unitId of unitIds) {
      const unit = activeWorld.getComponent<UnitComponent>(unitId, 'unit');
      const position = activeWorld.getComponent<Position>(unitId, 'position');
      if (!unit || !position) continue;
      considered += 1;
      const domain = unitDomain(unit.unitType);
      if (!floodByDomain.has(domain)) {
        const seed = seedNear(unitId, target, activeWorld);
        floodByDomain.set(domain, seed ? flood(unitId, seed, activeWorld) : null);
      }
      const reach = floodByDomain.get(domain) ?? null;
      if (!reach) continue;
      if (reach.reached[indexOfCell(position.x, position.y)] !== 1) {
        blocked += 1;
        firstBlocked ??= { unitId, position };
      }
    }
    if (blocked === 0 || !firstBlocked) return null;
    // Name what walls the STUCK unit in, not what the open half of the map
    // happens to touch — seeded at the target, the frontier picked out the
    // player's own town centre on the far side and said that was the barrier.
    const ownSide = flood(firstBlocked.unitId, firstBlocked.position, activeWorld);
    const barrier = ownSide ? nameBarrier(ownSide.frontier) : { text: 'blocked ground', plural: false };
    const block = barrier.plural ? 'block' : 'blocks';

    const where = `(${String(target.x)}, ${String(target.y)})`;
    const total = considered;
    if (blocked === total) {
      const who = total === 1 ? 'where the selected unit stands'
        : total === 2 ? 'where both selected units stand'
        : `where all ${String(total)} selected units stand`;
      const whose = total === 1 ? 'its' : 'their';
      return `Cannot reach ${where}: ${barrier.text} ${block} every route out from ${who}.`
        + ` Clear a path, or pick a cell on ${whose} side of it.`;
    }
    const rest = total - blocked;
    return `${String(blocked)} of ${String(total)} selected units cannot reach ${where}:`
      + ` ${barrier.text} ${block} every route out from where they stand.`
      + ` The other ${String(rest)} ${rest === 1 ? 'is' : 'are'} on the way.`;
  }

  return { resolveWalkPath, resolveMovePlanFromCache, describeWalkOrderReach };
}
