import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../common';

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
