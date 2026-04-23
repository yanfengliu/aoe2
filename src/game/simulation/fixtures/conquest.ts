import {
  MAP_HEIGHT,
  MAP_WIDTH,
  createTerrainCell,
  setTerrainKind,
  type PrototypeScenario,
} from '../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from './common';

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
      {
        kind: 'militia',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'house',
        x: 10,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
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
      {
        kind: 'house',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'militia',
        x: 11,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
      },
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
      {
        kind: 'town-center',
        x: 4,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        // Slice 12 Task B: deliberate overlap — the
        // `rejects house placement on blocked terrain, resources,
        // buildings, and units` core test expects this villager at
        // (6, 8) which sits inside the TC footprint (4..7, 8..11) so
        // a placement preview at (6, 8) is rejected for a
        // unit-occupied cell. Opt out of the fixture validator.
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
        allowOverlappingSpawn: true,
      },
      {
        kind: 'scout',
        x: 6,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'tree',
        x: 10,
        y: 5,
        owner: null,
        baseOwner: 1,
        amount: 100,
      },
      {
        kind: 'gold-mine',
        x: 12,
        y: 5,
        owner: null,
        baseOwner: 1,
        amount: 800,
      },
      {
        kind: 'stone-mine',
        x: 14,
        y: 5,
        owner: null,
        baseOwner: 1,
        amount: 350,
      },
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
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'scout',
        x: 6,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
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
        kind: 'scout',
        x: 7,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'sheep',
        x: 12,
        y: 9,
        owner: null,
        baseOwner: 1,
        amount: 100,
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
