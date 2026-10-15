// A relic is either on the ground or in one Monk's hands (work 128; spec §6.9).
//
// In a Monk's hands it stands on no ground: it claims no cell (transformOps),
// and no other Monk can take it, whoever owns that Monk. Definitive Edition
// drops a carried relic only when its carrier dies, so a Monk sent for a relic
// that another Monk picks up first gives up the errand. `relicHolder` is the
// one answer to "who holds this relic", read without allocating, because the
// occupancy sync asks it on every step an animal or a relic takes.
//
// On the ground it claims its cell, so where a relic lands matters (review
// round 0 of work 128, SF1). `findRelicLandingCells` is the one search for it,
// shared by the Monastery that spills its relics when destroyed and the Monk
// that drops one when it dies. A relic lands only on a cell nothing claims: no
// unit, no structure (a Farm, a foundation nobody has started), no resource and
// no blocked terrain. Landing under a unit stranded that unit, because every
// path search refuses a blocked start. It also split live play from a replay:
// the live relic took an overflow claim beside the unit, while a loaded world's
// rebuild, which claims resources before units, gave the relic the cell's
// claim. Landing on a Farm walled the walkable plot.
//
// The search is the Monastery spill's ring: search ranges from `firstRange` out
// to the map's width plus height, each one every cell of the disc around the
// footprint in row order, so the nearest free cells come first. A dropping
// Monk asks its own cell first, from range 0.

import type { OccupancyCellStatus, Position } from 'civ-engine';

import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { monkCarriedRelicCodec } from './bridgeStateSerialize';

/** The Monk holding `relicId`, or null for a relic on the ground. */
export function relicHolder(accessor: BridgeStateAccessor, relicId: number): number | null {
  for (const [monkId, carriedId] of accessor.get(monkCarriedRelicCodec)) {
    if (carriedId === relicId) return monkId;
  }
  return null;
}

export interface RelicLandingDeps {
  mapWidth: number;
  mapHeight: number;
  getApproachCellsForFootprint: (anchor: Position, width: number, height: number, range?: number) => Position[];
  isTerrainPassableForUnit: (x: number, y: number) => boolean;
  getCellStatus: (x: number, y: number) => OccupancyCellStatus;
}

/** Up to `count` cells nothing claims, nearest ring first, around a footprint
 *  at `anchor`. Fewer when the map has no more; the caller decides where the
 *  rest go. */
export function findRelicLandingCells(
  deps: RelicLandingDeps,
  anchor: Position,
  footprint: { width: number; height: number },
  count: number,
  firstRange: number,
): Position[] {
  const cells: Position[] = [];
  const free = (cell: Position): boolean => {
    if (!deps.isTerrainPassableForUnit(cell.x, cell.y)) return false;
    const status = deps.getCellStatus(cell.x, cell.y);
    if (status.blockedBy.length > 0 || status.crowdedBy.length > 0) return false;
    return !cells.some((taken) => taken.x === cell.x && taken.y === cell.y);
  };
  if (firstRange === 0 && footprint.width === 1 && footprint.height === 1 && count > 0 && free(anchor)) {
    cells.push({ x: anchor.x, y: anchor.y });
  }
  const maxRange = deps.mapWidth + deps.mapHeight;
  for (let range = Math.max(1, firstRange); range <= maxRange && cells.length < count; range += 1) {
    for (const candidate of deps.getApproachCellsForFootprint(anchor, footprint.width, footprint.height, range)) {
      if (cells.length >= count) break;
      if (free(candidate)) cells.push(candidate);
    }
  }
  return cells;
}
