import {
  MAP_HEIGHT,
  MAP_WIDTH,
  createTerrainCell,
  setTerrainKind,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

export function createConquestVictoryFixture(seed: string): PrototypeScenario {
  const terrain = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      { owner: 1, townCenter: { x: 4, y: 8 } },
      { owner: 2, townCenter: { x: 10, y: 8 } },
    ],
    spawns: [
      ownedSpawn('militia', 1, 8, 8, { vision: 6 }),
      ownedSpawn('house', 2, 10, 8, { vision: 4 }),
    ],
  };
}

export function createConquestDefeatFixture(seed: string): PrototypeScenario {
  const terrain = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      { owner: 2, townCenter: { x: 14, y: 8 } },
    ],
    spawns: [
      ownedSpawn('house', 1, 8, 8, { vision: 6 }),
      ownedSpawn('militia', 2, 11, 8, { vision: 5 }),
    ],
  };
}

export function createBlockingRulesFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  setTerrainKind(terrain, 8, 13, 'water');
  setTerrainKind(terrain, 10, 5, 'forest');

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
          food: 200,
          wood: 400,
          gold: 200,
          stone: 200,
        },
      },
      { owner: 2, townCenter: { x: 28, y: 16 } },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 28, 16, { vision: 7 }),
      // Slice 12 Task B: deliberate overlap — the
      // `rejects house placement on blocked terrain, resources,
      // buildings, and units` core test expects this villager at
      // (6, 8) which sits inside the TC footprint (4..7, 8..11) so
      // a placement preview at (6, 8) is rejected for a
      // unit-occupied cell. Opt out of the fixture validator.
      ownedSpawn('villager', 1, 6, 8, { vision: 5, allowOverlappingSpawn: true }),
      ownedSpawn('scout', 1, 6, 13, { vision: 6 }),
      ownedSpawn('villager', 1, 7, 13, { vision: 5 }),
      gaiaSpawn('tree', 10, 5, { baseOwner: 1, amount: 100 }),
      gaiaSpawn('gold-mine', 12, 5, { baseOwner: 1, amount: 800 }),
      gaiaSpawn('stone-mine', 14, 5, { baseOwner: 1, amount: 350 }),
    ],
  };
}

export function createUnitSharingFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 28, y: 16 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 2, 2, { vision: 7 }),
      ownedSpawn('town-center', 2, 28, 16, { vision: 7 }),
      ownedSpawn('scout', 1, 6, 10, { vision: 6 }),
      ownedSpawn('villager', 1, 7, 10, { vision: 4 }),
    ],
  };
}

export function createOrdersFixture(seed: string): PrototypeScenario {
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
          stone: 100,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 8, { vision: 4 }),
      ownedSpawn('scout', 1, 7, 12, { vision: 6 }),
      gaiaSpawn('sheep', 12, 9, { baseOwner: 1, amount: 100 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}
