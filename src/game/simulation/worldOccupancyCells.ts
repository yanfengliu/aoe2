// Pure shapes and helpers behind `worldOccupancy`, split out to keep that file
// inside the 500-line budget. Nothing here touches the binding or the world —
// it is the sub-cell slot table, the overflow bookkeeping shapes, and three
// small cell-map helpers.

import type {
  EntityId,
  OccupancyCellClaim,
  OccupancyCellStatus,
  Position,
  SubcellSlotOffset,
} from 'civ-engine';

export interface Footprint {
  width: number;
  height: number;
}

export interface OverflowBlockedState {
  positions: Position[];
  claim: OccupancyCellClaim;
}

export interface OverflowCrowdedState {
  position: Position;
  claim: OccupancyCellClaim;
}

export const UNIT_OCCUPANCY_SLOTS: ReadonlyArray<SubcellSlotOffset> = [
  { x: 0, y: 0 },
  { x: 0.25, y: 0 },
  { x: 0.5, y: 0 },
  { x: 0.75, y: 0 },
  { x: 0, y: 0.25 },
  { x: 0.25, y: 0.25 },
  { x: 0.5, y: 0.25 },
  { x: 0.75, y: 0.25 },
  { x: 0, y: 0.5 },
  { x: 0.25, y: 0.5 },
  { x: 0.5, y: 0.5 },
  { x: 0.75, y: 0.5 },
  { x: 0, y: 0.75 },
  { x: 0.25, y: 0.75 },
  { x: 0.5, y: 0.75 },
  { x: 0.75, y: 0.75 },
];

/** The claim kinds that make a cell impassable to everything, as opposed to
 *  merely crowded. Listed ONCE: spawn passability, wildlife passability, the
 *  spiral search and the group allocator all read this (they were four copies;
 *  the allocators kept theirs after the other three were unified). A 'farm'
 *  claim is deliberately NOT here — this list is the one place movement and
 *  placement diverge. `isPlacementBlocked` counts every claim, so a farm still
 *  refuses further building, while every land unit walks and spawns across it
 *  (`passableStructures.ts` says why it has to be a claim kind). */
export const blocksWholeCell = (claim: OccupancyCellClaim): boolean => (
  claim.kind === 'bounds' || claim.kind === 'terrain'
  || claim.kind === 'building' || claim.kind === 'resource'
);

export function positionKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function toFootprintCells(anchor: Position, footprint: Footprint): Position[] {
  const cells: Position[] = [];

  for (let y = anchor.y; y < anchor.y + footprint.height; y += 1) {
    for (let x = anchor.x; x < anchor.x + footprint.width; x += 1) {
      cells.push({ x, y });
    }
  }

  return cells;
}

export function removeClaimFromCellMap(
  cellMap: Map<string, OccupancyCellClaim[]>,
  positions: ReadonlyArray<Position>,
  entity: EntityId,
): void {
  for (const position of positions) {
    const key = positionKey(position.x, position.y);
    const existing = cellMap.get(key);
    if (!existing) {
      continue;
    }

    const filtered = existing.filter((claim) => claim.entity !== entity);
    if (filtered.length === 0) {
      cellMap.delete(key);
      continue;
    }

    cellMap.set(key, filtered);
  }
}

export function syntheticOutOfBoundsStatus(x: number, y: number): OccupancyCellStatus {
  return {
    position: { x, y },
    blocked: true,
    blockedBy: [{ entity: null, kind: 'bounds', claim: 'blocked' }],
    crowdedBy: [],
    freeSubcellSlots: null,
  };
}

// Spec §12.6 contract: `syncUnit` records the requested coarse cell and
// returns the visual slot assigned by the engine's SubcellOccupancyGrid;
// `slotOffset === null` means that cell was full. `placeUnitForSpawn` builds
// on that primitive, returning a nearby-cell result after its bounded search
// or outer null when no legal fresh-placement slot exists.
