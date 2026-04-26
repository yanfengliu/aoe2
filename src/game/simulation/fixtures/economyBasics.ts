import {
  MAP_HEIGHT,
  MAP_WIDTH,
  SHORE_FISH_AMOUNT,
  setTerrainKind,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

export function createMiningCampFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 200,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
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
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'gold-mine',
        x: 13,
        y: 7,
        owner: null,
        baseOwner: 1,
        amount: 800,
      },
      {
        kind: 'gold-mine',
        x: 14,
        y: 7,
        owner: null,
        baseOwner: 1,
        amount: 800,
      },
      {
        kind: 'gold-mine',
        x: 13,
        y: 8,
        owner: null,
        baseOwner: 1,
        amount: 800,
      },
      {
        kind: 'gold-mine',
        x: 14,
        y: 8,
        owner: null,
        baseOwner: 1,
        amount: 800,
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

// Iter-2 H2-2 regression: player 1 has a villager + a tree, but the
// only owned building is a Mill (food drop-off only). The villager
// fills its carry from the tree and the to-dropoff branch finds no
// owned wood drop-off building. Without the fix, the gather-system
// silently zeroes the load every tick. With the fix, the load
// persists until a wood drop-off becomes reachable.
export function createVillagerNoWoodDropoffFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 200,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        // Disable the AI planner for player 2 so it doesn't train its
        // own villagers and steal-gather from player 1's lone tree
        // (which would corrupt this regression test's measurements).
        disableAi: true,
      },
    ],
    spawns: [
      // Player 1's only owned building is a Mill — accepts food only,
      // not wood. Intentionally NO Town Center and NO Lumber Camp.
      {
        kind: 'mill',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'tree',
        x: 13,
        y: 8,
        owner: null,
        baseOwner: 1,
        amount: 200,
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

export function createFishFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 7; y <= 9; y += 1) {
    for (let x = 11; x <= 13; x += 1) {
      setTerrainKind(terrain, x, y, 'water');
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 8 },
        startingResources: {
          food: 0,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 9,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'fish',
        x: 11,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: SHORE_FISH_AMOUNT,
      },
      {
        kind: 'house',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Iter-3 V3-1 + V3-2 regression: human scout positioned so its vision
// radius 4 reaches one non-anchor cell of an enemy 4x4 castle, while the
// castle's anchor sits outside vision. Used to lock the contract that
// fog-memory refresh and click-selection hit-test both treat the castle
// as visible (footprint visibility, matching createProjector and the
// iter-2 M2-1 fix in target finding).
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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        // Human scout positioned so its radius-4 vision sees ONLY the
        // (18, 16) corner cell of the enemy castle below — the (15, 13)
        // anchor at distance 5+3=8 is outside vision; (18, 16) at
        // distance 2+0=2 is comfortably inside.
        kind: 'scout',
        x: 20,
        y: 16,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'castle',
        x: 15,
        y: 13,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 50,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'tree',
        x: 12,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 1,
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
      {
        kind: 'town-center',
        x: 2,
        y: 2,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 54,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // North wall of the narrow corridor.
      ...Array.from({ length: 17 }, (_, offset) => ({
        kind: 'tree' as const,
        x: 12 + offset,
        y: 7,
        owner: null,
        baseOwner: null,
        amount: 100,
      })),
      // South wall of the narrow corridor.
      ...Array.from({ length: 17 }, (_, offset) => ({
        kind: 'tree' as const,
        x: 12 + offset,
        y: 9,
        owner: null,
        baseOwner: null,
        amount: 100,
      })),
      // Cluster of four friendly villagers just west of the corridor mouth.
      // The villager at (11, 8) is the designated mover; the other three
      // surround it and sit directly in front of the corridor entrance.
      {
        kind: 'villager',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 11,
        y: 7,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 11,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
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
      {
        kind: 'town-center',
        x: 2,
        y: 2,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 17,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'tree',
        x: 18,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 1,
      },
      {
        kind: 'town-center',
        x: 36,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createFogMemoryFixture(seed: string): PrototypeScenario {
  // Layout: human scout at (10, 10) with vision radius 4, enemy house at (14, 10)
  // placed two tiles outside the human TC's footprint vision (TC radius 7 around
  // (4, 4) so its view ends at (11, 11)). Initially the enemy house is visible to
  // the scout (distance 4). Once the scout walks back to (4, 4), the house cell
  // (14, 10) is outside both the TC's and scout's vision, so it should become
  // explored-but-not-visible — the exact condition fog memory tests.
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
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'scout',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'house',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
      },
      {
        // A resource patch at a cell that starts outside human vision. The test
        // can use a human unit's vision to reveal it, then leave to observe
        // memory behavior.
        kind: 'gold-mine',
        x: 14,
        y: 12,
        owner: null,
        baseOwner: null,
        amount: 500,
      },
      {
        // A wandering boar that is currently inside the scout's radius-4 vision
        // (distance 3.16 from (10, 10)) and outside the human TC's radius-7 vision
        // (distance >11). Used to assert that wildlife is NOT memorized when it
        // exits vision — its position would otherwise go stale immediately because
        // it walks around.
        kind: 'boar',
        x: 13,
        y: 11,
        owner: null,
        baseOwner: null,
        amount: 340,
      },
      {
        kind: 'town-center',
        x: 50,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

export function createBuildingFootprintVisionFixture(seed: string): PrototypeScenario {
  // Layout designed so that an enemy 4x4 Town Center has only a single corner
  // cell inside the human player's vision. The human TC sits at (1, 1) with a
  // small radius-1 vision, and the human scout sits at (17, 13) — one cell
  // east of the enemy TC's bottom-right corner. The enemy TC anchor is at
  // (13, 10), so its footprint covers (13..16, 10..13).
  //
  // Slice 12 Task B moved the scout out of the building footprint: the
  // previous (16, 13) slot was itself inside the enemy TC's footprint,
  // which the fixture-validation pass rightly rejects. The new (17, 13)
  // position keeps the single-corner visibility test intact — the scout's
  // radius-1 vision still covers exactly one TC cell (16, 13) — while
  // leaving every other footprint cell hidden.
  //
  // From the scout at (17, 13), the only TC cell within radius 1 is
  // (16, 13), the bottom-right corner. (15, 13) is distance 2, outside
  // radius 1; (16, 12) is distance √2 which is also outside radius 1 in
  // the `VisibilityMap`'s square-grid cell semantics. The projector's
  // footprint-aware check sees that one visible cell and renders the TC
  // as live; a top-left -only check would miss it and treat the TC as
  // hidden.
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 1, y: 1 },
      },
      {
        owner: 2,
        townCenter: { x: 13, y: 10 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 1,
        y: 1,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 1 },
      },
      {
        kind: 'scout',
        x: 17,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 1 },
      },
      {
        kind: 'town-center',
        x: 13,
        y: 10,
        owner: 2,
        baseOwner: 2,
      },
    ],
  };
}

export function createBoarAggroFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 28, y: 16 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'boar',
        x: 13,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 340,
      },
      {
        kind: 'house',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

export function createWolfAggroFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 28, y: 16 },
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'wolf',
        x: 13,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'house',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}
