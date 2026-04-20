import {
  createNoise2D,
  octaveNoise2D,
  type Position,
} from 'civ-engine';

import type {
  AgeType,
  BuildingType,
  PlayerResources,
  ResearchableTechnologyType,
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
  // Slice 12 Task B: opt out of the bridge-boot fixture validator for
  // a single spawn. Used by fixtures that intentionally stack
  // otherwise-illegal entities (e.g., a unit standing inside a building
  // footprint for the tile-selection-cycle UX test). Default `false`;
  // leave unset in every gameplay fixture.
  allowOverlappingSpawn?: boolean;
  // Building-only. Starts deposited relics inside a Monastery. Lets
  // tests exercise the "destroy the Monastery, drop the relics" flow
  // without driving a full pickup-and-deposit cycle.
  startingRelicsInMonastery?: number;
  // Overrides the spawned entity's starting HP so tests can make siege
  // scenarios resolve in a handful of ticks (buildings) or pre-wound a
  // unit so the heal path fires immediately (units, FU4). Ignored when
  // unset or when the value is larger than the entity's default max HP.
  startHp?: number;
}

export interface PlayerStartSpec {
  owner: number;
  townCenter: Position;
  civilization?: string;
  startingAge?: AgeType;
  startingResources?: PlayerResources;
  // Test-only override for the Wonder and Relic victory countdown.
  // Production uses the authoritative `WONDER_COUNTDOWN_TICKS` /
  // `RELIC_COUNTDOWN_TICKS` constants; fixtures can shrink this to a
  // handful of ticks so vitest cases resolve quickly. Applied per owner.
  wonderCountdownOverrideTicks?: number;
  relicCountdownOverrideTicks?: number;
  // Slice 10 (AI baseline). Non-human players get a per-owner
  // `AiState` seeded with this difficulty level. Defaults to
  // `'standard'` when omitted. Vitest fixtures can bump this to
  // `'hard'` to stress the gather-rate multiplier, or `'easy'` to
  // confirm the opposite side of the gap.
  difficulty?: 'easy' | 'standard' | 'hard';
  // FU1: Fixtures can pre-research technologies on bridge boot so
  // tests skip the research cadence when verifying downstream effects
  // (e.g. Chemistry-gated Bombard Cannon training). Applied after
  // `researchedTechnologies` init but BEFORE combat-state creation so
  // newly-spawned units pick up the tech bonuses. Does NOT fire the
  // `applyTechnology` side effects (age-up, unit upgrades, etc.);
  // restricted to "passive-bonus" techs that only affect createCombatState.
  startingResearchedTechnologies?: ResearchableTechnologyType[];
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
        // Slice 12 Task B: moved from (10, 10) which sat inside the human
        // TC footprint (TC covers 8..11, 8..11). The (10, 13) slot keeps
        // the archer adjacent to the TC and out of any building
        // footprint so fixture validation passes.
        kind: 'archer',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'spearman',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'scout',
        x: 14,
        y: 13,
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
        // Slice 12 Task B: moved from (22, 10) which sat inside the
        // enemy TC footprint (TC covers 24..27, 8..11). (22, 13) keeps
        // the archer adjacent to the enemy base and out of the footprint.
        x: 22,
        y: 13,
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'crossbowman',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'cavalry-archer',
        x: 12,
        y: 13,
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'militia',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'pikeman',
        x: 12,
        y: 13,
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'light-cavalry',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'knight',
        x: 12,
        y: 13,
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

// Slice 7C fixture: Britons human with a completed Castle, a Blacksmith,
// a pre-existing Longbowman, and generous resources. Used to verify that
// the Elite Longbowman research option is exposed and that the upgrade
// mutates the existing Longbowman in place and swaps the train menu.
function createImperialCastleBritonsFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
        startingResources: {
          food: 2000,
          wood: 500,
          gold: 2000,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
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
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'longbowman',
        x: 10,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
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

// Slice 7C fixture: non-Britons (Franks) human in Imperial Age with a
// Castle. Used to verify that a non-Britons owner never sees the
// elite-longbowman-upgrade research option (the gate is civilization-
// specific, matching the Slice 6 Longbowman training gate).
function createImperialCastleFranksFixture(seed: string): PrototypeScenario {
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
        civilization: 'Franks',
        startingResources: {
          food: 500,
          wood: 500,
          gold: 500,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
        civilization: 'Britons',
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
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'mangonel',
        x: 10,
        y: 13,
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
      //
      // Slice 12 Task B: `vision: radius 1` instead of the old `3`. The
      // pre-Slice-12 fixture positioned the Mangonel inside the TC
      // footprint at (10, 10) which (a) failed the new fixture
      // validator and (b) side-benefit blocked the enemy AI's
      // Spearman from walking to the Mangonel because the TC cells
      // were impassable. The validator-compliant y=13 positions don't
      // have that blocker, so the standard AI would otherwise send the
      // Spearman to melee the Mangonel and die to a min-range-zone
      // retaliation. Tight radius-1 vision keeps the Spearman unaware
      // of the Mangonel so the test isolates the Mangonel's own
      // min-range behaviour.
      {
        kind: 'spearman',
        x: 12,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'mangonel',
        x: 10,
        y: 13,
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
        y: 13,
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint
        // at 8..11, 8..11). (12, 10) still sits within tower range 7
        // of both enemy units below so the priority test is
        // unchanged, but now occupies a free cell.
        kind: 'watch-tower',
        x: 12,
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
      // Both enemies sit inside the tower's range 7. Militia is CLOSER than
      // the Mangonel (dist 3 vs dist 4 after the tower move) — before the
      // priority fix the tower fell back on proximity and killed the Militia
      // first. The fix must make the Mangonel the preferred target regardless
      // of proximity.
      {
        kind: 'militia',
        x: 15,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'mangonel',
        x: 16,
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
        // Slice 12 Task B: moved from (8, 10) (inside TC footprint at
        // 8..11, 8..11). (8, 12) keeps the Monk just south of the TC
        // and still within MONK_ACTION_RANGE = 4 of the enemy militia.
        kind: 'monk',
        x: 8,
        y: 12,
        owner: 1,
        baseOwner: 1,
        // Small vision so the adjacent enemy Militia is in fog.
        vision: { playerId: 1, radius: 1 },
      },
      {
        // Distance 3 from the Monk at (8, 12) (manhattan, to (11, 12))
        // → within MONK_ACTION_RANGE = 4 but outside Monk's radius-1
        // vision; the TC's radius-3 vision from (8, 8) also does not
        // reach. Fog hides the unit from the human.
        kind: 'militia',
        x: 11,
        y: 12,
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
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can train a Spearman in Feudal Age and use its anti-scout
        // bonus` expects an enemy scout exactly at (14, 10) so its
        // `issueContextCommand(14, 10)` resolves to this scout. That
        // cell sits inside the Barracks footprint at (13..15, 8..10);
        // opt out of the fixture validator.
        kind: 'scout',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
        allowOverlappingSpawn: true,
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
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can train a Skirmisher in Feudal Age and use its anti-
        // archer bonus` expects an enemy archer exactly at (14, 10)
        // so its `issueContextCommand(14, 10)` resolves to this
        // archer. That cell sits inside the Archery Range footprint
        // at (13..15, 8..10); opt out of the fixture validator.
        kind: 'archer',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
        allowOverlappingSpawn: true,
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
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can build a Watch Tower in Feudal Age and let it
        // automatically kill a nearby visible Scout` places a Watch
        // Tower near the human TC and measures whether the nearby
        // enemy scout dies within 520 ticks. The scout's exact (18,8)
        // position sits inside the Blacksmith footprint
        // (17..19, 8..10) but the tower's range 7 + the scout's
        // near-stationary spot makes the test time-boxed, so leaving
        // the scout at (18, 8) preserves the tower-range geometry.
        kind: 'scout',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        allowOverlappingSpawn: true,
      },
    ],
  };
}

// Slice 10: AI-vs-inert-human match fixture. Both players start in
// Feudal Age with deep resource stockpiles so the AI opens the build
// phase immediately — tests can measure age-up, villager rebalancing,
// military production, and attack-group push without having to walk
// through the Dark-Age timing. The human side has no villagers so
// only the AI's behavior is exercised.
function createAiPlannerFixture(seed: string): PrototypeScenario {
  const stockpile = { food: 2000, wood: 2000, gold: 1500, stone: 500 };
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 }, startingResources: stockpile },
      { owner: 2, townCenter: { x: 30, y: 20 }, startingResources: stockpile, difficulty: 'standard' },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // Human placeholder villager so the old rush behavior can still
      // kill one to match existing browser-test expectations. Position
      // the human villagers away from the AI base to avoid immediate
      // combat — the tests assert planner behavior rather than kill
      // counts.
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      // FU4: backup Town Centers in the far corner so the AI rush
      // cannot end the match via conquest before the AI reaches Castle
      // Age. 2400 HP each, placed far enough from the primary TC that
      // the AI's militia lock onto the primary TC first and don't path
      // back across the map until the primary dies. Two backups give
      // redundancy against a lucky rush. With the previous single-TC
      // human setup, conquest presence vanished around tick 2300 under
      // the new tuning's faster military production, which capped age
      // progression at Feudal.
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 14, y: 14, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      // Four AI villagers — enough to drive a non-trivial rebalance
      // test (food/wood/gold/stone across multiple resources).
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 28, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Resource patches near the AI base so it can actually gather.
      // Slice 12 Task B: TC at (30, 20) covers (30..33, 20..23). Sheep
      // moved below the TC to (32, 24) / (33, 24). Berry-bushes moved
      // above the TC (and below the TC rows (20..23)) keep the same
      // economy intent.
      // FU4: amounts upped so the AI can sustain Feudal + Castle-Age
      // production without depleting resources before the age-up test
      // completes. Previous amounts (100/125/100/200/150) only
      // supported ~2500 ticks of continuous gathering, which was fine
      // for the Slice 10 "reach Feudal" bar but bottlenecked the
      // FU4 "reach Castle Age" goal. The amounts are sized so the AI
      // can keep producing militias + age-up costs without starving
      // over the 8000-tick budget.
      { kind: 'sheep', x: 32, y: 25, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'sheep', x: 33, y: 25, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'berry-bush', x: 32, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'berry-bush', x: 33, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 26, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 27, y: 18, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 26, y: 19, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'tree', x: 27, y: 19, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'gold-mine', x: 35, y: 21, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'gold-mine', x: 35, y: 22, owner: null, baseOwner: 2, amount: 2000 },
      { kind: 'stone-mine', x: 26, y: 21, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'stone-mine', x: 26, y: 22, owner: null, baseOwner: 2, amount: 1000 },
    ],
  };
}

