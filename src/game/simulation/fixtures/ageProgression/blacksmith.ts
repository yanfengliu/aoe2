import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// FU1 fixture: Imperial-Age human with a completed Blacksmith + Barracks +
// Archery Range + Stable + Siege Workshop so every tier of every Blacksmith
// tech can be researched from one bridge without age climbing or sibling-
// building construction. Ships one representative of each Blacksmith bucket
// on the map (Archer for archer-line, Militia for melee, Spearman for
// infantry armor, Knight for cavalry armor, plus a Halberdier and Champion
// for multi-tier stacking checks). Starting resources are generous so
// every research completes without an economy drip.
export function createBlacksmithProgressionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('blacksmith', 1, 4, 6),
      ownedSpawn('archery-range', 1, 12, 6),
      ownedSpawn('barracks', 1, 16, 6),
      ownedSpawn('stable', 1, 20, 6),
      ownedSpawn('siege-workshop', 1, 24, 6),
      // v0.3.133: Chemistry researches at the University now.
      ownedSpawn('university', 1, 28, 6),
      ownedSpawn('archer', 1, 10, 13, { vision: 5 }),
      ownedSpawn('militia', 1, 12, 13, { vision: 3 }),
      ownedSpawn('spearman', 1, 14, 13, { vision: 3 }),
      ownedSpawn('knight', 1, 16, 13, { vision: 4 }),
      ownedSpawn('halberdier', 1, 18, 13, { vision: 3 }),
      ownedSpawn('champion', 1, 20, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}

// Iter-2 H2-1 regression: two Blacksmiths owned by player 1, plus one
// Militia to observe the Forging stat bump. Both Blacksmiths must
// accept a Forging research order so the test can exercise the
// double-research race; without an idempotency guard in
// applyTechnology, a player with two Blacksmiths gets +2 attack
// instead of +1 because the production-queue completion path fires
// twice.
export function createDoubleBlacksmithRaceFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('blacksmith', 1, 4, 6),
      ownedSpawn('blacksmith', 1, 16, 6),
      ownedSpawn('militia', 1, 12, 13, { vision: 3 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
