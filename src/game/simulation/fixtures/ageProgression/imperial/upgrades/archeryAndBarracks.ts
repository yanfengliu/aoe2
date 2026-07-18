import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../../../common';

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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archery-range', 1, 12, 6),
      ownedSpawn('barracks', 1, 16, 6),
      ownedSpawn('stable', 1, 20, 6),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archery-range', 1, 12, 6),
      ownedSpawn('blacksmith', 1, 4, 6),
      // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
      ownedSpawn('crossbowman', 1, 10, 13, { vision: 5 }),
      ownedSpawn('cavalry-archer', 1, 12, 13, { vision: 5 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, 16, 6),
      // Slice 12 Task B: moved from (10, 10) (inside TC footprint).
      ownedSpawn('militia', 1, 10, 13, { vision: 3 }),
      ownedSpawn('pikeman', 1, 12, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

// Slice 7C fixture: Imperial-Age human with a completed Stable plus one
// pre-existing Light Cavalry (scout-line) and one pre-existing Knight
// (knight-line). Exercises the Hussar and Cavalier upgrades.
