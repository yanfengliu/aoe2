import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { FIXTURE_MIXED_SELECTION_HOUSE_POSITION, FIXTURE_MIXED_SELECTION_UNITS, FIXTURE_STACK_POSITION, FIXTURE_VILLAGER_CLUSTER, createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

export function createTownCenterDefenseFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      ownedSpawn('scout', 2, 12, 8, { vision: 6 }),
    ],
  };
}

export function createVillagerSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[0].x, FIXTURE_VILLAGER_CLUSTER[0].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[1].x, FIXTURE_VILLAGER_CLUSTER[1].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[2].x, FIXTURE_VILLAGER_CLUSTER[2].y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createDoubleClickSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[0].x, FIXTURE_VILLAGER_CLUSTER[0].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[1].x, FIXTURE_VILLAGER_CLUSTER[1].y, {
        vision: 4,
      }),
      ownedSpawn('villager', 1, FIXTURE_VILLAGER_CLUSTER[2].x, FIXTURE_VILLAGER_CLUSTER[2].y, {
        vision: 4,
      }),
      ownedSpawn('scout', 1, 9, 12, { vision: 6 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createMixedSelectionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('house', 1, FIXTURE_MIXED_SELECTION_HOUSE_POSITION.x, FIXTURE_MIXED_SELECTION_HOUSE_POSITION.y),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[0].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[0].x, FIXTURE_MIXED_SELECTION_UNITS[0].y, {
        vision: 4,
      }),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[1].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[1].x, FIXTURE_MIXED_SELECTION_UNITS[1].y, {
        vision: 5,
      }),
      ownedSpawn(FIXTURE_MIXED_SELECTION_UNITS[2].kind, 1, FIXTURE_MIXED_SELECTION_UNITS[2].x, FIXTURE_MIXED_SELECTION_UNITS[2].y, {
        vision: 6,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createTileSelectionCycleFixture(seed: string): PrototypeScenario {
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
      // Slice 12 Task B: deliberate overlap — the UX test needs a
      // house + militia + sheep stacked on one cell so the tile-
      // selection-cycle can iterate through all three. Opt out of
      // the fixture validator via `allowOverlappingSpawn` on each.
      ownedSpawn('house', 1, FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        allowOverlappingSpawn: true,
      }),
      ownedSpawn('militia', 1, FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        vision: 5,
        allowOverlappingSpawn: true,
      }),
      gaiaSpawn('sheep', FIXTURE_STACK_POSITION.x, FIXTURE_STACK_POSITION.y, {
        baseOwner: 1,
        amount: 100,
        allowOverlappingSpawn: true,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}
