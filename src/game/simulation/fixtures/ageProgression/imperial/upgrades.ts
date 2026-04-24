import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  createGrassFixtureTerrain,
} from '../../common';

export function createImperialUpgradesFixture(seed: string): PrototypeScenario {
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
export function createImperialArbalestFixture(seed: string): PrototypeScenario {
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
export function createImperialHalberdierFixture(seed: string): PrototypeScenario {
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

// Slice 7C fixture: Imperial-Age human with a completed Stable plus one
// pre-existing Light Cavalry (scout-line) and one pre-existing Knight
// (knight-line). Exercises the Hussar and Cavalier upgrades.
export function createImperialStableFixture(seed: string): PrototypeScenario {
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

// Slice 7E fixture: Imperial-Age human with a completed Blacksmith plus a
// spread of units that exercise each Imperial Blacksmith tech bucket —
// Arbalest (archer / Bracer), Champion (melee / Blast Furnace),
// Halberdier (infantry / Plate Mail Armor), Cavalier (cavalry / Plate
// Barding). Also ships the base-tier predecessors so "before / after"
// stat checks land on the same fixture. Starting resources are generous
// so every research in a single test completes without an economy drip.
export function createImperialBlacksmithFixture(seed: string): PrototypeScenario {
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

// Slice 7D fixture: Imperial-Age human with a completed Siege Workshop plus
// one pre-existing Mangonel, Scorpion, and Battering Ram. Exercises the
// three Imperial Siege Workshop upgrades (Onager / Heavy Scorpion / Siege
// Ram), the Bombard Cannon train menu, and the "Bombard Cannon does not
// mutate existing siege" regression.
export function createImperialSiegeFixture(seed: string): PrototypeScenario {
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
