// The occupancy claim of a foundation nobody has started building (work 126;
// spec §8.1, §12.3; passableStructures.ts).
//
// Definitive Edition update 185872: "Fixed a bug preventing Villagers from
// walking over unbuilt Foundations" and "Fixed a bug causing unbuilt building
// Foundations to prevent players from building upon them". So until its first
// build progress a foundation claims its cells as a 'foundation': every unit
// walks and spawns on them in a real sub-cell slot, animals walk over them too
// (in DE a sheep is a unit; the coordinator's decision of review round 0), and
// placement still counts the claim unless the asker says the claim stands
// aside for it (an enemy's, foundationClaims.ts). From the first build
// progress the claim is the building's own: a wall, or a Farm's walkable plot.
//
// BOUND: the occupancy and the claim-kind rule on a hand-built 8x8 grid. The
// bridge's wiring of the rule into movement, placement and the start is
// unbuiltFoundationCrossing, -Placement and foundationStart*.test.ts.

import { describe, expect, it } from 'vitest';

import { structureClaimKind } from '../../src/game/simulation/passableStructures';
import { createWorldOccupancy } from '../../src/game/simulation/worldOccupancy';
import type { BuildingType } from '../../src/game/simulation/types';

describe('an unstarted foundation claims open ground (work 126)', () => {
  it('admits and slots every unit, admits animals, and still counts for placement', () => {
    const occupancy = createWorldOccupancy(8, 8);
    const revisionBefore = occupancy.structuralRevision();
    occupancy.syncBuilding(101, { x: 3, y: 3 }, { width: 2, height: 2 }, 'foundation');
    expect(occupancy.structuralRevision(), 'a foundation is structural: caches must invalidate').not.toBe(revisionBefore);

    expect(occupancy.getCellStatus(3, 3).blockedBy.map((claim) => claim.kind)).toEqual(['foundation']);
    // Units walk and spawn on it, in a real slot rather than as overflow.
    expect(occupancy.isCellPassableForSpawn(3, 3)).toBe(true);
    expect(occupancy.isCellBlockedByBuilding(4, 4), 'a ship would take it for a building').toBe(false);
    const placed = occupancy.placeUnitForSpawn(303, { x: 4, y: 4 });
    expect(placed?.placedAt).toEqual({ x: 4, y: 4 });
    expect(placed?.slotOffset, 'the unit stands on it in overflow').not.toBeNull();
    expect(occupancy.findNearestFreeUnitCell(404, { x: 3, y: 3 })).toEqual({ x: 3, y: 3 });
    // Animals walk over it as units do; a started building walls them out
    // (the case below).
    expect(occupancy.isCellPassableForWildlife(202, 3, 3), 'an animal keeps off an unstarted foundation').toBe(true);
    // Placement counts it unless told it stands aside.
    expect(occupancy.isPlacementBlocked(3, 3, 1, 1)).toBe(true);
    expect(occupancy.isPlacementBlocked(3, 3, 1, 1, (claim) => claim.entity === 101)).toBe(false);
    expect(occupancy.isPlacementBlocked(4, 4, 1, 1, (claim) => claim.entity === 101),
      'a unit standing there still refuses the footprint').toBe(true);
  });

  it('becomes a wall when re-claimed as a started building', () => {
    const occupancy = createWorldOccupancy(8, 8);
    occupancy.syncBuilding(101, { x: 3, y: 3 }, { width: 2, height: 2 }, 'foundation');
    const before = occupancy.structuralRevision();
    occupancy.syncBuilding(101, { x: 3, y: 3 }, { width: 2, height: 2 }, 'building');
    expect(occupancy.structuralRevision()).not.toBe(before);
    expect(occupancy.isCellPassableForSpawn(3, 3)).toBe(false);
    expect(occupancy.isCellBlockedByBuilding(3, 3)).toBe(true);
    expect(occupancy.isCellPassableForWildlife(202, 3, 3), 'the control: an animal crosses a started building').toBe(false);
    expect(occupancy.placeUnitForSpawn(303, { x: 4, y: 4 })?.placedAt).not.toEqual({ x: 4, y: 4 });
  });

  it('the claim kind follows the build: a Farm is always a plot, anything else a foundation until started', () => {
    const types: BuildingType[] = ['house', 'barracks', 'town-center', 'palisade-wall', 'palisade-gate', 'fish-trap', 'dock'];
    for (const type of types) {
      expect(structureClaimKind(type, false), `${type} unstarted`).toBe('foundation');
      expect(structureClaimKind(type, true), `${type} started`).toBe('building');
    }
    expect(structureClaimKind('farm', false)).toBe('farm');
    expect(structureClaimKind('farm', true)).toBe('farm');
  });
});
