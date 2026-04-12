import {
  createNoise2D,
  octaveNoise2D,
  type Position,
} from 'civ-engine';

import type {
  AgeType,
  BuildingType,
  PlayerResources,
  ResourceKind,
  TerrainComponent,
  TerrainKind,
  UnitType,
  VisionSourceComponent,
  WanderBoundsComponent,
} from './types';

export const MAP_WIDTH = 36;
export const MAP_HEIGHT = 24;
export const TPS = 10;
export const DEFAULT_SEED = 'aoe2-prototype';
export const HUMAN_PLAYER_ID = 1;

export interface TerrainCellSpec extends TerrainComponent {
  x: number;
  y: number;
}

export interface ScenarioSpawnSpec {
  kind:
    | BuildingType
    | UnitType
    | ResourceKind;
  x: number;
  y: number;
  owner: number | null;
  baseOwner: number | null;
  amount?: number;
  velocity?: { dx: number; dy: number };
  wanderBounds?: WanderBoundsComponent;
  vision?: VisionSourceComponent;
}

export interface PlayerStartSpec {
  owner: number;
  townCenter: Position;
  startingAge?: AgeType;
  startingResources?: PlayerResources;
}

export interface PrototypeScenario {
  seed: string;
  width: number;
  height: number;
  terrain: TerrainCellSpec[][];
  starts: PlayerStartSpec[];
  spawns: ScenarioSpawnSpec[];
}

interface Offset {
  x: number;
  y: number;
}

const STARTING_VILLAGERS: Offset[] = [
  { x: -2, y: 0 },
  { x: -2, y: 1 },
  { x: -1, y: 1 },
];

const STARTING_SHEEP: Offset[] = [
  { x: 2, y: 2 },
  { x: 3, y: 2 },
  { x: 2, y: 3 },
  { x: 3, y: 3 },
];

const STARTING_BOARS: Offset[] = [
  { x: -4, y: -4 },
  { x: 4, y: -5 },
];

const STARTING_BERRIES: Offset[] = [
  { x: -4, y: 1 },
  { x: -4, y: 2 },
  { x: -3, y: 2 },
  { x: -3, y: 3 },
  { x: -2, y: 2 },
  { x: -2, y: 3 },
];

const STARTING_GOLD: Offset[] = [
  { x: 5, y: -1 },
  { x: 6, y: -1 },
  { x: 5, y: 0 },
  { x: 6, y: 0 },
];

const STARTING_STONE: Offset[] = [
  { x: 0, y: 5 },
  { x: 1, y: 5 },
  { x: 0, y: 6 },
  { x: 1, y: 6 },
];

const FOREST_PATCHES: Offset[][] = [
  [
    { x: -6, y: -2 },
    { x: -6, y: -1 },
    { x: -6, y: 0 },
    { x: -5, y: -2 },
    { x: -5, y: -1 },
    { x: -5, y: 0 },
    { x: -4, y: -2 },
    { x: -4, y: -1 },
  ],
  [
    { x: 4, y: -4 },
    { x: 5, y: -4 },
    { x: 6, y: -4 },
    { x: 4, y: -3 },
    { x: 5, y: -3 },
    { x: 6, y: -3 },
    { x: 5, y: -2 },
    { x: 6, y: -2 },
  ],
  [
    { x: -2, y: 5 },
    { x: -1, y: 5 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
    { x: -2, y: 6 },
    { x: -1, y: 6 },
    { x: 0, y: 6 },
    { x: 1, y: 6 },
  ],
];

const FORWARD_ENEMY_SCOUT_POSITION = { x: 13, y: 5 };
const FORWARD_ENEMY_HOUSE_POSITION = { x: 12, y: 3 };

function createConquestVictoryFixture(seed: string): PrototypeScenario {
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

function createConquestDefeatFixture(seed: string): PrototypeScenario {
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

function createGrassFixtureTerrain(): TerrainCellSpec[][] {
  return Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );
}

function createFeudalMissingPrereqFixture(seed: string): PrototypeScenario {
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
          food: 700,
          wood: 375,
          gold: 200,
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
        kind: 'mill',
        x: 5,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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

function createFeudalAgeFixture(seed: string): PrototypeScenario {
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
          food: 700,
          wood: 375,
          gold: 200,
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
        kind: 'mill',
        x: 5,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'barracks',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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

function createFeudalBlacksmithFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 250,
          wood: 250,
          gold: 250,
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
        kind: 'archery-range',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'villager',
        x: 8,
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

function createFeudalStableFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 250,
          wood: 250,
          gold: 150,
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
        kind: 'barracks',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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

function createCastleAgeFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 1000,
          wood: 300,
          gold: 400,
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
        kind: 'blacksmith',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'stable',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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

function createCastleTownCenterFixture(seed: string): PrototypeScenario {
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
          food: 200,
          wood: 700,
          gold: 100,
          stone: 350,
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
        x: 8,
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

function createFeudalSpearmanFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 250,
          wood: 150,
          gold: 150,
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
        kind: 'barracks',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'scout',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
    ],
  };
}

function createFeudalSkirmisherFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 250,
          wood: 250,
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
        kind: 'archery-range',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'archer',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
    ],
  };
}

function createFeudalWatchTowerFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 200,
          wood: 150,
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
        kind: 'barracks',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 11,
        y: 11,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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
      {
        kind: 'scout',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
    ],
  };
}

function createFeudalMarketFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 700,
          wood: 450,
          gold: 200,
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
        kind: 'barracks',
        x: 11,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
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

function createTownCenterDefenseFixture(seed: string): PrototypeScenario {
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
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'scout',
        x: 12,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
    ],
  };
}

function createVillagerSelectionFixture(seed: string): PrototypeScenario {
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
        x: 8,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 9,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 10,
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

function createDoubleClickSelectionFixture(seed: string): PrototypeScenario {
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
        x: 8,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 9,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'scout',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
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

function createMixedSelectionFixture(seed: string): PrototypeScenario {
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
        kind: 'house',
        x: 9,
        y: 9,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 8,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'militia',
        x: 9,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'scout',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
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

function createTileSelectionCycleFixture(seed: string): PrototypeScenario {
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
        kind: 'house',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'sheep',
        x: 10,
        y: 10,
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

function seedToNumber(seed: string): number {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash || 1;
}

function createTerrainCell(x: number, y: number, kind: TerrainKind): TerrainCellSpec {
  return {
    x,
    y,
    kind,
    buildable: kind !== 'water' && kind !== 'forest',
    elevation: kind === 'hill' ? 1 : 0,
  };
}

function isInBounds(x: number, y: number): boolean {
  return x >= 0 && x < MAP_WIDTH && y >= 0 && y < MAP_HEIGHT;
}

function setTerrainKind(
  terrain: TerrainCellSpec[][],
  x: number,
  y: number,
  kind: TerrainKind,
): void {
  if (!isInBounds(x, y)) {
    return;
  }
  terrain[y][x] = createTerrainCell(x, y, kind);
}

function paintDisc(
  terrain: TerrainCellSpec[][],
  center: Position,
  radius: number,
  kind: TerrainKind,
): void {
  const radiusSq = radius * radius;

  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (!isInBounds(x, y)) {
        continue;
      }

      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= radiusSq) {
        setTerrainKind(terrain, x, y, kind);
      }
    }
  }
}

function orientationFor(center: Position): { x: 1 | -1; y: 1 | -1 } {
  return {
    x: center.x < MAP_WIDTH / 2 ? 1 : -1,
    y: center.y < MAP_HEIGHT / 2 ? 1 : -1,
  };
}

function projectOffset(center: Position, offset: Offset): Position {
  const orientation = orientationFor(center);
  return {
    x: center.x + offset.x * orientation.x,
    y: center.y + offset.y * orientation.y,
  };
}

function createBaseTerrain(seed: string): TerrainCellSpec[][] {
  const noise2d = createNoise2D(seedToNumber(seed));
  const terrain: TerrainCellSpec[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    const row: TerrainCellSpec[] = [];
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const noise = octaveNoise2D(noise2d, x * 0.12, y * 0.12, 3);
      const kind =
        noise < -0.28
          ? 'water'
          : noise > 0.42
            ? 'forest'
            : noise > 0.18
              ? 'hill'
              : 'grass';
      row.push(createTerrainCell(x, y, kind));
    }
    terrain.push(row);
  }

  return terrain;
}

function createPlayerStarts(): PlayerStartSpec[] {
  return [
    { owner: 1, townCenter: { x: 8, y: 8 } },
    { owner: 2, townCenter: { x: 27, y: 15 } },
  ];
}

function applyResourcePatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  kind: ResourceKind,
  amount: number,
  baseOwner: number,
  spawns: ScenarioSpawnSpec[],
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    if (!isInBounds(position.x, position.y)) {
      continue;
    }

    setTerrainKind(terrain, position.x, position.y, 'grass');
    spawns.push({
      kind,
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount,
    });
  }
}

function applyForestPatch(
  terrain: TerrainCellSpec[][],
  center: Position,
  offsets: Offset[],
  baseOwner: number,
  spawns: ScenarioSpawnSpec[],
): void {
  for (const offset of offsets) {
    const position = projectOffset(center, offset);
    setTerrainKind(terrain, position.x, position.y, 'forest');
    if (!isInBounds(position.x, position.y)) {
      continue;
    }
    spawns.push({
      kind: 'tree',
      x: position.x,
      y: position.y,
      owner: null,
      baseOwner,
      amount: 100,
    });
  }
}