// FU4: AI Monk fixture. AI starts in Castle Age with a stockpile of
// gold/food/wood, a completed Monastery + Barracks, a couple of
// villagers, and a small population of trained military so the
// "wounded military" Monk-heal path is exercised. Includes one
// neutral relic placed inside the AI's vision so the relic-pickup
// path also fires deterministically. The AI's TC has a backup Town
// Center on the human side so conquest doesn't end the match
// prematurely (matches the pattern in createAiPlannerFixture).
function createAiMonkFixture(seed: string): PrototypeScenario {
  // Layout (anchored top-left of each footprint):
  //   AI TC      (30,20) 4x4 → (30..33, 20..23)
  //   blacksmith (24,12) 3x3 → (24..26, 12..14)
  //   archery    (28,12) 3x3 → (28..30, 12..14)
  //   stable     (32,12) 3x3 → (32..34, 12..14)
  //   market     (36,12) 4x4 → (36..39, 12..15)
  //   barracks   (24,16) 3x3 → (24..26, 16..18)
  //   lumber-cmp (37,17) 2x2 → (37..38, 17..18)
  //   mining-cmp (37,21) 2x2 → (37..38, 21..22)
  //   mill       (28,25) 2x2 → (28..29, 25..26)
  //   relic      (35,25) 1x1
  //   spearman   (28,16) 1x1 (inside barracks footprint? No, 28 is outside 24..26)
  //   archer     (29,16) 1x1
  //   sheep      (24,24..25)
  //   berry      (24,21..22)
  //   tree       (28,29..30) (28..29)
  //   gold       (36,17), (36,18)
  //   stone      (36,16)
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: 1000, wood: 600, gold: 1500, stone: 200 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      // Backup TC so the AI's pre-existing military doesn't end the
      // match by destroying the human's primary base.
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // AI villagers — enough to keep the economy alive while Monks
      // train and walk between targets.
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 28, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 21, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Pre-built Castle-Age production so the Castle / Imperial Age
      // gates pass and the AI's Monastery build-order target activates
      // without waiting on Feudal-tier prereqs.
      { kind: 'blacksmith', x: 24, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'archery-range', x: 28, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'stable', x: 32, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'market', x: 36, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'barracks', x: 24, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'lumber-camp', x: 37, y: 17, owner: 2, baseOwner: 2 },
      { kind: 'mining-camp', x: 37, y: 21, owner: 2, baseOwner: 2 },
      { kind: 'mill', x: 28, y: 25, owner: 2, baseOwner: 2 },
      // Small starting AI military — used to test the heal path. They
      // are given starting commands by the AI as soon as it ticks.
      { kind: 'spearman', x: 28, y: 16, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'archer', x: 29, y: 16, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Neutral relic just inside AI vision so the AI's Monk pickup
      // path activates within a few decision ticks.
      { kind: 'relic', x: 35, y: 25, owner: null, baseOwner: null, amount: 0 },
      // Resources around the AI base — generous amounts so the
      // economy never starves over the test budget. None overlap a
      // building footprint.
      { kind: 'sheep', x: 24, y: 24, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'sheep', x: 24, y: 25, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'berry-bush', x: 24, y: 21, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'berry-bush', x: 24, y: 22, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'tree', x: 28, y: 29, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'tree', x: 29, y: 29, owner: null, baseOwner: 2, amount: 1000 },
      { kind: 'gold-mine', x: 36, y: 17, owner: null, baseOwner: 2, amount: 1500 },
      { kind: 'gold-mine', x: 36, y: 18, owner: null, baseOwner: 2, amount: 1500 },
      { kind: 'stone-mine', x: 36, y: 16, owner: null, baseOwner: 2, amount: 800 },
    ],
  };
}

