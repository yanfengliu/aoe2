// Allocation helpers used by `worldOccupancy.ts`. Extracted to keep that
// file under the 500-LOC budget. `allocateGroupMoveTargets` implements the
// spec §12.7 group pre-reservation rule (deterministic spiral fill with
// per-cell capacity tracking); `NEIGHBOR_OFFSETS` is the BFS adjacency used
// by both the group spiral and any other 8-direction neighbor walks.

import type { EntityId, OccupancyCellStatus, Position } from 'civ-engine';
import { blocksWholeCell } from './worldOccupancyCells';

// Eight-direction neighbor offsets. Order (E, W, S, N, then diagonals) is
// deterministic so the spec's "deterministic spiral-outward" requirement
// holds across runs, saves, and replays.
export const NEIGHBOR_OFFSETS: ReadonlyArray<Position> = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
];

// Default cap on the spiral search radius. Matches spec §12.7's lazy-redirect
// search radius and prevents pathological all-blocked maps from looping.
const SPIRAL_RADIUS_CAP = 16;

function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

// The whole-cell test below is `blocksWholeCell` from worldOccupancyCells — the
// one list of blocking kinds, so a spiral never lands a unit where spawn
// refuses one, and a farm (walkable ground) is a candidate cell here as there.
// This file used to carry its own copy of the list.

// BFS from `targetCenter` over an in-bounds 8-direction graph, capped at
// `SPIRAL_RADIUS_CAP` Chebyshev radius. Output order is deterministic so the
// spec's "deterministic spiral-outward" requirement holds across runs.
export function generateSpiralCells(
  targetCenter: Position,
  worldWidth: number,
  worldHeight: number,
): Position[] {
  if (
    targetCenter.x < 0
    || targetCenter.x >= worldWidth
    || targetCenter.y < 0
    || targetCenter.y >= worldHeight
  ) {
    return [];
  }
  const cells: Position[] = [];
  const visited = new Set<string>();
  const queue: Position[] = [targetCenter];
  visited.add(positionKey(targetCenter.x, targetCenter.y));
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    if (!cell) continue;
    cells.push(cell);
    if (
      Math.abs(cell.x - targetCenter.x) >= SPIRAL_RADIUS_CAP
      || Math.abs(cell.y - targetCenter.y) >= SPIRAL_RADIUS_CAP
    ) {
      continue;
    }
    for (const offset of NEIGHBOR_OFFSETS) {
      const nx = cell.x + offset.x;
      const ny = cell.y + offset.y;
      if (nx < 0 || nx >= worldWidth || ny < 0 || ny >= worldHeight) {
        continue;
      }
      const key = positionKey(nx, ny);
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return cells;
}

// Spec §12.7 lazy-redirect search. Walks the spiral around `requestedPosition`
// and returns the first cell with a free unit slot (the entity itself is
// treated as non-blocking). Returns null when no candidate is found within
// the search radius. Uses the same spiral as the group allocator so a
// single-unit redirect and the N-th unit of a group settle on consistent
// closest-first cells.
export function findNearestFreeUnitCellInSpiral(
  ctx: GroupMoveAllocatorContext,
  entity: EntityId,
  requestedPosition: Position,
  hasFreeSlot: (entity: EntityId, position: Position) => boolean,
): Position | null {
  const { worldWidth, worldHeight, getCellStatus } = ctx;
  const cells = generateSpiralCells(requestedPosition, worldWidth, worldHeight);
  for (const cell of cells) {
    const status = getCellStatus(cell.x, cell.y, entity);
    if (status.blockedBy.some(blocksWholeCell)) continue;
    if (hasFreeSlot(entity, cell)) {
      return cell;
    }
  }
  return null;
}

export interface GroupMoveAllocatorContext {
  worldWidth: number;
  worldHeight: number;
  getCellStatus: (
    x: number,
    y: number,
    ignoredEntityId?: EntityId | null,
  ) => OccupancyCellStatus;
}

// Spec §12.7 eager pre-reservation. Allocates one target cell per unit by
// walking outward from `targetCenter` in BFS order; assigns up to (cell
// capacity - currently occupied) units to each cell before moving to the
// next. Whole-cell-blocked cells are skipped. When the spiral exhausts
// without capacity, falls back to `targetCenter` (visual stacking is the
// last-resort behavior, consistent with §12.6). Output array order matches
// the input `unitIds` order.
export function allocateGroupMoveTargets(
  ctx: GroupMoveAllocatorContext,
  unitIds: ReadonlyArray<EntityId>,
  targetCenter: Position,
  preferredCells?: ReadonlyArray<Position> | null,
): Position[] {
  const { worldWidth, worldHeight, getCellStatus } = ctx;
  const targets: Position[] = [];
  const assignedThisCall = new Map<string, number>();
  const spiralCells = generateSpiralCells(targetCenter, worldWidth, worldHeight);

  // A formation supplies one PREFERRED cell per unit, in the same order as
  // `unitIds` (spec §9.5). It is a preference, never a placement: if the cell
  // is blocked or full the unit falls through to the ordinary spiral, so a
  // shape pressed against a cliff degrades into a blob rather than stacking
  // units on rock. Off-map preferences are dropped for the same reason.
  const inBounds = (cell: Position) => (
    cell.x >= 0 && cell.y >= 0 && cell.x < worldWidth && cell.y < worldHeight
  );

  for (const [index, unitId] of unitIds.entries()) {
    let assigned: Position | null = null;
    const preferred = preferredCells?.[index];
    if (preferred && inBounds(preferred)) {
      const status = getCellStatus(preferred.x, preferred.y, unitId);
      const used = assignedThisCall.get(positionKey(preferred.x, preferred.y)) ?? 0;
      if (!status.blockedBy.some(blocksWholeCell) && (status.freeSubcellSlots ?? 0) - used > 0) {
        assignedThisCall.set(positionKey(preferred.x, preferred.y), used + 1);
        targets.push(preferred);
        continue;
      }
    }
    for (const cell of spiralCells) {
      const status = getCellStatus(cell.x, cell.y, unitId);
      if (status.blockedBy.some(blocksWholeCell)) continue;
      const free = status.freeSubcellSlots ?? 0;
      const usedHere = assignedThisCall.get(positionKey(cell.x, cell.y)) ?? 0;
      if (free - usedHere > 0) {
        assigned = cell;
        assignedThisCall.set(positionKey(cell.x, cell.y), usedHere + 1);
        break;
      }
    }
    targets.push(assigned ?? targetCenter);
  }

  return targets;
}
