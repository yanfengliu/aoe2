import { describe, expect, it } from 'vitest';

import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';

// Spec §12.6: multiple units may share a tile via deterministic sub-tile slot
// packing, but no two unit sprites may visually occupy the same on-screen
// position. These tests pin the visual non-overlap contract: every unit in a
// shared cell must get a distinct slot offset, and units that would otherwise
// stack must be relocated to a neighbor cell.

describe('worldOccupancy — visual slot non-overlap (spec §12.6)', () => {
  it('assigns a slot offset to a unit placed in an empty cell', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const result = occupancy.syncUnit(101, { x: 5, y: 5 });

    expect(result.placedAt).toEqual({ x: 5, y: 5 });
    expect(result.slotOffset).not.toBeNull();
    expect(occupancy.getUnitSlotOffset(101)).toEqual(result.slotOffset);
  });

  it('returns null slot offset before a unit is placed', () => {
    const occupancy = createWorldOccupancy(16, 16);

    expect(occupancy.getUnitSlotOffset(999)).toBeNull();
  });

  it('clears the unit slot offset when the unit is released', () => {
    const occupancy = createWorldOccupancy(16, 16);

    occupancy.syncUnit(101, { x: 5, y: 5 });
    expect(occupancy.getUnitSlotOffset(101)).not.toBeNull();

    occupancy.release(101);

    expect(occupancy.getUnitSlotOffset(101)).toBeNull();
  });

  it('gives two units in the same cell distinct slot offsets', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const a = occupancy.syncUnit(101, { x: 5, y: 5 });
    const b = occupancy.syncUnit(102, { x: 5, y: 5 });

    expect(a.placedAt).toEqual({ x: 5, y: 5 });
    expect(b.placedAt).toEqual({ x: 5, y: 5 });
    expect(a.slotOffset).not.toBeNull();
    expect(b.slotOffset).not.toBeNull();
    expect(a.slotOffset).not.toEqual(b.slotOffset);
  });

  it('gives 16 units in the same cell 16 distinct slot offsets', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const offsets = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      const result = occupancy.syncUnit(100 + i, { x: 8, y: 8 });
      expect(result.placedAt).toEqual({ x: 8, y: 8 });
      expect(result.slotOffset).not.toBeNull();
      offsets.add(`${result.slotOffset!.x},${result.slotOffset!.y}`);
    }

    expect(offsets.size).toBe(16);
  });

  it('returns a null slot offset for a 17th unit syncUnit call at a fully-packed cell', () => {
    // syncUnit alone cannot relocate a unit — that would oscillate against
    // a sticky move target. Visual stacking is the explicit fallback for
    // syncUnit's overflow case; renderer can flag it via the null slotOffset.
    const occupancy = createWorldOccupancy(16, 16);

    for (let i = 0; i < 16; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }

    const overflow = occupancy.syncUnit(116, { x: 8, y: 8 });

    expect(overflow.placedAt).toEqual({ x: 8, y: 8 });
    expect(overflow.slotOffset).toBeNull();
  });

  it('placeUnitForSpawn relocates a 17th unit to a neighbor cell with a free slot', () => {
    // Spec §12.6 fallback contract: spawn-time placement (train completion,
    // ungarrison, scenario seed) must redirect to the nearest neighbor when
    // the requested cell is full so the new unit has a distinct visual slot.
    const occupancy = createWorldOccupancy(16, 16);

    for (let i = 0; i < 16; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }

    const overflow = occupancy.placeUnitForSpawn(116, { x: 8, y: 8 });

    expect(overflow.placedAt).not.toEqual({ x: 8, y: 8 });
    expect(overflow.slotOffset).not.toBeNull();
    expect(Math.abs(overflow.placedAt.x - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(overflow.placedAt.y - 8)).toBeLessThanOrEqual(1);
  });

  it('placeUnitForSpawn keeps the requested cell when a slot is available', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const result = occupancy.placeUnitForSpawn(101, { x: 5, y: 5 });

    expect(result.placedAt).toEqual({ x: 5, y: 5 });
    expect(result.slotOffset).not.toBeNull();
    expect(occupancy.getUnitSlotOffset(101)).toEqual(result.slotOffset);
  });

  it('frees a slot when a unit is released, allowing another unit to take it', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const first = occupancy.syncUnit(101, { x: 5, y: 5 });
    const initialSlot = first.slotOffset;
    expect(initialSlot).not.toBeNull();

    occupancy.release(101);

    occupancy.syncUnit(102, { x: 5, y: 5 });
    occupancy.syncUnit(103, { x: 5, y: 5 });
    const reuseCandidate = occupancy.syncUnit(101, { x: 5, y: 5 });

    expect(reuseCandidate.placedAt).toEqual({ x: 5, y: 5 });
    expect(reuseCandidate.slotOffset).not.toBeNull();
  });
});