// FU4: AI Monk-heal fixture. The AI already owns a completed
// Monastery + a single trained Monk + a Pikeman whose HP is
// pre-damaged below the heal threshold via `startHp` on a starting
// combat state. Used by the heal-target test so the heal path fires
// without first running the Monk training pipeline.
function createAiMonkHealFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: 200, wood: 200, gold: 200, stone: 200 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'monastery', x: 27, y: 22, owner: 2, baseOwner: 2 },
      { kind: 'monk', x: 28, y: 24, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 9 } },
      // Pikeman pre-damaged via startHp so the heal path fires on the
      // first AI decision tick. Pikeman max HP is 60; 30 is half — well
      // below the 70% heal threshold.
      { kind: 'pikeman', x: 29, y: 24, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 }, startHp: 30 },
    ],
  };
}

// FU4: AI Wonder pursuit fixture. AI player 2 starts in Imperial Age
// with 40+ villagers, the full Wonder-cost stockpile (1000/1000/1000/
// 1000), and all the Castle-Age prereqs already built. The Wonder
// countdown is shrunk to 50 ticks via `wonderCountdownOverrideTicks`
// so the test can resolve the Wonder-victory path inside a 5000-tick
// budget. The human player has only a Town Center + villager (no
// military), so the AI's Wonder is unopposed.
function createAiWonderFixture(seed: string): PrototypeScenario {
  // Anchor key buildings so the layout has no overlaps.
  //   AI TC at (30, 20) covers (30..33, 20..23)
  //   blacksmith (24,12) 3x3 → (24..26, 12..14)
  //   archery    (28,12) 3x3 → (28..30, 12..14)
  //   stable     (32,12) 3x3 → (32..34, 12..14)
  //   market     (36,12) 4x4 → (36..39, 12..15)
  //   barracks   (24,16) 3x3 → (24..26, 16..18)
  //   monastery  (28,16) 2x2 → (28..29, 16..17)
  //   siege-wks  (24,25) 3x3 → (24..26, 25..27)
  const villagerSpawns: ScenarioSpawnSpec[] = [];
  for (let i = 0; i < 42; i += 1) {
    // Pack villagers in two rows below the TC, well outside building
    // footprints. Cells (40..49, 20..27).
    villagerSpawns.push({
      kind: 'villager',
      x: 40 + (i % 10),
      y: 20 + Math.floor(i / 10),
      owner: 2,
      baseOwner: 2,
      vision: { playerId: 2, radius: 4 },
      requiresSafeSpawn: true,
    });
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'imperial-age',
        startingResources: { food: 2000, wood: 2000, gold: 2000, stone: 2000 },
        difficulty: 'standard',
        // 50-tick countdown so the Wonder-victory path resolves inside
        // the test's 5000-tick budget.
        wonderCountdownOverrideTicks: 50,
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // Castle-Age + Imperial-Age production buildings already up so
      // pickNextBuildTarget has nothing left to pursue, leaving the
      // Wonder branch as the next build target.
      { kind: 'blacksmith', x: 24, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'archery-range', x: 28, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'stable', x: 32, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'market', x: 36, y: 12, owner: 2, baseOwner: 2 },
      { kind: 'barracks', x: 24, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'monastery', x: 28, y: 16, owner: 2, baseOwner: 2 },
      { kind: 'siege-workshop', x: 24, y: 25, owner: 2, baseOwner: 2 },
      // mill / lumber / mining-camps so the AI doesn't try to build
      // them as competing targets.
      { kind: 'mill', x: 28, y: 25, owner: 2, baseOwner: 2 },
      { kind: 'lumber-camp', x: 37, y: 17, owner: 2, baseOwner: 2 },
      { kind: 'mining-camp', x: 37, y: 21, owner: 2, baseOwner: 2 },
      ...villagerSpawns,
    ],
  };
}

// FU4: AI Monk-relic fixture. The AI starts with a Monastery + a
// single Monk, with a free neutral relic placed just inside the
// Monk's vision. Verifies the pickup-then-deposit chain.
function createAiMonkRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'castle-age',
        startingResources: { food: 200, wood: 200, gold: 200, stone: 200 },
        difficulty: 'standard',
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'villager', x: 6, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
      { kind: 'town-center', x: 2, y: 2, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      { kind: 'monastery', x: 27, y: 22, owner: 2, baseOwner: 2 },
      { kind: 'monk', x: 28, y: 26, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 9 } },
      // Neutral relic close to the Monk so the pickup path completes
      // within the test budget.
      { kind: 'relic', x: 30, y: 26, owner: null, baseOwner: null, amount: 0 },
    ],
  };
}