export function createPrototypeScenario(seed = DEFAULT_SEED): PrototypeScenario {
  if (seed === 'conquest-victory-fixture') {
    return createConquestVictoryFixture(seed);
  }

  if (seed === 'conquest-defeat-fixture') {
    return createConquestDefeatFixture(seed);
  }

  if (seed === 'feudal-missing-prereq-fixture') {
    return createFeudalMissingPrereqFixture(seed);
  }

  if (seed === 'feudal-age-fixture') {
    return createFeudalAgeFixture(seed);
  }

  if (seed === 'feudal-blacksmith-fixture') {
    return createFeudalBlacksmithFixture(seed);
  }

  if (seed === 'feudal-stable-fixture') {
    return createFeudalStableFixture(seed);
  }

  if (seed === 'castle-age-fixture') {
    return createCastleAgeFixture(seed);
  }

  if (seed === 'castle-town-center-fixture') {
    return createCastleTownCenterFixture(seed);
  }

  if (seed === 'feudal-spearman-fixture') {
    return createFeudalSpearmanFixture(seed);
  }

  if (seed === 'feudal-skirmisher-fixture') {
    return createFeudalSkirmisherFixture(seed);
  }

  if (seed === 'feudal-watch-tower-fixture') {
    return createFeudalWatchTowerFixture(seed);
  }

  if (seed === 'feudal-market-fixture') {
    return createFeudalMarketFixture(seed);
  }

  if (seed === 'town-center-defense-fixture') {
    return createTownCenterDefenseFixture(seed);
  }

  if (seed === 'villager-selection-fixture') {
    return createVillagerSelectionFixture(seed);
  }

  if (seed === 'double-click-selection-fixture') {
    return createDoubleClickSelectionFixture(seed);
  }

  if (seed === 'mixed-selection-fixture') {
    return createMixedSelectionFixture(seed);
  }

  if (seed === 'tile-selection-cycle-fixture') {
    return createTileSelectionCycleFixture(seed);
  }

  const terrain = createBaseTerrain(seed);
  const starts = createPlayerStarts();
  const spawns: ScenarioSpawnSpec[] = [];

  for (const start of starts) {
    paintDisc(terrain, start.townCenter, 4, 'grass');

    spawns.push({
      kind: 'town-center',
      x: start.townCenter.x,
      y: start.townCenter.y,
      owner: start.owner,
      baseOwner: start.owner,
      vision: { playerId: start.owner, radius: 7 },
    });

    for (const offset of STARTING_VILLAGERS) {
      const position = projectOffset(start.townCenter, offset);
      spawns.push({
        kind: 'villager',
        x: position.x,
        y: position.y,
        owner: start.owner,
        baseOwner: start.owner,
        vision: { playerId: start.owner, radius: 4 },
      });
    }

    const orientation = orientationFor(start.townCenter);
    const scoutPosition = projectOffset(start.townCenter, { x: 2, y: -1 });
    spawns.push({
      kind: 'scout',
      x: scoutPosition.x,
      y: scoutPosition.y,
      owner: start.owner,
      baseOwner: start.owner,
      velocity: { dx: orientation.x, dy: 0 },
      wanderBounds: {
        minX: Math.max(0, start.townCenter.x - 5),
        maxX: Math.min(MAP_WIDTH - 1, start.townCenter.x + 6),
        minY: Math.max(0, start.townCenter.y - 4),
        maxY: Math.min(MAP_HEIGHT - 1, start.townCenter.y + 4),
      },
      vision: { playerId: start.owner, radius: 6 },
    });

    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_SHEEP,
      'sheep',
      100,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_BOARS,
      'boar',
      340,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_BERRIES,
      'berry-bush',
      125,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_GOLD,
      'gold-mine',
      800,
      start.owner,
      spawns,
    );
    applyResourcePatch(
      terrain,
      start.townCenter,
      STARTING_STONE,
      'stone-mine',
      350,
      start.owner,
      spawns,
    );

    for (const patch of FOREST_PATCHES) {
      applyForestPatch(terrain, start.townCenter, patch, start.owner, spawns);
    }
  }

  paintDisc(terrain, FORWARD_ENEMY_SCOUT_POSITION, 1, 'grass');
  paintDisc(terrain, FORWARD_ENEMY_HOUSE_POSITION, 2, 'grass');
  spawns.push({
    kind: 'house',
    x: FORWARD_ENEMY_HOUSE_POSITION.x,
    y: FORWARD_ENEMY_HOUSE_POSITION.y,
    owner: 2,
    baseOwner: 2,
  });
  spawns.push({
    kind: 'scout',
    x: FORWARD_ENEMY_SCOUT_POSITION.x,
    y: FORWARD_ENEMY_SCOUT_POSITION.y,
    owner: 2,
    baseOwner: 2,
    vision: { playerId: 2, radius: 6 },
  });

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns,
  };
}
