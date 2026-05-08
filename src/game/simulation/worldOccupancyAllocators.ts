// Allocation helpers used by `worldOccupancy.ts`. Extracted to keep that
// file under the 500-LOC budget. `allocateGroupMoveTargets` implements the
// spec §12.7 group pre-reservation rule (deterministic spiral fill with
// per-cell capacity tracking); `NEIGHBOR_OFFSETS` is the BFS adjacency used
// by both the group spiral and any other 8-direction neighbor walks.

import type { EntityId, OccupancyCellStatus, Position } from 'civ-engine';

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

function isWholeCellBlocker(status: OccupancyCellStatus): boolean {
  return status.blockedBy.some(
    (claim) =>
      claim.kind === 'building'
      || claim.kind === 'resource'
      || claim.kind === 'terrain'
      || claim.kind === 'bounds',
  );
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
): Position[] {
  const { worldWidth, worldHeight, getCellStatus } = ctx;
  const targets: Position[] = [];
  const assignedThisCall = new Map<string, number>();
  const targetIsInBounds =
    targetCenter.x >= 0
    && targetCenter.x < worldWidth
    && targetCenter.y >= 0
    && targetCenter.y < worldHeight;

  const spiralCells: Position[] = [];
  if (targetIsInBounds) {
    const visited = new Set<string>();
    const queue: Position[] = [targetCenter];
    visited.add(positionKey(targetCenter.x, targetCenter.y));
    for (let head = 0; head < queue.length; head += 1) {
      const cell = queue[head];
      if (!cell) continue;
      spiralCells.push(cell);
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
  }

  for (const unitId of unitIds) {
    let assigned: Position | null = null;
    for (const cell of spiralCells) {
      const status = getCellStatus(cell.x, cell.y, unitId);
      if (isWholeCellBlocker(status)) continue;
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