// Slice 10: AI scouting-response fixture. An enemy scout starts close
// to the AI base so the scouting-response path triggers quickly. The
// AI already owns a Blacksmith (Watch Tower prerequisite) and starts
// with enough stone to build one immediately.
function createAiScoutingResponseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 8 } },
      {
        owner: 2,
        townCenter: { x: 30, y: 20 },
        startingAge: 'feudal-age',
        startingResources: { food: 500, wood: 500, gold: 200, stone: 500 },
      },
    ],
    spawns: [
      { kind: 'town-center', x: 8, y: 8, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
      { kind: 'town-center', x: 30, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
      // AI villagers so the Watch Tower has a builder available.
      { kind: 'villager', x: 28, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      { kind: 'villager', x: 29, y: 20, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
      // Slice 12 Task B: TC at (30, 20) covers (30..33, 20..23), so
      // the old Blacksmith at (32, 20) and Barracks at (34, 20) both
      // collided with the TC footprint. Moved both buildings west of
      // the TC so they are adjacent but not overlapping.
      { kind: 'barracks', x: 34, y: 24, owner: 2, baseOwner: 2 },
      { kind: 'blacksmith', x: 26, y: 21, owner: 2, baseOwner: 2 },
      // Human scout positioned inside the AI's base vision but south
      // of the Town Center so the Watch Tower anchor ends up south as
      // well.
      { kind: 'scout', x: 28, y: 24, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 6 } },
    ],
  };
}

// Slice 10: Difficulty-gap fixture. Two AI players on opposite sides of
// the map with identical starting resources and villagers. Owner 1 is
// `'easy'` — wait, owner 1 is the human player slot. To keep both
// sides as AI (so the gather-multiplier applies to both), we use
// owners 2 and 3 and omit owner 1 from the scenario. The bridge skips
// the HUMAN_PLAYER_ID bootstrap for any start that doesn't list owner
// 1, so only the two AI players run.
function createAiDifficultyFixture(seed: string): PrototypeScenario {
  // Measures gather-rate delta between an easy AI (owner 2) and a hard
  // AI (owner 3). Owner 1 (HUMAN_PLAYER_ID) gets a minimal TC + villager
  // purely to keep the conquest-outcome system alive — the test never
  // interacts with it. Villagers placed right next to the sheep so the
  // first drop-off happens within a few ticks. Lots of starting wood so
  // both AIs can afford their initial Barracks placement without
  // touching food.
  const spawns: ScenarioSpawnSpec[] = [
    // Minimal owner-1 presence — the `prototypeConquestOutcome` system
    // short-circuits to 'defeat' if the human has no presence, which
    // would halt simulation before the AIs have a chance to gather.
    { kind: 'town-center', x: 28, y: 16, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 7 } },
    { kind: 'villager', x: 26, y: 16, owner: 1, baseOwner: 1, vision: { playerId: 1, radius: 4 } },
    { kind: 'town-center', x: 8, y: 8, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 7 } },
    { kind: 'villager', x: 7, y: 6, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
    { kind: 'villager', x: 8, y: 6, owner: 2, baseOwner: 2, vision: { playerId: 2, radius: 4 } },
    { kind: 'town-center', x: 50, y: 28, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 7 } },
    { kind: 'villager', x: 49, y: 26, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 4 } },
    { kind: 'villager', x: 50, y: 26, owner: 3, baseOwner: 3, vision: { playerId: 3, radius: 4 } },
    // Sheep directly adjacent to the villager cluster so the first
    // gather → drop-off cycle is only a couple of ticks long.
    { kind: 'sheep', x: 7, y: 5, owner: null, baseOwner: 2, amount: 500 },
    { kind: 'sheep', x: 8, y: 5, owner: null, baseOwner: 2, amount: 500 },
    { kind: 'sheep', x: 49, y: 25, owner: null, baseOwner: 3, amount: 500 },
    { kind: 'sheep', x: 50, y: 25, owner: null, baseOwner: 3, amount: 500 },
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 28, y: 16 } },
      {
        owner: 2,
        townCenter: { x: 8, y: 8 },
        difficulty: 'easy',
        // Plenty of wood so the Barracks build-order hit doesn't
        // starve the AI into an all-food focus. Lots of starting food
        // too so the test can cleanly measure GATHERED food without
        // it being masked by food SPENT on training / age-up.
        startingResources: { food: 100, wood: 1000, gold: 100, stone: 100 },
      },
      {
        owner: 3,
        townCenter: { x: 50, y: 28 },
        difficulty: 'hard',
        startingResources: { food: 100, wood: 1000, gold: 100, stone: 100 },
      },
    ],
    spawns,
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
        // Slice 12 Task B: deliberate overlap — the UX test needs a
        // house + militia + sheep stacked on one cell so the tile-
        // selection-cycle can iterate through all three. Opt out of
        // the fixture validator via `allowOverlappingSpawn` on each.
        kind: 'house',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
        allowOverlappingSpawn: true,
      },
      {
        kind: 'militia',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
        allowOverlappingSpawn: true,
      },
      {
        kind: 'sheep',
        x: FIXTURE_STACK_POSITION.x,
        y: FIXTURE_STACK_POSITION.y,
        owner: null,
        baseOwner: 1,
        amount: 100,
        allowOverlappingSpawn: true,
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

// Slice 12 Task B: minimal all-grass fixtures for the scenario-validation
// pass. Each seed wires in exactly one mistake; the `-ok-fixture` variant
// is the positive control. The `starts` entry is required because the
// bridge's score + age helpers key on it, but the minimal single-TC
// human-only setup is enough to test the validator.
function createScenarioValidationFixture(seed: string): PrototypeScenario {
  const baseSpawns: ScenarioSpawnSpec[] = [
    {
      kind: 'town-center',
      x: 4,
      y: 4,
      owner: 1,
      baseOwner: 1,
      vision: { playerId: 1, radius: 7 },
    },
  ];

  switch (seed) {
    case 'slice12-validation-ok-fixture':
      break;
    case 'slice12-validation-out-of-bounds-fixture':
      // A 4x4 Town Center anchored at x = MAP_WIDTH - 1 extends past
      // the right edge (x = MAP_WIDTH + 2).
      baseSpawns.push({
        kind: 'town-center',
        x: MAP_WIDTH - 1,
        y: 5,
        owner: 2,
        baseOwner: 2,
      });
      break;
    case 'slice12-validation-overlap-fixture':
      // A 2x2 house placed inside the human TC's 4x4 footprint (TC
      // covers x=[4,7], y=[4,7]; house at (5,5) covers x=[5,6], y=[5,6]).
      baseSpawns.push({
        kind: 'house',
        x: 5,
        y: 5,
        owner: 1,
        baseOwner: 1,
      });
      break;
    case 'slice12-validation-unit-in-building-fixture':
      // A Spearman anchored at (5, 5) sits inside the TC footprint with
      // no `requiresSafeSpawn` escape. Validation should catch that the
      // unit cannot legally live inside a building.
      baseSpawns.push({
        kind: 'spearman',
        x: 5,
        y: 5,
        owner: 1,
        baseOwner: 1,
      });
      break;
    case 'slice12-validation-resource-on-building-fixture':
      // Gold mine placed on a town-center footprint cell.
      baseSpawns.push({
        kind: 'gold-mine',
        x: 5,
        y: 5,
        owner: null,
        baseOwner: null,
        amount: 500,
      });
      break;
    default:
      // Unknown validation seed — fall through to the ok scenario so
      // the switch is exhaustive at runtime.
      break;
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
      },
    ],
    spawns: baseSpawns,
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

// Slice 7D fixture: Imperial-Age human with a completed Siege Workshop plus
// one pre-existing Mangonel, Scorpion, and Battering Ram. Exercises the
// three Imperial Siege Workshop upgrades (Onager / Heavy Scorpion / Siege
// Ram), the Bombard Cannon train menu, and the "Bombard Cannon does not
// mutate existing siege" regression.
function createImperialSiegeFixture(seed: string): PrototypeScenario {
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
        // FU1: Bombard Cannon training now gates on Chemistry research.
        // This fixture asserts "bombard-cannon is in the Siege Workshop
        // train menu at Imperial Age"; starting with Chemistry researched
        // keeps that assertion honest without requiring the test to
        // research Chemistry first.
        startingResearchedTechnologies: ['chemistry'],
        startingResources: {
          food: 3000,
          wood: 3000,
          gold: 3000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'siege-workshop',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        // Slice 12 Task B: moved from (*, 10) (inside TC footprint).
        kind: 'mangonel',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'scorpion',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'battering-ram',
        x: 14,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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

// Slice 7E fixture: Imperial-Age human with a completed Blacksmith plus a
// spread of units that exercise each Imperial Blacksmith tech bucket —
// Arbalest (archer / Bracer), Champion (melee / Blast Furnace),
// Halberdier (infantry / Plate Mail Armor), Cavalier (cavalry / Plate
// Barding). Also ships the base-tier predecessors so "before / after"
// stat checks land on the same fixture. Starting resources are generous
// so every research in a single test completes without an economy drip.
function createImperialBlacksmithFixture(seed: string): PrototypeScenario {
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
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 32, y: 8 },
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
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
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
        // Slice 12 Task B: moved from (*, 10) (inside TC footprint).
        kind: 'arbalest',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'halberdier',
        x: 14,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'cavalier',
        x: 16,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 32,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU1 fixture: Imperial-Age human with a completed Blacksmith + Barracks +
// Archery Range + Stable + Siege Workshop so every tier of every Blacksmith
// tech can be researched from one bridge without age climbing or sibling-
// building construction. Ships one representative of each Blacksmith bucket
// on the map (Archer for archer-line, Militia for melee, Spearman for
// infantry armor, Knight for cavalry armor, plus a Halberdier and Champion
// for multi-tier stacking checks). Starting resources are generous so
// every research completes without an economy drip.
function createBlacksmithProgressionFixture(seed: string): PrototypeScenario {
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
          food: 8000,
          wood: 1000,
          gold: 8000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'blacksmith',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
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
        kind: 'siege-workshop',
        x: 24,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'militia',
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'spearman',
        x: 14,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'knight',
        x: 16,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'halberdier',
        x: 18,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'champion',
        x: 20,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
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

// FU1 fixture: a Champion (player 1) standing next to an enemy Halberdier
// (player 2). Used to verify armor damage reduction: a Champion hitting
// an unarmored Halberdier lands base damage; with Plate Mail armor
// researched on player 2 the Halberdier takes exactly one less point
// per hit. Both players start in Imperial Age with a Blacksmith so tests
// can research Plate Mail on either side. Sides are isolated on a bare
// grass map so neither TC interferes with the melee exchange.
function createChampionVsHalberdierFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 54, y: 30 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
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
        kind: 'champion',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'halberdier',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 54,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU1 fixture: same as champion-vs-halberdier but with Plate Mail Armor
// pre-researched on the defending player-2 Halberdier's side. Lets the
// armor-reduces-damage test assert a one-point reduction in a single
// bridge-boot without waiting for Plate Mail to complete research.
function createChampionVsArmoredHalberdierFixture(seed: string): PrototypeScenario {
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
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 54, y: 30 },
        startingAge: 'imperial-age',
        // Pre-research Plate Mail so the Halberdier starts with +1 armor.
        startingResearchedTechnologies: ['plate-mail-armor'],
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
        kind: 'champion',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
      },
      {
        kind: 'halberdier',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 54,
        y: 30,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU2 fixture: two Imperial-Age players, one Barracks + one Militia each,
// with enough resources to research every militia-line upgrade (man-at-arms
// → long-swordsman → two-handed-swordsman → champion) back-to-back. Both
// sides sit far apart on a bare grass map so combat does not interfere
// with the research cadence.
function createMilitiaLineFixture(seed: string): PrototypeScenario {
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
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 28 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
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
        x: 12,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'barracks',
        x: 42,
        y: 26,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'militia',
        x: 44,
        y: 33,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// FU2 fixture: Imperial-Age player 1 with a Stable + Knight + Camel so both
// the Paladin upgrade (Knight → Cavalier → Paladin) and the Heavy Camel
// upgrade (Camel → Heavy Camel) can be exercised. The player-2 TC sits
// far from the action so no auto-combat fires during the research
// cadence; the Heavy Camel anti-cavalry bonus is exercised in the
// separate `heavy-camel-vs-knight-fixture` below.
function createPaladinFixture(seed: string): PrototypeScenario {
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
          food: 8000,
          wood: 500,
          gold: 8000,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 8 },
        startingAge: 'imperial-age',
        startingResources: {
          food: 4000,
          wood: 500,
          gold: 4000,
          stone: 200,
        },
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
        kind: 'knight',
        x: 14,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'camel',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU2 fixture: a pre-upgraded player-1 Heavy Camel placed adjacent to a
// player-2 Knight so the anti-cavalry +9 bonus fires on the first hit.
// Spawning Heavy Camel directly (rather than upgrading at runtime) keeps
// the test a single tick away from verifying bonus damage and sidesteps
// long-path-and-survive issues seen when the Heavy Camel had to close
// the gap across the map during research.
function createHeavyCamelVsKnightFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 28 },
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
        kind: 'heavy-camel',
        x: 20,
        y: 18,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'knight',
        x: 22,
        y: 18,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 28,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU3 fixture: player-1 Castle with a single enemy Champion at Castle
// anchor-to-target distance 8 (within range 8). Used as the no-archer
// baseline — the Castle fires 1 arrow per reload.
function createFu3CastleNoArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
      // Champion at (20, 8). Closest Castle footprint cell is (17, 8),
      // distance 3 — well within range 8. Champion HP 70, 0 armor, so
      // one 11-damage arrow drops it to 59.
      {
        kind: 'champion',
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

// FU3 fixture: player-1 Castle + 3 adjacent archers waiting to garrison.
// The test drives them into the Castle via `issueContextCommandAtEntity`
// and verifies the 3-archer extra-arrows bonus brings the total to 4
// arrows per reload.
function createFu3CastleThreeArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
      // 3 archers adjacent to the Castle's south edge — ready to garrison
      // via the issueContextCommandAtEntity(castle) flow.
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
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

// FU3 fixture: same as three-archers but with 5 archers — verifies the
// 5-arrow cap holds (1 base + 4 archer bonus, not 1 + 5).
function createFu3CastleFiveArchersFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
      {
        kind: 'archer',
        x: 14,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 15,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 16,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 17,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'archer',
        x: 18,
        y: 11,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 5 },
      },
      {
        kind: 'champion',
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

// FU3 fixture: Castle anchored at (6, 6), 4x4, with an enemy Spearman at
// (14, 8). Anchor-to-target Manhattan distance is |14-6| + |8-6| = 10.
// Closest footprint cell is (9, 8) at distance 5. Pre-FU3 the Castle
// ignored this target (distance 10 > range 8); post-FU3 it fires.
function createFu3CastleEdgeRangeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 2, y: 2 },
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
        x: 2,
        y: 2,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'castle',
        x: 6,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'spearman',
        x: 14,
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

// FU3 fixture: Feudal-Age human with a completed Barracks so the
// villager build options include palisade-wall. Mirrors the
// `fu3-stone-wall-fixture` layout but without the Castle-Age age-up.
function createFu3PalisadeWallFixture(seed: string): PrototypeScenario {
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
        startingResources: { food: 250, wood: 250, gold: 250, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 48, y: 28 },
        startingAge: 'feudal-age',
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
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
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

// FU3 fixture: Castle-Age human + idle villager so the stone-wall build
// option is exposed in the villager's buildOptions selection state.
function createFu3StoneWallFixture(seed: string): PrototypeScenario {
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
        startingResources: { food: 500, wood: 500, gold: 500, stone: 500 },
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
        kind: 'villager',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
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

// FU3 fixture: Castle-Age human, idle villager adjacent to a pre-built
// stone-wall. Used to confirm the wall blocks unit pathing (issueMove
// into the wall cell must be rejected).
function createFu3StoneWallBlockingFixture(seed: string): PrototypeScenario {
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
        kind: 'stone-wall',
        x: 18,
        y: 18,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: 18,
        y: 20,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
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

// FU3 fixture: pre-built stone-wall + enemy Battering Ram adjacent so
// the ram attacks the wall down. Wall starts with a low HP override so
// the test resolves in a handful of ticks without simulating a full
// 2000-HP takedown.
function createFu3StoneWallCombatFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 48, y: 28 },
        startingAge: 'imperial-age',
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
        kind: 'stone-wall',
        x: 20,
        y: 20,
        owner: 1,
        baseOwner: 1,
        startHp: 50,
      },
      // Enemy Battering Ram one cell south of the wall. Ram atk 2 + 75
      // vs buildings = 77 per hit, so one reload cycle kills the 50-HP
      // wall segment.
      {
        kind: 'battering-ram',
        x: 20,
        y: 21,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 5 },
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

// Slice 7D fixture: Imperial Onager placed inside its own min-range 3 of an
// enemy Spearman. Mirrors the Mangonel min-range fixture to verify the
// Onager inherits the same dead-zone behavior.
function createOnagerMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
        // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
        kind: 'onager',
        x: 10,
        y: 13,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 2 — inside the Onager's min range of 3.
      // Slice 12 Task B: radius-1 vision so the enemy AI does not spot
      // the Onager and walk the Spearman in to melee it (see
      // mangonel-min-range-blocked-fixture for the same reason).
      {
        kind: 'spearman',
        x: 12,
        y: 13,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 1 },
      },
    ],
  };
}

// Slice 7D fixture: player-1 Bombard Cannon placed at distance 10 from an
// enemy Town Center (inside max-range 12, outside min-range 5). Used to
// assert Bombard Cannon carries a +80 anti-building bonus. A TC with a
// low startHp (200) dies in two hits of 40 base + 80 bonus = 120 each.
function createBombardCannonVsBuildingFixture(seed: string): PrototypeScenario {
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
        kind: 'bombard-cannon',
        x: 14,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

// Slice 7D fixture: player-1 Bombard Cannon with an enemy Spearman inside
// its min-range 5 dead-zone. Used to assert the Bombard Cannon holds fire
// at close range.
function createBombardCannonMinRangeBlockedFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
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
        kind: 'bombard-cannon',
        x: 14,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 13 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Spearman at distance 3 — inside the Bombard Cannon's min range of 5.
      {
        kind: 'spearman',
        x: 17,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 3 },
      },
    ],
  };
}

