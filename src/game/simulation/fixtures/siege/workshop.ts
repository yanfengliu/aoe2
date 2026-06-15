import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

// Slice 4 fixture: Castle-Age human with a completed Siege Workshop, used to
// assert that the Siege Workshop train menu offers Mangonel / Scorpion /
// Battering Ram and that the producer flow works end-to-end.
export function createSiegeWorkshopFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'castle-age',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'siege-workshop',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 6,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Watch Tower with both an enemy Mangonel
// and an enemy Militia inside its attack range. Used to assert siege is the
// highest-priority target for defensive buildings (the tower must fire on
// the Mangonel first, not the closer Militia).
export function createTowerVsSiegePriorityFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'feudal-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        // Slice 12 moved this off (10,10) (inside the TC footprint at
        // 8..11, 8..11). Now at (12,19): still within tower range 7 of both
        // enemy units below (priority test unchanged), and clear of the human
        // TC's range so the empty-TC base arrow (spec §10.8) doesn't confound it.
        kind: 'watch-tower',
        x: 12,
        y: 19,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 8 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Both enemies sit inside the tower's range 7. Militia is CLOSER than
      // the Mangonel (dist 3 vs dist 4 after the tower move) — before the
      // priority fix the tower fell back on proximity and killed the Militia
      // first. The fix must make the Mangonel the preferred target regardless
      // of proximity.
      {
        kind: 'militia',
        x: 15,
        y: 19,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'mangonel',
        x: 16,
        y: 19,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 9 },
      },
    ],
  };
}
