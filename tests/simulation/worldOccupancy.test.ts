import { describe, expect, it } from 'vitest';

import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';

describe('createWorldOccupancy', () => {
  it('tracks terrain, building, and resource blockers while keeping unit crowding separate', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.blockTerrain([{ x: 0, y: 0 }]);
    occupancy.syncBuilding(101, { x: 2, y: 2 }, { width: 2, height: 2 });
    occupancy.syncResource(202, { x: 5, y: 5 });
    occupancy.syncUnit(303, { x: 4, y: 4 });

    expect(occupancy.isCellPassableForSpawn(0, 0)).toBe(false);
    expect(occupancy.isCellBlockedByBuilding(2, 2)).toBe(true);
    expect(occupancy.isCellBlockedByResource(5, 5)).toBe(true);
    expect(occupancy.isCellOccupiedByUnit(4, 4)).toBe(true);
    expect(occupancy.isPlacementBlocked(0, 0, 1, 1)).toBe(true);

    // The live game still lets units share a coarse cell for movement, so
    // unit crowding must not become a hard path/spawn blocker.
    expect(occupancy.isCellPassableForSpawn(4, 4)).toBe(true);
    expect(occupancy.isPlacementBlocked(4, 4, 1, 1)).toBe(true);
  });

  it('keeps overlapping whole-cell blockers queryable through the overflow fallback', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.syncBuilding(101, { x: 3, y: 3 }, { width: 1, height: 1 });
    occupancy.syncResource(202, { x: 3, y: 3 });

    expect(occupancy.isCellBlockedByBuilding(3, 3)).toBe(true);
    expect(occupancy.isCellBlockedByResource(3, 3)).toBe(true);
    expect(occupancy.isCellPassableForSpawn(3, 3)).toBe(false);
    expect(occupancy.isPlacementBlocked(3, 3, 1, 1)).toBe(true);
  });

  it('releases every cell in a multi-cell building footprint', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.syncBuilding(101, { x: 2, y: 2 }, { width: 2, height: 2 });

    occupancy.release(101);

    expect(occupancy.isCellBlockedByBuilding(2, 2)).toBe(false);
    expect(occupancy.isCellBlockedByBuilding(3, 2)).toBe(false);
    expect(occupancy.isCellBlockedByBuilding(2, 3)).toBe(false);
    expect(occupancy.isCellBlockedByBuilding(3, 3)).toBe(false);
  });

  it('lets wildlife ignore its own resource blocker while still respecting other blockers', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.syncResource(101, { x: 4, y: 4 });
    occupancy.syncResource(202, { x: 5, y: 5 });
    occupancy.syncBuilding(303, { x: 6, y: 6 }, { width: 1, height: 1 });

    expect(occupancy.isCellPassableForWildlife(101, 4, 4)).toBe(true);
    expect(occupancy.isCellPassableForWildlife(101, 5, 5)).toBe(false);
    expect(occupancy.isCellPassableForWildlife(101, 6, 6)).toBe(false);
    occupancy.blockTerrain([{ x: 1, y: 1 }]);
    expect(occupancy.isCellPassableForWildlife(101, 1, 1)).toBe(false);
  });

  it('releases unit crowding when the unit leaves the world cell', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.syncUnit(303, { x: 4, y: 4 });

    expect(occupancy.isCellOccupiedByUnit(4, 4)).toBe(true);
    expect(occupancy.isPlacementBlocked(4, 4, 1, 1)).toBe(true);

    occupancy.release(303);

    expect(occupancy.isCellOccupiedByUnit(4, 4)).toBe(false);
    expect(occupancy.isPlacementBlocked(4, 4, 1, 1)).toBe(false);
    expect(occupancy.isCellPassableForSpawn(4, 4)).toBe(true);

    occupancy.syncUnit(303, { x: 4, y: 4 });
    expect(occupancy.isCellOccupiedByUnit(4, 4, 303)).toBe(false);
  });

  it('clears occupancy on reset and treats out-of-bounds cells as blocked', () => {
    const occupancy = createWorldOccupancy(8, 8);

    occupancy.blockTerrain([{ x: 0, y: 0 }]);
    occupancy.syncBuilding(101, { x: 2, y: 2 }, { width: 1, height: 1 });
    occupancy.syncResource(202, { x: 3, y: 3 });
    occupancy.syncUnit(303, { x: 4, y: 4 });

    expect(occupancy.isCellPassableForSpawn(-1, 0)).toBe(false);
    expect(occupancy.isPlacementBlocked(8, 8, 1, 1)).toBe(true);

    occupancy.reset();

    expect(occupancy.isCellPassableForSpawn(0, 0)).toBe(true);
    expect(occupancy.isCellBlockedByBuilding(2, 2)).toBe(false);
    expect(occupancy.isCellBlockedByResource(3, 3)).toBe(false);
    expect(occupancy.isCellOccupiedByUnit(4, 4)).toBe(false);
    expect(occupancy.isPlacementBlocked(4, 4, 1, 1)).toBe(false);
  });
});
