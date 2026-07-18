import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../../../common';

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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('stable', 1, 16, 6),
      // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
      ownedSpawn('light-cavalry', 1, 10, 13, { vision: 6 }),
      ownedSpawn('knight', 1, 12, 13, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('blacksmith', 1, 4, 6),
      ownedSpawn('archery-range', 1, 12, 6),
      ownedSpawn('barracks', 1, 16, 6),
      ownedSpawn('stable', 1, 20, 6),
      // Slice 12 Task B: moved from (*, 10) (inside TC footprint).
      ownedSpawn('arbalest', 1, 10, 13, { vision: 5 }),
      ownedSpawn('champion', 1, 12, 13, { vision: 3 }),
      ownedSpawn('halberdier', 1, 14, 13, { vision: 3 }),
      ownedSpawn('cavalier', 1, 16, 13, { vision: 4 }),
      ownedSpawn('town-center', 2, 32, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('siege-workshop', 1, 14, 6),
      // Slice 12 Task B: moved from (*, 10) (inside TC footprint).
      ownedSpawn('mangonel', 1, 10, 13, { vision: 9 }),
      ownedSpawn('scorpion', 1, 12, 13, { vision: 9 }),
      ownedSpawn('battering-ram', 1, 14, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