// Slice 7D fixture: player-1 Castle in Imperial Age to test the Trebuchet
// train menu. Britons and non-Britons players each have a Castle so both
// trees can be asserted separately.
function createImperialCastleFixture(seed: string): PrototypeScenario {
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
        civilization: 'Britons',
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
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
        kind: 'castle',
        x: 14,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 11 },
      },
      {
        kind: 'town-center',
        x: 40,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'castle',
        x: 34,
        y: 14,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 11 },
      },
    ],
  };
}

// Slice 7D fixture: player-1 Siege Ram next to an enemy Town Center. Used
// to assert the Siege Ram carries a +250 anti-building bonus — a Town Center
// with a low startHp (200) is destroyed in a single hit. Vision is widened
// from the Ram's canonical 3 so the enemy building is visible for the
// command to resolve.
function createSiegeRamVsBuildingFixture(seed: string): PrototypeScenario {
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
        kind: 'siege-ram',
        x: 22,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 24,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        startHp: 200,
      },
    ],
  };
}

// FU7 fixture: player-1 Trebuchet sitting far from any enemy. Used to
// assert a freshly-placed Trebuchet is packed by default and can move
// without paying the pack transition cost.
function createTrebuchetPackFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 8 },
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
        kind: 'trebuchet',
        x: 12,
        y: 14,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 50,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU7 fixture: player-1 Trebuchet already inside its 16-tile range of a
