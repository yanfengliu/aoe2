import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

export function createFogMemoryCastleEdgeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        // Disable AI for the test fixture so the player-2 AI doesn't
        // train units / explore and contaminate visibility on tick 0.
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      // Human scout positioned so its radius-4 vision sees ONLY the
      // (18, 16) corner cell of the enemy castle below — the (15, 13)
      // anchor at distance 5+3=8 is outside vision; (18, 16) at
      // distance 2+0=2 is comfortably inside.
      ownedSpawn('scout', 1, 20, 16, { vision: 4 }),
      ownedSpawn('castle', 2, 15, 13),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

// V4-3 fixture: extends the castle-edge setup with a low-HP castle and a
// player-1 Siege Ram positioned to one-shot it. After destruction, the only
// player-1 vision over the castle's old footprint is the scout's view of the
// (18, 16) corner cell — a NON-anchor cell. Locks the contract that
// fog-memory cleanup uses footprint visibility, not anchor-only.
export function createFogMemoryCastleDestroyEdgeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'imperial-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      // Same scout placement as fog-memory-castle-edge-fixture: radius-4
      // vision from (20, 16) covers (18, 16) — a non-anchor cell of the
      // castle at (15, 13) — but does not reach the (15, 13) anchor.
      ownedSpawn('scout', 1, 20, 16, { vision: 4 }),
      // Siege Ram south of the castle, adjacent to the (16, 16) edge cell.
      // Vision radius 1 keeps the castle anchor (15, 13) outside the ram's
      // own LOS so destroying the castle does not silently grant the
      // player visibility on the anchor cell — the only post-destruction
      // visibility on the castle's footprint is the scout's (18, 16) view.
      ownedSpawn('siege-ram', 1, 16, 17, { vision: 1 }),
      // Castle at the same anchor as the existing edge fixture, low HP so
      // a single Siege Ram hit (3 base + 250 anti-building = 253) kills it.
      ownedSpawn('castle', 2, 15, 13, { startHp: 200 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
    ],
  };
}

export function createResourceDepletionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      gaiaSpawn('tree', 12, 8, { amount: 1 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createNarrowCorridorFixture(seed: string): PrototypeScenario {
  // Tree walls at y=7 and y=9 create a 1-cell-wide corridor along y=8 from
  // x=12 through x=28. West of the corridor (x<=11) is open grass with room
  // for a 2x2 cluster of villagers so the "units close to each other with a
  // narrow way forward" scenario reproduces exactly what the user reported.
  // East of x=28 is open grass so the mover has somewhere to land.
  const terrain = createGrassFixtureTerrain();
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      { owner: 1, townCenter: { x: 2, y: 2 } },
      { owner: 2, townCenter: { x: 54, y: 30 } },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 54, 30, { vision: 7 }),
      // North wall of the narrow corridor.
      ...Array.from({ length: 17 }, (_, offset) => (gaiaSpawn('tree' as const, 12 + offset, 7, { amount: 100 }))),
      // South wall of the narrow corridor.
      ...Array.from({ length: 17 }, (_, offset) => (gaiaSpawn('tree' as const, 12 + offset, 9, { amount: 100 }))),
      // Cluster of four friendly villagers just west of the corridor mouth.
      // The villager at (11, 8) is the designated mover; the other three
      // surround it and sit directly in front of the corridor entrance.
      ownedSpawn('villager', 1, 11, 8, { vision: 4 }),
      ownedSpawn('villager', 1, 10, 8, { vision: 4 }),
      ownedSpawn('villager', 1, 11, 7, { vision: 4 }),
      ownedSpawn('villager', 1, 11, 9, { vision: 4 }),
    ],
  };
}

export function createMoveTargetUnblocksFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 2, y: 2 },
      },
      {
        owner: 2,
        townCenter: { x: 36, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('villager', 1, 10, 8, { vision: 4 }),
      ownedSpawn('villager', 1, 17, 8, { vision: 4 }),
      gaiaSpawn('tree', 18, 8, { amount: 1 }),
      ownedSpawn('town-center', 2, 36, 8, { vision: 7 }),
    ],
  };
}

