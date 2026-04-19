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

export const MAP_WIDTH = 60;
export const MAP_HEIGHT = 36;
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
  requiresSafeSpawn?: boolean;
  // Building-only. Starts deposited relics inside a Monastery. Lets
  // tests exercise the "destroy the Monastery, drop the relics" flow
  // without driving a full pickup-and-deposit cycle.
  startingRelicsInMonastery?: number;
  // Building-only. Overrides the building's starting HP so tests can
  // make siege scenarios resolve in a handful of ticks. Ignored if
  // unset or larger than the building's default max HP.
  startHp?: number;
}

export interface PlayerStartSpec {
  owner: number;
  townCenter: Position;
  civilization?: string;
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
  { x: 4, y: 1 },
  { x: 5, y: 1 },
  { x: 4, y: 2 },
  { x: 5, y: 2 },
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
const SHORE_FISH_AMOUNT = 225;

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

const FORWARD_ENEMY_SCOUT_POSITION = { x: 41, y: 20 };
const FORWARD_ENEMY_HOUSE_POSITION = { x: 39, y: 18 };
// Slice 5: two neutral relics on the default map. Placed on the center line
// midway between the two player starts so both players have a roughly
// symmetric path to claim them. Positions avoid resource patches and the
// default forest strips.
const DEFAULT_RELIC_POSITIONS: Position[] = [
  { x: 24, y: 24 },
  { x: 36, y: 10 },
];
const FIXTURE_NEARBY_VILLAGER_POSITION = { x: 6, y: 10 };
const FIXTURE_PRIMARY_BUILDING_POSITION = { x: 13, y: 8 };
const FIXTURE_SECONDARY_BUILDING_POSITION = { x: 17, y: 8 };
const FIXTURE_STACK_POSITION = { x: 13, y: 12 };
const FIXTURE_VILLAGER_CLUSTER: Position[] = [
  { x: 5, y: 10 },
  { x: 6, y: 10 },
  { x: 7, y: 10 },
];
const FIXTURE_MIXED_SELECTION_HOUSE_POSITION = { x: 12, y: 12 };
const FIXTURE_MIXED_SELECTION_UNITS: Array<{
  kind: 'villager' | 'militia' | 'scout';
  x: number;
  y: number;
}> = [
  { kind: 'villager', x: 5, y: 10 },
  { kind: 'militia', x: 6, y: 10 },
  { kind: 'scout', x: 7, y: 10 },
];

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

function createBlockingRulesFixture(seed: string): PrototypeScenario {
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
        kind: 'villager',
        x: 6,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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

function createUnitSharingFixture(seed: string): PrototypeScenario {
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

function createMiningCampFixture(seed: string): PrototypeScenario {
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

function createFishFixture(seed: string): PrototypeScenario {
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

function createBoarAggroFixture(seed: string): PrototypeScenario {
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

function createWolfAggroFixture(seed: string): PrototypeScenario {
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

function createOrdersFixture(seed: string): PrototypeScenario {
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
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: FIXTURE_SECONDARY_BUILDING_POSITION.x,
        y: FIXTURE_SECONDARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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

function createBlockedStableSpawnFixture(seed: string): PrototypeScenario {
  const stableAnchor = { x: 12, y: 8 };
  const ringTreeSpawns: ScenarioSpawnSpec[] = [];

  for (let y = stableAnchor.y - 1; y <= stableAnchor.y + 3; y += 1) {
    for (let x = stableAnchor.x - 1; x <= stableAnchor.x + 3; x += 1) {
      const insideStable = x >= stableAnchor.x && x <= stableAnchor.x + 2
        && y >= stableAnchor.y && y <= stableAnchor.y + 2;
      if (insideStable) {
        continue;
      }

      ringTreeSpawns.push({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'feudal-age',
        startingResources: {
          food: 250,
          wood: 200,
          gold: 100,
          stone: 200,
        },
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
        kind: 'stable',
        x: stableAnchor.x,
        y: stableAnchor.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      ...ringTreeSpawns,
    ],
  };
}

function createIsolatedScoutSpawnFixture(seed: string): PrototypeScenario {
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
        kind: 'town-center',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'tree',
        x: 11,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 13,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 12,
        y: 9,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 12,
        y: 11,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'scout',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
        requiresSafeSpawn: true,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'stable',
        x: FIXTURE_SECONDARY_BUILDING_POSITION.x,
        y: FIXTURE_SECONDARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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

function createCastleUpgradesFixture(seed: string): PrototypeScenario {
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
          wood: 300,
          gold: 400,
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
        kind: 'archery-range',
        x: 12,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'barracks',
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'stable',
        x: 20,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'spearman',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'scout',
        x: 14,
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
        kind: 'archer',
        x: 22,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
      },
    ],
  };
}

// Slice 7A fixture: Castle-Age human with two Castle-Age-unlocked buildings
// (Monastery + Castle) already completed. Used to assert the Imperial Age
// research option appears at the Town Center and can be queued end-to-end
// so the player's age flips to 'imperial-age' on completion.
function createImperialAgeFixture(seed: string): PrototypeScenario {
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
        // Plenty of resources for the 1000 food / 800 gold Imperial Age cost
        // plus any follow-on training.
        startingResources: {
          food: 2000,
          wood: 600,
          gold: 1600,
          stone: 400,
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
        kind: 'monastery',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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

// Slice 7A fixture: Castle-Age human with zero Castle-Age-unlocked buildings.
// Imperial Age should be *visible* at the Town Center (it's the next age)
// but not *researchable* (prereq not met), mirroring the Feudal → Castle
// missing-prereq test.
function createImperialMissingPrereqFixture(seed: string): PrototypeScenario {
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
          food: 2000,
          wood: 600,
          gold: 1600,
          stone: 400,
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

function createImperialUpgradesFixture(seed: string): PrototypeScenario {
  // Same shape as castle-upgrades-fixture but the human player starts in
  // Imperial Age. Used to confirm the three Castle-Age production-line
  // upgrades remain researchable when a player skipped past Castle before
  // researching them.
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 500,
          wood: 300,
          gold: 400,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        x: 12,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'barracks',
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'stable',
        x: 20,
        y: 6,
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
    ],
  };
}

// Slice 7B fixture: Imperial-Age human with a completed Archery Range and
// Blacksmith plus one pre-existing Crossbowman and one pre-existing
// Cavalry Archer. Exercises the Arbalest and Heavy Cavalry Archer upgrades
// (research + mutation + train-menu swap) and the Fletching-stacks-on-
// Arbalest path.
function createImperialArbalestFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 2000,
          wood: 500,
          gold: 2000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        x: 12,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'crossbowman',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'cavalry-archer',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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

// Slice 7B fixture: Imperial-Age human with a completed Barracks and one
// pre-existing Militia and one pre-existing Pikeman. Exercises the
// Halberdier and Champion upgrades.
function createImperialHalberdierFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 2000,
          wood: 500,
          gold: 2000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'pikeman',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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

// Slice 7B combat fixture: player-1 Pikeman adjacent to a player-2 Knight.
// Used to compare damage-per-hit against the Halberdier-vs-Knight fixture
// so the Halberdier anti-cavalry bonus must exceed the Pikeman's.
function createPikemanVsKnightFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'pikeman',
        x: 14,
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
        kind: 'knight',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 7C fixture: Imperial-Age human with a completed Stable plus one
// pre-existing Light Cavalry (scout-line) and one pre-existing Knight
// (knight-line). Exercises the Hussar and Cavalier upgrades.
function createImperialStableFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 2000,
          wood: 500,
          gold: 2000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'stable',
        x: 16,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'light-cavalry',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'knight',
        x: 12,
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

// Slice 7C combat fixture: player-1 Camel adjacent to a player-2 Hussar.
// Verifies that the Camel anti-cavalry bonus fires against the Hussar
// (Imperial successor of the Light Cavalry line) via isCavalryTarget.
function createCamelVsHussarFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'camel',
        x: 14,
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
        kind: 'hussar',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 11 },
      },
    ],
  };
}

// Slice 7C combat fixture: player-1 Halberdier adjacent to a player-2
// Cavalier. Verifies the Halberdier +28 anti-cavalry bonus fires against
// the Cavalier (Imperial successor of the Knight line) via isCavalryTarget.
function createHalberdierVsCavalierFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'halberdier',
        x: 14,
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
        kind: 'cavalier',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 7B combat fixture: mirror of pikeman-vs-knight-fixture with a
// Halberdier in place of the Pikeman.
function createHalberdierVsKnightFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'halberdier',
        x: 14,
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
        kind: 'knight',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 4 fixture: Castle-Age human with a completed Siege Workshop, used to
// assert that the Siege Workshop train menu offers Mangonel / Scorpion /
// Battering Ram and that the producer flow works end-to-end.
function createSiegeWorkshopFixture(seed: string): PrototypeScenario {
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

// Slice 4 fixture: player-1 Mangonel stationed exactly 7 tiles (its attack
// range) from a stationary enemy Spearman. Used to assert ranged combat
// without pursuit / closing.
function createMangonelRangedFixture(seed: string): PrototypeScenario {
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
        kind: 'mangonel',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
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
        kind: 'spearman',
        x: 19,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel adjacent-by-range to a single
// enemy Spearman. Used to measure one-shot damage including the +10
// anti-infantry bonus — Spearman 45 HP vs Mangonel (40 base + 10 infantry
// bonus) = death after a single attack tick.
function createMangonelVsSpearmanFixture(seed: string): PrototypeScenario {
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
        kind: 'mangonel',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
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
        kind: 'spearman',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel inside max range of a single
// enemy Knight. Used to confirm the +10 anti-infantry bonus does NOT apply
// to cavalry — Knight 100 HP should take exactly 40 damage on one tick.
function createMangonelVsKnightFixture(seed: string): PrototypeScenario {
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
        kind: 'mangonel',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
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
        kind: 'knight',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel with a stationary enemy
// Spearman TWO cells away — well inside the Mangonel's max range 7 but
// inside its minimum range 3. The Mangonel must refuse to fire (its
// boulders can't arc in that close) and hold its position.
function createMangonelMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
        kind: 'mangonel',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 2 from the Mangonel — inside the min-range 3
      // dead zone. The test issues an attack command; the Mangonel should
      // hold fire (no cooldown consumed) and the Spearman's HP must stay
      // pinned at 45. A stray shot would drop it to 0 (40 + 10 infantry).
      {
        kind: 'spearman',
        x: 12,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Mangonel with a stationary enemy
// Spearman at distance 5 — OUTSIDE min range 3 and WELL INSIDE max range
// 7. Positive control for the min-range test: under identical stats the
// Mangonel must fire and destroy the Spearman with 40 + 10 = 50 damage
// on one tick.
function createMangonelOutsideMinRangeFixture(seed: string): PrototypeScenario {
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
        kind: 'mangonel',
        x: 10,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
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
        kind: 'spearman',
        x: 15,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 review fixture: player-1 Watch Tower with both an enemy Mangonel
// and an enemy Militia inside its attack range. Used to assert siege is the
// highest-priority target for defensive buildings (the tower must fire on
// the Mangonel first, not the closer Militia).
function createTowerVsSiegePriorityFixture(seed: string): PrototypeScenario {
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
        kind: 'watch-tower',
        x: 10,
        y: 10,
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
      // Both enemies sit inside the tower's range 7. Militia is CLOSER (dist 4
      // vs the Mangonel's dist 5) — before the priority fix the tower fell
      // back on proximity and killed the Militia first. The fix must make the
      // Mangonel the preferred target regardless of proximity.
      {
        kind: 'militia',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'mangonel',
        x: 15,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 9 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Scorpion stationed exactly 7 tiles (its attack
// range) from a stationary enemy Spearman. Used to assert ranged combat.
function createScorpionRangedFixture(seed: string): PrototypeScenario {
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
        kind: 'scorpion',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
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
        kind: 'spearman',
        x: 19,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Battering Ram next to an enemy House. Used to
// assert the Ram's +75 anti-building bonus destroys a 75-HP House in one hit
// (base 2 + 75 = 77 > 75).
function createRamVsBuildingFixture(seed: string): PrototypeScenario {
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
        kind: 'battering-ram',
        x: 13,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'house',
        x: 14,
        y: 8,
        owner: 2,
        baseOwner: 2,
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

// Slice 4 fixture: player-1 Battering Ram next to an enemy villager. Used to
// assert the Ram does NOT receive the +75 building bonus against unit targets.
function createRamVsVillagerFixture(seed: string): PrototypeScenario {
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
        kind: 'battering-ram',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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
        kind: 'villager',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Pikeman next to an enemy Battering Ram. Used to
// assert the Pikeman anti-cavalry bonus does NOT fire against siege units.
function createPikemanVsRamFixture(seed: string): PrototypeScenario {
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
        kind: 'pikeman',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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
        kind: 'battering-ram',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 4 fixture: player-1 Camel next to an enemy Battering Ram. Used to
// assert the Camel anti-cavalry bonus does NOT fire against siege units.
function createCamelVsRamFixture(seed: string): PrototypeScenario {
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
        kind: 'camel',
        x: 14,
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
        kind: 'battering-ram',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 5 fixture: Castle-Age human start with a completed Monastery and a
// nearby neutral relic. Used for Monastery train-menu, Monk build placement,
// pickup, and deposit tests without waiting for placement. Player 2 starts
// with a standard TC for containment and owns a wounded Spearman (heal
// target) and a Militia (convert target) close by.
function createMonasteryFixture(seed: string): PrototypeScenario {
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
        kind: 'monastery',
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
        kind: 'relic',
        x: 14,
        y: 12,
        owner: null,
        baseOwner: null,
        amount: 0,
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

// Slice 5 fixture for Monk heal: player-1 Monk adjacent to a friendly
// Spearman with a neutral wolf close enough to auto-aggro the Spearman when
// the test walks the wolf into aggro range. The wolf applies damage over a
// few ticks, letting the test observe a wounded Spearman before issuing the
// heal order.
function createMonkHealFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 15,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Wolf auto-aggros on the nearest player unit within its aggro range;
        // placed at (17, 8) → range 2 from the Spearman at (15, 8). Wolf
        // attack 3 / reload 12, so HP accrues slowly and we can stop combat
        // by killing the wolf once it's done some damage.
        kind: 'wolf',
        x: 17,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk convert: player-1 Monk adjacent to an enemy
// Militia. After about 50 ticks the Militia flips to player 1.
function createMonkConvertFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for two Monks converting the same enemy Militia. The
// per-tick progress rate must stay fixed — each convert target can only
// receive one progress tick per simulation tick, no matter how many Monks
// are in range.
function createMonkDoubleConvertFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'monk',
        x: 14,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for post-conversion cleanup: player-1 Monk plus a
// player-1 Pikeman attacking an enemy Militia. When the Monk converts the
// Militia, the Pikeman's attack command must be cleared since the target
// is now a teammate.
function createMonkConvertCleanupFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'pikeman',
        x: 14,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        // Militia has a ton of HP relative to default so the Pikeman does
        // not kill it before conversion completes (~50 ticks).
        kind: 'militia',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for relic drop on Monastery destruction: a player-2
// Monastery at (18, 8) pre-seeded with one deposited relic, its HP
// knocked down to 10 so a single-hit destroy is deterministic, and a
// player-1 Pikeman adjacent for the human test to command into an
// attack. When the Monastery dies, the relic should drop back onto
// the map near the footprint.
// Slice 6 review fix: a Monastery with 2 stored relics, completely
// surrounded by trees on every cell at manhattan distance 1 and 2 of
// the footprint. The existing radius-capped drop search (range 2)
// finds zero free approach cells in this scenario, so pre-fix the
// stored relics vanish on destruction. A Mangonel sits beyond the
// tree ring and shells the Monastery into the ground from range, so
// the destruction itself does not require an open approach.
function createMonkRelicDropCrampedFixture(seed: string): PrototypeScenario {
  const monasteryAnchor = { x: 10, y: 10 };
  const footprintMinX = monasteryAnchor.x;
  const footprintMaxX = monasteryAnchor.x + 1;
  const footprintMinY = monasteryAnchor.y;
  const footprintMaxY = monasteryAnchor.y + 1;
  const blockerRange = 2;
  const blockerSpawns: ScenarioSpawnSpec[] = [];
  for (let y = footprintMinY - blockerRange; y <= footprintMaxY + blockerRange; y += 1) {
    for (let x = footprintMinX - blockerRange; x <= footprintMaxX + blockerRange; x += 1) {
      const insideFootprint = x >= footprintMinX && x <= footprintMaxX
        && y >= footprintMinY && y <= footprintMaxY;
      if (insideFootprint) {
        continue;
      }
      const dx =
        x < footprintMinX ? footprintMinX - x
        : x > footprintMaxX ? x - footprintMaxX
        : 0;
      const dy =
        y < footprintMinY ? footprintMinY - y
        : y > footprintMaxY ? y - footprintMaxY
        : 0;
      const distance = dx + dy;
      if (distance === 0 || distance > blockerRange) {
        continue;
      }
      blockerSpawns.push({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 20 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        // Wide vision so the Mangonel sees its target without having
        // to drive its own LOS forward through the tree ring.
        vision: { playerId: 1, radius: 18 },
      },
      // Hostile Monastery — owns 2 relics deposited ahead of time;
      // extremely low HP so the Mangonel one-shots it.
      {
        kind: 'monastery',
        x: monasteryAnchor.x,
        y: monasteryAnchor.y,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startingRelicsInMonastery: 2,
        startHp: 10,
      },
      ...blockerSpawns,
      // Mangonel parked beyond the tree ring at manhattan distance 5
      // from the nearest Monastery cell (well within range 7 and
      // outside min range 3).
      {
        kind: 'mangonel',
        x: 10,
        y: 16,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 20,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

function createMonkRelicDropFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monastery',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startingRelicsInMonastery: 1,
        startHp: 10,
      },
      {
        kind: 'pikeman',
        x: 17,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fix: a healthy friendly Militia and an enemy Militia share one
// coarse cell. The Monk should fall through to convert the enemy because
// pass-1 heal targeting must skip a friendly with full HP. Pre-fix the
// Monk picked up the healthy friendly in pass-1, fell into the
// move-fallback inside issueMonkContextCommandAtEntity, and never
// converted anything.
function createMonkHealthyFriendlyWithEnemyFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      // Friendly Militia at full HP — the heal pass must skip it.
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      // Enemy Militia stacked on the same cell — the convert pass should
      // pick this up.
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk heal-over-convert target preference: a friendly
// (damaged) Spearman and an enemy Militia share the same coarse cell. The
// test right-clicks that cell and expects the Monk to heal the Spearman,
// not convert the Militia.
function createMonkHealOverConvertFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'spearman',
        x: 16,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk convert + vision handoff: player-1 Monk with a
// small vision radius positioned far from the player's TC, adjacent to an
// enemy Scout whose own vision radius is large enough to cover cells the
// player cannot otherwise see. Used to verify that a successful conversion
// reassigns the target's visionSource.playerId to the Monk's owner.
function createMonkConvertVisionFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        // Keep TC vision short so it does not overlap the Monk/Scout area.
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'monk',
        x: 20,
        y: 20,
        owner: 1,
        baseOwner: 1,
        // Small vision so only the Monk's immediate cells are visible —
        // cells 3+ away around the Scout are fog-hidden until vision flips.
        vision: { playerId: 1, radius: 2 },
      },
      {
        kind: 'scout',
        x: 21,
        y: 20,
        owner: 2,
        baseOwner: 2,
        // Radius 6 so (scoutX + 3) is inside the Scout's vision but
        // outside the Monk's radius-2 vision. After conversion, player 1
        // should see that cell iff the Scout's visionSource playerId was
        // flipped.
        vision: { playerId: 2, radius: 6 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk-in-fog: player-1 Monk at home with short Town
// Center and Monk vision. Enemy Militia spawns just outside Monk vision but
// inside the Monk's conversion range. Used to verify the cell-based context
// resolver rejects fog-hidden enemy targets so the fallback is a plain move,
// not a convert.
function createMonkFogFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'monk',
        x: 8,
        y: 10,
        owner: 1,
        baseOwner: 1,
        // Small vision so the adjacent enemy Militia is in fog.
        vision: { playerId: 1, radius: 1 },
      },
      {
        // Distance 3 from the Monk (manhattan) → within MONK_ACTION_RANGE = 4
        // but outside Monk's radius-1 vision; the TC's radius-3 vision from
        // (8, 8) also does not reach. Fog hides the unit from the human.
        kind: 'militia',
        x: 11,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 5 fixture for Monk relic pickup + deposit: player-1 Monk, a neutral
// relic adjacent, and a player-1 Monastery 4 cells away. Used for pickup,
// follow, deposit, and gold-income tests.
function createMonkRelicFixture(seed: string): PrototypeScenario {
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
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'monastery',
        x: 18,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'monk',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'relic',
        x: 15,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Franks human (player 1) with a completed Castle.
// Used to pin the contract that a non-Britons Castle offers NO train
// options in v1 (only Britons ship a unique unit yet).
function createCastleNonBritonsFixture(seed: string): PrototypeScenario {
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
        civilization: 'Franks',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human player with a completed Castle, a
// nearby villager, and generous resources so the test can queue a
// Longbowman immediately. Explicitly sets civilization to Britons to
// stay robust against changes to `defaultCivilizationName`.
function createCastleUniqueFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'castle-age',
        civilization: 'Franks',
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
        kind: 'castle',
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
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: player-1 Castle at (14, 6) with an enemy Spearman in
// range-8 reach so the test can assert defensive auto-fire lands damage
// over a few ticks. The Spearman is at (21, 8) — straight-line distance 7
// from Castle center, within the Castle's attack range of 8. The
// Castle owner is Britons (default for player 1) and has vision 11 so
// the target is always visible.
// Slice 6 review fix: AI militia stands between a player Castle and a
// player House. The Castle is closer (anchor distance 4 vs House's 6),
// so a Manhattan-only sort would steer the militia at the Castle.
// With buildingTargetPriority biasing big defensive structures down,
// the militia must instead pick the lower-priority House.
function createCastleAiTargetPriorityFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 30 },
        startingAge: 'castle-age',
      },
    ],
    spawns: [
      // Player 1 TC sits far away — does not draw the militia (TC is
      // also high priority, but distance keeps it out of consideration
      // for this scenario).
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Castle the AI must NOT prefer (4x4 anchor at (15, 5); cells
      // (15..18, 5..8)).
      {
        kind: 'castle',
        x: 15,
        y: 5,
        owner: 1,
        baseOwner: 1,
      },
      // House the AI MUST prefer (2x2 anchor at (15, 15); cells
      // (15..16, 15..16)). Anchor distance to the militia is 6,
      // strictly larger than the Castle's 4.
      {
        kind: 'house',
        x: 15,
        y: 15,
        owner: 1,
        baseOwner: 1,
      },
      // AI Militia. Vision radius 12 ensures both buildings'
      // anchor cells fall inside player-2 visibility.
      {
        kind: 'militia',
        x: 15,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 12 },
      },
      // AI TC kept far enough away that the AI militia is the only
      // thing in range of either player-1 building.
      {
        kind: 'town-center',
        x: 40,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

function createCastleDefensiveFireFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'castle-age',
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      // Spearman at (20, 8). Manhattan distance from the Castle's anchor
      // cell (14, 6) = 6 + 2 = 8, matching the Castle's attack range
      // exactly (tower combat uses anchor-to-target distance, not
      // closest-edge, matching the existing TC / Watch Tower convention).
      // Castle vision radius 11 keeps the Spearman visible. No enemy AI
      // is reachable (enemy TC is at (48, 28) across the map), so the
      // Spearman just stands and absorbs arrows.
      {
        kind: 'spearman',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: a player-1 Longbowman stationed exactly 6 tiles from a
// stationary enemy Spearman. Used to assert ranged combat at the Longbow's
// canonical Castle-Age attack range without pursuit.
function createLongbowmanRangedFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'longbowman',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      // Spearman at (20, 8). Manhattan distance from (14, 8) = 6, exactly
      // at the Longbow's canonical Castle-Age range.
      {
        kind: 'spearman',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle AND Blacksmith
// so the test can research Fletching, train a Longbowman, and assert the
// +1/+1 buff lands on the Castle-Age Britons unique.
function createCastleFletchingFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: 20,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 6 fixture: Britons human with a completed Castle and 20 villagers
// adjacent to it, used to assert that up to 20 villagers can garrison a
// Castle (canonical capacity) — well above the Town Center / Watch Tower
// 5-unit cap.
function createCastleGarrisonFixture(seed: string): PrototypeScenario {
  const villagerSpawns: ScenarioSpawnSpec[] = [];
  // Place 20 villagers on a grid around (20, 10) — clear of the Castle
  // at (14, 6). Each villager gets a unique cell so no two share a slot.
  for (let i = 0; i < 20; i += 1) {
    const offsetX = i % 5;
    const offsetY = Math.floor(i / 5);
    villagerSpawns.push({
      kind: 'villager',
      x: 20 + offsetX,
      y: 10 + offsetY,
      owner: 1,
      baseOwner: 1,
    });
  }
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
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
        kind: 'castle',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      ...villagerSpawns,
      {
        kind: 'town-center',
        x: 48,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Castle-Age combat fixture: a player-1 Camel stationed next to an enemy
// (player 2) Knight and Scout, used to assert the Camel's +9 anti-cavalry
// bonus without pursuit / pathing noise. All three units start in Castle
// Age and adjacent, so the Camel can hit on tick 1.
function createCamelVsCavalryFixture(seed: string): PrototypeScenario {
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
        kind: 'camel',
        x: 14,
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
        kind: 'knight',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'scout',
        x: 14,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age combat fixture: a player-1 Spearman next to an enemy (player 2)
// Camel, used to assert the Spearman's anti-cavalry bonus does NOT fire
// against Camels (Camels are anti-cavalry, not cavalry targets).
function createSpearmanVsCamelFixture(seed: string): PrototypeScenario {
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
        kind: 'spearman',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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
        kind: 'camel',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}

// Castle-Age ranged combat fixture: a player-1 Cavalry Archer stationed
// exactly 4 tiles (its attack range) away from a stationary enemy Militia.
// Used to assert the Cavalry Archer fires at range without closing.
function createCavalryArcherRangedFixture(seed: string): PrototypeScenario {
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
        kind: 'cavalry-archer',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'militia',
        x: 16,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Castle-Age ranged combat fixture: a player-1 Skirmisher stationed adjacent to
// a stationary enemy Cavalry Archer. Used to assert the Skirmisher's +4
// anti-archer bonus extends to Cavalry Archer (Cavalry Archer is in the
// archer family).
function createSkirmisherVsCavalryArcherFixture(seed: string): PrototypeScenario {
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
        kind: 'skirmisher',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        kind: 'cavalry-archer',
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
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

function createMilitiaCombatFixture(seed: string): PrototypeScenario {
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
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
      },
    ],
  };
}

function createMovingEnemyAttackFixture(seed: string): PrototypeScenario {
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
        kind: 'militia',
        x: 12,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
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
        x: 15,
        y: 8,
        owner: 2,
        baseOwner: 2,
        velocity: { dx: 1, dy: 0 },
        wanderBounds: {
          minX: 15,
          maxX: 17,
          minY: 8,
          maxY: 8,
        },
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: FIXTURE_SECONDARY_BUILDING_POSITION.x,
        y: FIXTURE_SECONDARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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

function createAiRushFixture(seed: string): PrototypeScenario {
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
        kind: 'villager',
        x: 6,
        y: 9,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 9,
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
        kind: 'villager',
        x: 22,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 22,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 23,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
        x: FIXTURE_VILLAGER_CLUSTER[0].x,
        y: FIXTURE_VILLAGER_CLUSTER[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[1].x,
        y: FIXTURE_VILLAGER_CLUSTER[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[2].x,
        y: FIXTURE_VILLAGER_CLUSTER[2].y,
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
        x: FIXTURE_VILLAGER_CLUSTER[0].x,
        y: FIXTURE_VILLAGER_CLUSTER[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[1].x,
        y: FIXTURE_VILLAGER_CLUSTER[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'villager',
        x: FIXTURE_VILLAGER_CLUSTER[2].x,
        y: FIXTURE_VILLAGER_CLUSTER[2].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'scout',
        x: 9,
        y: 12,
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
        x: FIXTURE_MIXED_SELECTION_HOUSE_POSITION.x,
        y: FIXTURE_MIXED_SELECTION_HOUSE_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[0].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[0].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[0].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[1].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[1].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[1].y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: FIXTURE_MIXED_SELECTION_UNITS[2].kind,
        x: FIXTURE_MIXED_SELECTION_UNITS[2].x,
        y: FIXTURE_MIXED_SELECTION_UNITS[2].y,
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
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'sheep',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
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

function createAiEconomyFixture(seed: string): PrototypeScenario {
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
        kind: 'house',
        x: 4,
        y: 8,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'mill',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'villager',
        x: 22,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 22,
        y: 9,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 24,
        y: 8,
        owner: null,
        baseOwner: 2,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 24,
        y: 9,
        owner: null,
        baseOwner: 2,
        amount: 100,
      },
    ],
  };
}

function createSheepOwnershipFixture(seed: string): PrototypeScenario {
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
        kind: 'scout',
        x: 3,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 10,
        y: 8,
        owner: null,
        baseOwner: null,
        amount: 100,
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

function createSheepMovementFixture(seed: string): PrototypeScenario {
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
        // Large vision so that unclaimed and enemy sheep elsewhere on the map
        // are selectable from the test (visibility-gated). TCs do not have a
        // `unit` component, so this does not affect proximity-based ownership.
        vision: { playerId: 1, radius: 50 },
      },
      {
        kind: 'villager',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 20,
        y: 19,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'scout',
        x: 21,
        y: 19,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'scout',
        x: 36,
        y: 25,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'sheep',
        x: 35,
        y: 25,
        owner: 2,
        baseOwner: 2,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 45,
        y: 25,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      // Two extra human-owned sheep adjacent to the human villager so the
      // group-selection test can drag-box several owned sheep at once.
      {
        kind: 'sheep',
        x: 19,
        y: 18,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'sheep',
        x: 19,
        y: 19,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
    ],
  };
}

function createResourceDepletionFixture(seed: string): PrototypeScenario {
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

function createFogMemoryFixture(seed: string): PrototypeScenario {
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

function createBuildingFootprintVisionFixture(seed: string): PrototypeScenario {
  // Layout designed so that an enemy 4x4 Town Center has only a single corner
  // cell inside the human player's vision. The human TC sits at (1, 1) with a
  // small radius-1 vision, and the human scout sits at (16, 13) (also radius 1)
  // adjacent to the enemy TC's bottom-right corner. The enemy TC anchor is at
  // (13, 10), so its footprint covers (13..16, 10..13).
  //
  // From the scout at (16, 13), squared distance to each TC cell:
  //   (13,10) anchor    : 9 + 9 = 18  (NOT visible at radius 1)
  //   (16, 13)  corner  : 0           (visible)
  //   (15, 13), (16, 12): 1           (visible)
  // The TC anchor itself sits well outside the scout's vision, so a top-left
  // -only check would treat the TC as hidden; the corrected check sees the
  // bottom-right corner is visible and renders the TC as live.
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
        x: 16,
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

function distanceSquared(left: Position, right: Position): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  return dx * dx + dy * dy;
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

function createStartingScoutSpawn(
  owner: number,
  townCenter: Position,
): ScenarioSpawnSpec {
  const scoutPosition = projectOffset(townCenter, { x: 2, y: -1 });
  if (owner === HUMAN_PLAYER_ID) {
    return {
      kind: 'scout',
      x: scoutPosition.x,
      y: scoutPosition.y,
      owner,
      baseOwner: owner,
      vision: { playerId: owner, radius: 6 },
      requiresSafeSpawn: true,
    };
  }

  return {
    kind: 'scout',
    x: scoutPosition.x,
    y: scoutPosition.y,
    owner,
    baseOwner: owner,
    velocity: { dx: orientationFor(townCenter).x, dy: 0 },
    wanderBounds: {
      minX: Math.max(0, townCenter.x - 5),
      maxX: Math.min(MAP_WIDTH - 1, townCenter.x + 6),
      minY: Math.max(0, townCenter.y - 4),
      maxY: Math.min(MAP_HEIGHT - 1, townCenter.y + 4),
    },
    vision: { playerId: owner, radius: 6 },
    requiresSafeSpawn: true,
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
    { owner: 1, townCenter: { x: 8, y: 8 }, civilization: 'Britons' },
    { owner: 2, townCenter: { x: 48, y: 24 }, civilization: 'Franks' },
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

function isAccessibleShorelineCell(terrain: TerrainCellSpec[][], x: number, y: number): boolean {
  if (!isInBounds(x, y) || terrain[y][x]?.kind !== 'water') {
    return false;
  }

  const orthogonalOffsets: Offset[] = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];

  return orthogonalOffsets.some((offset) => {
    const shoreX = x + offset.x;
    const shoreY = y + offset.y;
    if (!isInBounds(shoreX, shoreY)) {
      return false;
    }
    const shorelineCell = terrain[shoreY][shoreX];
    return shorelineCell.kind !== 'water' && shorelineCell.kind !== 'forest';
  });
}

function applyShoreFishPatches(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  seed: string,
  spawns: ScenarioSpawnSpec[],
): void {
  const candidates: Position[] = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (!isAccessibleShorelineCell(terrain, x, y)) {
        continue;
      }
      if (starts.some((start) => distanceSquared(start.townCenter, { x, y }) <= 81)) {
        continue;
      }
      candidates.push({ x, y });
    }
  }

  if (candidates.length === 0) {
    return;
  }

  const placed: Position[] = [];
  const targetCount = Math.min(14, Math.max(4, Math.floor(candidates.length / 12)));
  const startIndex = seedToNumber(seed) % candidates.length;
  const stride = Math.max(3, Math.floor(candidates.length / Math.max(targetCount, 1)));

  for (let attempt = 0; attempt < candidates.length && placed.length < targetCount; attempt += 1) {
    const candidate = candidates[(startIndex + attempt * stride) % candidates.length];
    if (placed.some((position) => distanceSquared(position, candidate) < 9)) {
      continue;
    }

    spawns.push({
      kind: 'fish',
      x: candidate.x,
      y: candidate.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
    });
    placed.push(candidate);
  }

  if (placed.length === 0) {
    const fallback = candidates[0];
    spawns.push({
      kind: 'fish',
      x: fallback.x,
      y: fallback.y,
      owner: null,
      baseOwner: null,
      amount: SHORE_FISH_AMOUNT,
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

  if (seed === 'blocking-rules-fixture') {
    return createBlockingRulesFixture(seed);
  }

  if (seed === 'unit-sharing-fixture') {
    return createUnitSharingFixture(seed);
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

  if (seed === 'blocked-stable-spawn-fixture') {
    return createBlockedStableSpawnFixture(seed);
  }

  if (seed === 'isolated-scout-spawn-fixture') {
    return createIsolatedScoutSpawnFixture(seed);
  }

  if (seed === 'castle-age-fixture') {
    return createCastleAgeFixture(seed);
  }

  if (seed === 'castle-town-center-fixture') {
    return createCastleTownCenterFixture(seed);
  }

  if (seed === 'castle-upgrades-fixture') {
    return createCastleUpgradesFixture(seed);
  }

  if (seed === 'imperial-upgrades-fixture') {
    return createImperialUpgradesFixture(seed);
  }

  if (seed === 'imperial-age-fixture') {
    return createImperialAgeFixture(seed);
  }

  if (seed === 'imperial-missing-prereq-fixture') {
    return createImperialMissingPrereqFixture(seed);
  }

  if (seed === 'imperial-arbalest-fixture') {
    return createImperialArbalestFixture(seed);
  }

  if (seed === 'imperial-halberdier-fixture') {
    return createImperialHalberdierFixture(seed);
  }

  if (seed === 'pikeman-vs-knight-fixture') {
    return createPikemanVsKnightFixture(seed);
  }

  if (seed === 'halberdier-vs-knight-fixture') {
    return createHalberdierVsKnightFixture(seed);
  }

  if (seed === 'imperial-stable-fixture') {
    return createImperialStableFixture(seed);
  }

  if (seed === 'camel-vs-hussar-fixture') {
    return createCamelVsHussarFixture(seed);
  }

  if (seed === 'halberdier-vs-cavalier-fixture') {
    return createHalberdierVsCavalierFixture(seed);
  }

  if (seed === 'camel-vs-cavalry-fixture') {
    return createCamelVsCavalryFixture(seed);
  }

  if (seed === 'spearman-vs-camel-fixture') {
    return createSpearmanVsCamelFixture(seed);
  }

  if (seed === 'cavalry-archer-ranged-fixture') {
    return createCavalryArcherRangedFixture(seed);
  }

  if (seed === 'skirmisher-vs-cavalry-archer-fixture') {
    return createSkirmisherVsCavalryArcherFixture(seed);
  }

  if (seed === 'siege-workshop-fixture') {
    return createSiegeWorkshopFixture(seed);
  }

  if (seed === 'mangonel-ranged-fixture') {
    return createMangonelRangedFixture(seed);
  }

  if (seed === 'scorpion-ranged-fixture') {
    return createScorpionRangedFixture(seed);
  }

  if (seed === 'tower-vs-siege-priority-fixture') {
    return createTowerVsSiegePriorityFixture(seed);
  }

  if (seed === 'mangonel-vs-spearman-fixture') {
    return createMangonelVsSpearmanFixture(seed);
  }

  if (seed === 'mangonel-vs-knight-fixture') {
    return createMangonelVsKnightFixture(seed);
  }

  if (seed === 'mangonel-min-range-blocked-fixture') {
    return createMangonelMinRangeBlockedFixture(seed);
  }

  if (seed === 'mangonel-outside-min-range-fixture') {
    return createMangonelOutsideMinRangeFixture(seed);
  }

  if (seed === 'ram-vs-building-fixture') {
    return createRamVsBuildingFixture(seed);
  }

  if (seed === 'ram-vs-villager-fixture') {
    return createRamVsVillagerFixture(seed);
  }

  if (seed === 'pikeman-vs-ram-fixture') {
    return createPikemanVsRamFixture(seed);
  }

  if (seed === 'camel-vs-ram-fixture') {
    return createCamelVsRamFixture(seed);
  }

  if (seed === 'monastery-fixture') {
    return createMonasteryFixture(seed);
  }

  if (seed === 'monk-heal-fixture') {
    return createMonkHealFixture(seed);
  }

  if (seed === 'monk-convert-fixture') {
    return createMonkConvertFixture(seed);
  }

  if (seed === 'monk-fog-fixture') {
    return createMonkFogFixture(seed);
  }

  if (seed === 'monk-convert-vision-fixture') {
    return createMonkConvertVisionFixture(seed);
  }

  if (seed === 'monk-heal-over-convert-fixture') {
    return createMonkHealOverConvertFixture(seed);
  }

  if (seed === 'monk-healthy-friendly-with-enemy-fixture') {
    return createMonkHealthyFriendlyWithEnemyFixture(seed);
  }

  if (seed === 'monk-double-convert-fixture') {
    return createMonkDoubleConvertFixture(seed);
  }

  if (seed === 'monk-convert-cleanup-fixture') {
    return createMonkConvertCleanupFixture(seed);
  }

  if (seed === 'monk-relic-drop-fixture') {
    return createMonkRelicDropFixture(seed);
  }

  if (seed === 'monk-relic-drop-cramped-fixture') {
    return createMonkRelicDropCrampedFixture(seed);
  }

  if (seed === 'castle-unique-fixture') {
    return createCastleUniqueFixture(seed);
  }
  if (seed === 'castle-non-britons-fixture') {
    return createCastleNonBritonsFixture(seed);
  }
  if (seed === 'castle-defensive-fire-fixture') {
    return createCastleDefensiveFireFixture(seed);
  }
  if (seed === 'castle-ai-target-priority-fixture') {
    return createCastleAiTargetPriorityFixture(seed);
  }
  if (seed === 'longbowman-ranged-fixture') {
    return createLongbowmanRangedFixture(seed);
  }
  if (seed === 'castle-fletching-fixture') {
    return createCastleFletchingFixture(seed);
  }
  if (seed === 'castle-garrison-fixture') {
    return createCastleGarrisonFixture(seed);
  }
  if (seed === 'monk-relic-fixture') {
    return createMonkRelicFixture(seed);
  }

  if (seed === 'feudal-spearman-fixture') {
    return createFeudalSpearmanFixture(seed);
  }

  if (seed === 'feudal-skirmisher-fixture') {
    return createFeudalSkirmisherFixture(seed);
  }

  if (seed === 'militia-combat-fixture') {
    return createMilitiaCombatFixture(seed);
  }

  if (seed === 'moving-enemy-attack-fixture') {
    return createMovingEnemyAttackFixture(seed);
  }

  if (seed === 'feudal-watch-tower-fixture') {
    return createFeudalWatchTowerFixture(seed);
  }

  if (seed === 'ai-rush-fixture') {
    return createAiRushFixture(seed);
  }

  if (seed === 'feudal-market-fixture') {
    return createFeudalMarketFixture(seed);
  }

  if (seed === 'town-center-defense-fixture') {
    return createTownCenterDefenseFixture(seed);
  }

  if (seed === 'mining-camp-fixture') {
    return createMiningCampFixture(seed);
  }

  if (seed === 'fish-fixture') {
    return createFishFixture(seed);
  }

  if (seed === 'boar-aggro-fixture') {
    return createBoarAggroFixture(seed);
  }

  if (seed === 'wolf-aggro-fixture') {
    return createWolfAggroFixture(seed);
  }

  if (seed === 'orders-fixture') {
    return createOrdersFixture(seed);
  }

  if (seed === 'ai-economy-fixture') {
    return createAiEconomyFixture(seed);
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

  if (seed === 'sheep-ownership-fixture') {
    return createSheepOwnershipFixture(seed);
  }

  if (seed === 'sheep-movement-fixture') {
    return createSheepMovementFixture(seed);
  }

  if (seed === 'resource-depletion-fixture') {
    return createResourceDepletionFixture(seed);
  }

  if (seed === 'fog-memory-fixture') {
    return createFogMemoryFixture(seed);
  }

  if (seed === 'building-footprint-vision-fixture') {
    return createBuildingFootprintVisionFixture(seed);
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

    for (const offset of STARTING_VILLAGERS) {
      const position = projectOffset(start.townCenter, offset);
      spawns.push({
        kind: 'villager',
        x: position.x,
        y: position.y,
        owner: start.owner,
        baseOwner: start.owner,
        vision: { playerId: start.owner, radius: 4 },
        requiresSafeSpawn: true,
      });
    }

    spawns.push(createStartingScoutSpawn(start.owner, start.townCenter));
  }

  applyShoreFishPatches(terrain, starts, seed, spawns);

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

  // Slice 5: neutral relics between the two bases. Not harvestable; only a
  // Monk can pick them up and deposit them in a friendly Monastery.
  for (const relicPosition of DEFAULT_RELIC_POSITIONS) {
    paintDisc(terrain, relicPosition, 1, 'grass');
    spawns.push({
      kind: 'relic',
      x: relicPosition.x,
      y: relicPosition.y,
      owner: null,
      baseOwner: null,
      amount: 0,
    });
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns,
  };
}