// low-HP enemy Town Center. Used to prove the Trebuchet auto-unpacks
// over the ~50-tick transition before firing, and that once unpacked a
// fresh move order resumes the pack transition before walking away.
// Player 2 keeps a second Town Center far off-map so destroying the
// near one does not trigger a conquest victory — we need the match
// still running for the post-unpack move-command observation.
function createTrebuchetVsBuildingFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 50, y: 25 },
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
        kind: 'trebuchet',
        x: 15,
        y: 8,
        owner: 1,
        baseOwner: 1,
        // Wide vision so the enemy TC is already visible when the
        // attack command lands.
        vision: { playerId: 1, radius: 18 },
      },
      {
        kind: 'town-center',
        x: 20,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
        // Low HP so one Trebuchet shot (attack 7 + 200 anti-building
        // bonus = 207) is guaranteed to kill it.
        startHp: 200,
      },
      // Second player-2 Town Center far from the action so conquest
      // does not fire when the near TC is destroyed.
      {
        kind: 'town-center',
        x: 50,
        y: 25,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with no Wonder yet. Used to assert
// the villager build menu exposes 'wonder' once the Imperial gate is
// satisfied.
function createWonderImperialFixture(seed: string): PrototypeScenario {
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
        // Plenty of resources to queue a Wonder placement test.
        startingResources: {
          food: 2000,
          wood: 2000,
          gold: 2000,
          stone: 2000,
        },
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        kind: 'villager',
        x: 6,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 4 },
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a completed Wonder AND a
// villager. Used to assert the one-Wonder-per-owner cap — the villager's
// build options should not include 'wonder' even in Imperial Age.
function createWonderExistingFixture(seed: string): PrototypeScenario {
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
        // Countdown override that is longer than the vitest runs, so the
        // test can observe the build-options gate without the match
        // ending mid-assertion.
        wonderCountdownOverrideTicks: 100000,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        kind: 'wonder',
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
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a completed Wonder and a
// countdown override of 10 ticks. Used for the Wonder-victory test so
// the countdown resolves quickly.
function createWonderShortCountdownFixture(seed: string): PrototypeScenario {
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
        wonderCountdownOverrideTicks: 10,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        kind: 'wonder',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a Wonder at very low HP and a
// short countdown override. An enemy Siege Ram is stationed adjacent to
// the Wonder so it is destroyed before the countdown can expire, proving
// the destruction-resets-countdown rule.
function createWonderDestroyedFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 12 },
        startingAge: 'imperial-age',
        // Long enough that destruction happens well before the countdown
        // would naturally expire, so if destruction-reset fails we see a
        // Wonder victory for player 1 mid-test (deterministic failure
        // mode). 30 ticks is roughly 3x what the Siege Ram needs.
        wonderCountdownOverrideTicks: 60,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 12 },
        startingAge: 'imperial-age',
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 6,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'wonder',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
        // Wonder starts with 4 HP so one militia swing finishes it. The
        // long 60-tick countdown gives the militia time to close, engage,
        // and swing before the countdown would naturally expire.
        startHp: 4,
      },
      {
        kind: 'militia',
        x: 18,
        y: 7,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 10 },
      },
      {
        kind: 'town-center',
        x: 28,
        y: 12,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: player-1 Monastery pre-loaded with every relic (and
// zero live relics on the map). Relic countdown override is set to 10
// ticks so the victory fires quickly.
function createRelicShortCountdownFixture(seed: string): PrototypeScenario {
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
        relicCountdownOverrideTicks: 10,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        x: 12,
        y: 6,
        owner: 1,
        baseOwner: 1,
        startingRelicsInMonastery: 3,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// Slice 8 fixture: player-1 Monastery with 2 relics, plus a live neutral
// relic on the map. Player 1 does NOT hold every relic, so the relic
// countdown must never complete even with an aggressive override.
function createRelicNotAllHeldFixture(seed: string): PrototypeScenario {
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
        relicCountdownOverrideTicks: 10,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        x: 12,
        y: 6,
        owner: 1,
        baseOwner: 1,
        startingRelicsInMonastery: 2,
      },
      {
        kind: 'relic',
        x: 20,
        y: 12,
        owner: null,
        baseOwner: null,
        amount: 0,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU7 fixture: player-1 simultaneously races a Wonder countdown and a
// Relic countdown — both with the same 10-tick override — so they hit
// zero on the same tick. The explicit `lastCompletedTick` resolver must
// pick Wonder (stable tie-break documented in the spec). Without the
// resolver the outcome depends on system-registration order, which is
// exactly the implicitness this follow-up removes.
function createWonderRelicTieFixture(seed: string): PrototypeScenario {
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
        wonderCountdownOverrideTicks: 10,
        relicCountdownOverrideTicks: 10,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
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
        kind: 'wonder',
        x: 14,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'monastery',
        x: 4,
        y: 12,
        owner: 1,
        baseOwner: 1,
        // Pre-loaded with every relic so the Relic countdown kicks off
        // on tick 0 alongside the Wonder's countdown.
        startingRelicsInMonastery: 3,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}

// FU7 fixture: player-1 (human) has a Monk ready to convert a player-2
// villager that sits adjacent to a player-2 Wonder. The Wonder's
// countdown override is huge so the match stays running well past the
// ~50-tick conversion window. Used to pin the rule that Wonder
// ownership lives on the Wonder building — a converted villager cannot
// flip the Wonder away from the original owner, and the countdown
// keeps ticking normally.
function createWonderOwnerAfterConversionFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 40, y: 8 },
        startingAge: 'imperial-age',
        // Generous countdown so the match stays running for the
        // entire convert-and-observe window.
        wonderCountdownOverrideTicks: 5000,
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
        x: 20,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 9 },
      },
      {
        kind: 'wonder',
        x: 22,
        y: 6,
        owner: 2,
        baseOwner: 2,
      },
      {
        kind: 'villager',
        x: 22,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
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

  if (seed === 'imperial-castle-britons-fixture') {
    return createImperialCastleBritonsFixture(seed);
  }

  if (seed === 'imperial-castle-franks-fixture') {
    return createImperialCastleFranksFixture(seed);
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

  if (seed === 'imperial-siege-fixture') {
    return createImperialSiegeFixture(seed);
  }

  if (seed === 'imperial-blacksmith-fixture') {
    return createImperialBlacksmithFixture(seed);
  }

  if (seed === 'blacksmith-progression-fixture') {
    return createBlacksmithProgressionFixture(seed);
  }

  if (seed === 'champion-vs-halberdier-fixture') {
    return createChampionVsHalberdierFixture(seed);
  }

  if (seed === 'champion-vs-armored-halberdier-fixture') {
    return createChampionVsArmoredHalberdierFixture(seed);
  }

  if (seed === 'militia-line-fixture') {
    return createMilitiaLineFixture(seed);
  }

  if (seed === 'paladin-fixture') {
    return createPaladinFixture(seed);
  }

  if (seed === 'heavy-camel-vs-knight-fixture') {
    return createHeavyCamelVsKnightFixture(seed);
  }

  if (seed === 'fu3-castle-no-archers-fixture') {
    return createFu3CastleNoArchersFixture(seed);
  }

  if (seed === 'fu3-castle-three-archers-fixture') {
    return createFu3CastleThreeArchersFixture(seed);
  }

  if (seed === 'fu3-castle-five-archers-fixture') {
    return createFu3CastleFiveArchersFixture(seed);
  }

  if (seed === 'fu3-castle-edge-range-fixture') {
    return createFu3CastleEdgeRangeFixture(seed);
  }

  if (seed === 'fu3-stone-wall-fixture') {
    return createFu3StoneWallFixture(seed);
  }

  if (seed === 'fu3-stone-wall-blocking-fixture') {
    return createFu3StoneWallBlockingFixture(seed);
  }

  if (seed === 'fu3-stone-wall-combat-fixture') {
    return createFu3StoneWallCombatFixture(seed);
  }

  if (seed === 'fu3-palisade-wall-fixture') {
    return createFu3PalisadeWallFixture(seed);
  }

  if (seed === 'onager-min-range-blocked-fixture') {
    return createOnagerMinRangeBlockedFixture(seed);
  }

  if (seed === 'siege-ram-vs-building-fixture') {
    return createSiegeRamVsBuildingFixture(seed);
  }

  if (seed === 'bombard-cannon-vs-building-fixture') {
    return createBombardCannonVsBuildingFixture(seed);
  }

  if (seed === 'bombard-cannon-min-range-blocked-fixture') {
    return createBombardCannonMinRangeBlockedFixture(seed);
  }

  if (seed === 'imperial-castle-fixture') {
    return createImperialCastleFixture(seed);
  }

  if (seed === 'trebuchet-pack-fixture') {
    return createTrebuchetPackFixture(seed);
  }

  if (seed === 'trebuchet-vs-building-fixture') {
    return createTrebuchetVsBuildingFixture(seed);
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

  if (seed === 'wonder-imperial-fixture') {
    return createWonderImperialFixture(seed);
  }

  if (seed === 'wonder-existing-fixture') {
    return createWonderExistingFixture(seed);
  }

  if (seed === 'wonder-short-countdown-fixture') {
    return createWonderShortCountdownFixture(seed);
  }

  if (seed === 'wonder-destroyed-fixture') {
    return createWonderDestroyedFixture(seed);
  }

  if (seed === 'relic-short-countdown-fixture') {
    return createRelicShortCountdownFixture(seed);
  }

  if (seed === 'relic-not-all-held-fixture') {
    return createRelicNotAllHeldFixture(seed);
  }

  if (seed === 'wonder-relic-tie-fixture') {
    return createWonderRelicTieFixture(seed);
  }

  if (seed === 'wonder-owner-after-conversion-fixture') {
    return createWonderOwnerAfterConversionFixture(seed);
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

  if (seed === 'ai-planner-fixture') {
    return createAiPlannerFixture(seed);
  }

  if (seed === 'ai-scouting-response-fixture') {
    return createAiScoutingResponseFixture(seed);
  }

  if (seed === 'ai-difficulty-fixture') {
    return createAiDifficultyFixture(seed);
  }

  if (seed === 'ai-monk-fixture') {
    return createAiMonkFixture(seed);
  }

  if (seed === 'ai-monk-heal-fixture') {
    return createAiMonkHealFixture(seed);
  }

  if (seed === 'ai-monk-relic-fixture') {
    return createAiMonkRelicFixture(seed);
  }

  if (seed === 'ai-wonder-fixture') {
    return createAiWonderFixture(seed);
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

  // Slice 11: alternate playable maps. Both share the default
  // two-player layout (same starts, same resource patches near each
  // base) so existing code paths work identically; only terrain differs.
  if (seed === 'black-forest-fixture' || seed === 'black-forest') {
    return createBlackForestMap(seed);
  }

  if (seed === 'arena-fixture' || seed === 'arena') {
    return createArenaMap(seed);
  }

  // Slice 12 Task B: scenario-validation fixtures. Each seed here is a
  // minimal scenario designed to exercise one failure mode of the new
  // bridge-boot validation pass. The `-ok-fixture` seed is the positive
  // control (no overlaps, no out-of-bounds, no wedged units).
  if (
    seed === 'slice12-validation-ok-fixture'
    || seed === 'slice12-validation-out-of-bounds-fixture'
    || seed === 'slice12-validation-overlap-fixture'
    || seed === 'slice12-validation-unit-in-building-fixture'
    || seed === 'slice12-validation-resource-on-building-fixture'
  ) {
    return createScenarioValidationFixture(seed);
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

// Slice 11: Black Forest-style map. Dense forest covers the map with
// carved-out pockets for each player start and a winding corridor
// between them. Deterministic on the seed so tests and fixtures agree.
// The standard resource patches near each Town Center are preserved so
// the opening 2-3 minutes of play feel like Arabia — the differentiator
// is the wall of trees across the rest of the map.
function createBlackForestMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'forest')),
  );

  const starts = createPlayerStarts();
  const spawns: ScenarioSpawnSpec[] = [];

  // Carve out a base pocket (grass) around each start so the Town Center,
  // villagers, and resource offsets all have valid terrain.
  const POCKET_RADIUS = 6;
  for (const start of starts) {
    paintDisc(terrain, start.townCenter, POCKET_RADIUS, 'grass');
  }

  // Carve a winding corridor between the two starts. The corridor steps
  // from one Town Center to the other one tile at a time; at each step
  // we paint a small disc of grass so the path is passable. The seed
  // drives a small vertical wiggle so the corridor isn't a dead straight
  // line — players on the same seed always get the same corridor.
  const [firstStart, secondStart] = starts;
  if (firstStart && secondStart) {
    const rng = createBlackForestWiggleRng(seed);
    const steps = 28;
    const dx = (secondStart.townCenter.x - firstStart.townCenter.x) / steps;
    const dy = (secondStart.townCenter.y - firstStart.townCenter.y) / steps;
    for (let step = 0; step <= steps; step += 1) {
      const baseX = Math.round(firstStart.townCenter.x + dx * step);
      const baseY = Math.round(firstStart.townCenter.y + dy * step);
      const wiggle = Math.floor(rng() * 3) - 1;
      paintDisc(terrain, { x: baseX, y: baseY + wiggle }, 2, 'grass');
    }
  }

  // Seed tree spawns inside the surviving forest cells so villagers have
  // something to chop. Every forest cell in the final terrain map gets a
  // tree, which matches how the base map builds `spawns` in lockstep
  // with terrain kind.
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (terrain[y][x].kind === 'forest') {
        spawns.push({
          kind: 'tree',
          x,
          y,
          owner: null,
          baseOwner: null,
          amount: 100,
        });
      }
    }
  }

  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts,
    spawns,
  };
}