describe('worldOccupancy — findNearestFreeUnitCell (spec §12.7 lazy redirect)', () => {
  it('returns the requested cell when it has a free slot', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const result = occupancy.findNearestFreeUnitCell(999, { x: 5, y: 5 });

    expect(result).toEqual({ x: 5, y: 5 });
  });

  it('returns a neighboring cell when the requested cell is fully packed', () => {
    const occupancy = createWorldOccupancy(16, 16);

    for (let i = 0; i < 16; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }

    const result = occupancy.findNearestFreeUnitCell(999, { x: 8, y: 8 });

    expect(result).not.toBeNull();
    expect(result).not.toEqual({ x: 8, y: 8 });
    expect(Math.abs(result!.x - 8)).toBeLessThanOrEqual(1);
    expect(Math.abs(result!.y - 8)).toBeLessThanOrEqual(1);
  });

  it('returns null when the requested cell and all neighbors are fully packed', () => {
    const occupancy = createWorldOccupancy(16, 16);

    let nextEntity = 1000;
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let i = 0; i < 16; i += 1) {
          occupancy.syncUnit(nextEntity, { x: 8 + dx, y: 8 + dy });
          nextEntity += 1;
        }
      }
    }

    const result = occupancy.findNearestFreeUnitCell(999, { x: 8, y: 8 });

    expect(result).toBeNull();
  });

  it('treats the entity itself as not blocking when it is the one in overflow at the requested cell', () => {
    const occupancy = createWorldOccupancy(16, 16);

    for (let i = 0; i < 16; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }
    // Unit 116 lands in overflow at (8, 8).
    occupancy.syncUnit(116, { x: 8, y: 8 });
    expect(occupancy.getUnitSlotOffset(116)).toBeNull();

    // Unit 100 leaves — a slot frees up at (8, 8).
    occupancy.release(100);

    // findNearestFreeUnitCell for unit 116 should now return (8, 8) — the
    // cell has space and unit 116 itself doesn't count as a blocker.
    const result = occupancy.findNearestFreeUnitCell(116, { x: 8, y: 8 });
    expect(result).toEqual({ x: 8, y: 8 });
  });
});

describe('worldOccupancy — allocateGroupMoveTargets (spec §12.7 pre-reservation)', () => {
  it('returns the target cell for every unit when capacity allows', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const unitIds = [201, 202, 203, 204, 205];
    const targets = occupancy.allocateGroupMoveTargets(unitIds, { x: 8, y: 8 });

    expect(targets).toHaveLength(5);
    for (const t of targets) {
      expect(t).toEqual({ x: 8, y: 8 });
    }
  });

  it('overflows the 17th-onwards units to neighbor cells in spiral order', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const unitIds: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      unitIds.push(300 + i);
    }
    const targets = occupancy.allocateGroupMoveTargets(unitIds, { x: 8, y: 8 });

    expect(targets).toHaveLength(20);
    // First 16 land at the target cell.
    for (let i = 0; i < 16; i += 1) {
      expect(targets[i]).toEqual({ x: 8, y: 8 });
    }
    // The remaining 4 land at neighbor cells (distance 1).
    for (let i = 16; i < 20; i += 1) {
      expect(targets[i]).not.toEqual({ x: 8, y: 8 });
      expect(Math.abs(targets[i]!.x - 8)).toBeLessThanOrEqual(1);
      expect(Math.abs(targets[i]!.y - 8)).toBeLessThanOrEqual(1);
    }
  });

  it('skips already-occupied slots when computing remaining capacity', () => {
    const occupancy = createWorldOccupancy(16, 16);

    // 12 units already at the target cell; 4 slots remaining.
    for (let i = 0; i < 12; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }

    const incomingIds: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      incomingIds.push(400 + i);
    }
    const targets = occupancy.allocateGroupMoveTargets(incomingIds, { x: 8, y: 8 });

    expect(targets).toHaveLength(6);
    // First 4 land at the target cell (filling the remaining 4 slots).
    for (let i = 0; i < 4; i += 1) {
      expect(targets[i]).toEqual({ x: 8, y: 8 });
    }
    // The remaining 2 spill into neighbor cells.
    for (let i = 4; i < 6; i += 1) {
      expect(targets[i]).not.toEqual({ x: 8, y: 8 });
      expect(Math.abs(targets[i]!.x - 8)).toBeLessThanOrEqual(1);
      expect(Math.abs(targets[i]!.y - 8)).toBeLessThanOrEqual(1);
    }
  });

  it('skips whole-cell-blocked cells (buildings, terrain) during spiral allocation', () => {
    const occupancy = createWorldOccupancy(16, 16);

    // Block the (9, 8) neighbor with a building footprint.
    occupancy.syncBuilding(999, { x: 9, y: 8 }, { width: 1, height: 1 });

    // Fill the target cell so the spiral has to expand.
    for (let i = 0; i < 16; i += 1) {
      occupancy.syncUnit(100 + i, { x: 8, y: 8 });
    }

    const incomingIds = [501, 502, 503];
    const targets = occupancy.allocateGroupMoveTargets(incomingIds, { x: 8, y: 8 });

    // None of the redirected targets should be (9, 8) — that's the building.
    for (const t of targets) {
      expect(t).not.toEqual({ x: 9, y: 8 });
    }
  });

  it('returns the targetCenter as fallback when the spiral exhausts within radius', () => {
    const occupancy = createWorldOccupancy(4, 4);

    // Saturate every cell in this tiny 4x4 world.
    let unitId = 1000;
    for (let x = 0; x < 4; x += 1) {
      for (let y = 0; y < 4; y += 1) {
        for (let i = 0; i < 16; i += 1) {
          occupancy.syncUnit(unitId, { x, y });
          unitId += 1;
        }
      }
    }

    const incomingIds = [9001];
    const targets = occupancy.allocateGroupMoveTargets(incomingIds, { x: 1, y: 1 });

    expect(targets).toHaveLength(1);
    // No cell has capacity — fallback to targetCenter.
    expect(targets[0]).toEqual({ x: 1, y: 1 });
  });

  it('handles a single-unit group correctly (returns one target)', () => {
    const occupancy = createWorldOccupancy(16, 16);

    const targets = occupancy.allocateGroupMoveTargets([777], { x: 5, y: 5 });

    expect(targets).toEqual([{ x: 5, y: 5 }]);
  });
});