// Slice 11: Arena-style map. Each start is ringed by a stone wall, with
// a gap on the side facing the map center so the player can break out.
// FU3: the ring is built from real `stone-wall` buildings (1x1, HP 2000,
// impassable, cost 5 stone). Pre-FU3 this used `stone-mine` nodes as a
// wall proxy — FU3 replaces that with the real wall type so the player
// breaches by attacking walls rather than mining them.
function createArenaMap(seed: string): PrototypeScenario {
  const terrain: TerrainCellSpec[][] = Array.from({ length: MAP_HEIGHT }, (_, y) =>
    Array.from({ length: MAP_WIDTH }, (_, x) => createTerrainCell(x, y, 'grass')),
  );

  const starts = createPlayerStarts();
  const spawns: ScenarioSpawnSpec[] = [];

  // Place the standard opening FIRST so we can skip ring cells that would
  // overlap a starting resource, villager, or scout. Bridge-boot fixture
  // validation rejects overlaps (Slice 12 Task B), and the pre-FU3 Arena
  // silently ate these because `stone-mine` wasn't a building.
  applyStandardPlayerOpening(terrain, starts, spawns, seed);

  const occupiedCells = new Set<string>();
  for (const spawn of spawns) {
    occupiedCells.add(`${spawn.x},${spawn.y}`);
  }

  const RING_INNER_RADIUS = 6;
  const RING_OUTER_RADIUS = 7;
  for (const start of starts) {
    const ringedCells = collectRingCells(
      start.townCenter,
      RING_INNER_RADIUS,
      RING_OUTER_RADIUS,
    );
    for (const cell of ringedCells) {
      // Small fixed gap on the side facing the map center so the player
      // has a single exit. Gap is deterministic per start (no seed
      // randomness) so the fixture reproduces the same shape each time.
      if (isCellInArenaGap(start.townCenter, cell)) {
        continue;
      }
      // Skip ring cells that would collide with starting resources,
      // villagers, or the scout. The gap in the wall guarantees at least
      // one exit, and the resource-overlap gaps are rare because the
      // starting patches fan out in pre-defined offset lists.
      if (occupiedCells.has(`${cell.x},${cell.y}`)) {
        continue;
      }
      spawns.push({
        kind: 'stone-wall',
        x: cell.x,
        y: cell.y,
        owner: start.owner,
        baseOwner: start.owner,
      });
    }
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

// Slice 11: helper shared by the alternate maps. Re-uses the default
// starting-resource / villager / scout patches so each map has the same
// economic baseline as Arabia. Everything is placed via the existing
// projectOffset + applyResourcePatch + applyForestPatch helpers, so the
// offset tables stay the single source of truth.
function applyStandardPlayerOpening(
  terrain: TerrainCellSpec[][],
  starts: PlayerStartSpec[],
  spawns: ScenarioSpawnSpec[],
  seed: string,
): void {
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

  // Keep a hint of the seed in the output so two different seeds never
  // produce identical scenarios. The shoreline-fish helper already hashes
  // the seed; we call it with deterministic candidates so the alternate
  // maps vary slightly too.
  applyShoreFishPatches(terrain, starts, seed, spawns);
}

// Simple deterministic RNG used by the Black Forest corridor wiggle.
// Keeps a dependency-free Park-Miller LCG so the corridor shape is
// reproducible from the seed alone.
function createBlackForestWiggleRng(seed: string): () => number {
  let state = seedToNumber(seed);
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}

// Arena ring helper. Collects every cell whose distance from the center
// sits between `innerRadius` and `outerRadius` inclusive. Iteration
// order is deterministic (row-major) so the spawn list is stable.
function collectRingCells(
  center: Position,
  innerRadius: number,
  outerRadius: number,
): Position[] {
  const inner2 = innerRadius * innerRadius;
  const outer2 = outerRadius * outerRadius;
  const cells: Position[] = [];
  for (let y = center.y - outerRadius; y <= center.y + outerRadius; y += 1) {
    for (let x = center.x - outerRadius; x <= center.x + outerRadius; x += 1) {
      if (!isInBounds(x, y)) {
        continue;
      }
      const dx = x - center.x;
      const dy = y - center.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < inner2 || d2 > outer2) {
        continue;
      }
      cells.push({ x, y });
    }
  }
  return cells;
}

// The Arena ring has a 2-cell-wide gap on the side of the ring that
// faces the map center. Determined by whether the cell sits in the
// direction of travel from `center` to the map midpoint.
function isCellInArenaGap(center: Position, cell: Position): boolean {
  const midX = MAP_WIDTH / 2;
  const midY = MAP_HEIGHT / 2;
  const dirX = Math.sign(midX - center.x);
  const dirY = Math.sign(midY - center.y);
  const dx = cell.x - center.x;
  const dy = cell.y - center.y;
  // 2-tile wide gap: cells whose dominant-direction offset aligns with
  // the exit vector AND whose orthogonal offset is within ±1.
  if (Math.abs(dx) > Math.abs(dy)) {
    return Math.sign(dx) === dirX && Math.abs(dy) <= 1;
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return Math.sign(dy) === dirY && Math.abs(dx) <= 1;
  }
  // Diagonal cell — include in the gap if both components line up.
  return Math.sign(dx) === dirX && Math.sign(dy) === dirY;
}
