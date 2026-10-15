import type { Position } from 'civ-engine';

// Values from the map constants, types only from the scenario module: a test
// that imports this file first must not load the scenario registry, which
// imports this file back.
import { MAP_HEIGHT, MAP_WIDTH } from '../mapGeneration/constants';
import type { PrototypeScenario } from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 128 (defect register 2026-10-15): the Monks' relic play, on open grass.
//
// 'monk-carried-relic-fixture' is the player's. Its Monk stands beside a relic
// far from its Monastery, so carrying the relic home is a walk. Until work 128
// the carried relic claimed the Monk's own cell as a resource, so a Monk
// holding one could not walk anywhere (work 126 found the refusal). A villager
// stands nearby to test whether a relic dropped by its carrier still blocks
// its cell, as a relic on the ground does, and a second Monk stands by to pick
// a dropped relic up from the cell it stands on.
//
// 'ai-monk-known-relic-fixture' is the computer's: owner 1, whom the tests
// put under the AI with `forceAiForOwners`. Its Monk stands beside relic C,
// the nearest, and stores it first. A lookout villager stands beside relic A
// when the match is seeded, so A is explored ground. The test deletes the
// lookout before the first tick, so the seat never sees A again. Relic B lies
// where the seat has never been. Owner 2 takes no part: it has no AI, and its
// Town Center keeps it in the match.
//
// 'ai-missionary-known-relic-fixture' is the same ground with a Missionary in
// place of the Monk and a wounded Militia beside it. A Missionary cannot carry
// a relic, so the computer must send it to heal, never for a relic. Owner 2's
// villager keeps the AI's attack-group threshold in force, so the Militia stays.
export const MONK_CARRIED_RELIC_SEED = 'monk-carried-relic-fixture';
export const AI_MONK_KNOWN_RELIC_SEED = 'ai-monk-known-relic-fixture';
export const AI_MISSIONARY_KNOWN_RELIC_SEED = 'ai-missionary-known-relic-fixture';

/** The player's Monk, the relic beside it, its Monastery and its villager. */
export const CARRIED_MONK_CELL: Position = { x: 32, y: 10 };
export const CARRIED_RELIC_CELL: Position = { x: 33, y: 10 };
export const CARRIED_MONASTERY_CELL: Position = { x: 8, y: 24 };
export const CARRIED_VILLAGER_CELL: Position = { x: 28, y: 14 };
export const CARRIED_SECOND_MONK_CELL: Position = { x: 30, y: 12 };

/** The computer's Monk, its Monastery, and relic C beside the Monk. */
export const KNOWN_MONK_CELL: Position = { x: 20, y: 16 };
export const KNOWN_MONASTERY_CELL: Position = { x: 10, y: 14 };
export const KNOWN_NEAR_RELIC_CELL: Position = { x: 22, y: 16 };
/** Relic A, explored at the seed by the lookout beside it, and the lookout. */
export const KNOWN_EXPLORED_RELIC_CELL: Position = { x: 40, y: 8 };
export const KNOWN_LOOKOUT_CELL: Position = { x: 41, y: 10 };
/** Relic B, on ground no unit or building of owner 1 ever sees. */
export const KNOWN_UNSEEN_RELIC_CELL: Position = { x: 40, y: 30 };
/** The Missionary variant's wounded Militia: 10 of its 40 hit points. */
export const WOUNDED_MILITIA_CELL: Position = { x: 21, y: 18 };
export const WOUNDED_MILITIA_HP = 10;

// The Monk's line of sight is DE's 11 (units.csv); the villager's is 4.
const MONK_VISION = 11;
const VILLAGER_VISION = 4;

export function createMonkCarriedRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'castle-age' },
      { owner: 2, townCenter: { x: 52, y: 24 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('monastery', 1, CARRIED_MONASTERY_CELL.x, CARRIED_MONASTERY_CELL.y),
      ownedSpawn('monk', 1, CARRIED_MONK_CELL.x, CARRIED_MONK_CELL.y, { vision: MONK_VISION }),
      ownedSpawn('villager', 1, CARRIED_VILLAGER_CELL.x, CARRIED_VILLAGER_CELL.y, { vision: VILLAGER_VISION }),
      ownedSpawn('monk', 1, CARRIED_SECOND_MONK_CELL.x, CARRIED_SECOND_MONK_CELL.y, { vision: MONK_VISION }),
      gaiaSpawn('relic', CARRIED_RELIC_CELL.x, CARRIED_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('town-center', 2, 52, 24, { vision: 7 }),
    ],
  };
}

export function createAiMonkKnownRelicFixture(seed: string): PrototypeScenario {
  return knownRelicGround(seed, [
    ownedSpawn('monk', 1, KNOWN_MONK_CELL.x, KNOWN_MONK_CELL.y, { vision: MONK_VISION }),
  ]);
}

export function createAiMissionaryKnownRelicFixture(seed: string): PrototypeScenario {
  return knownRelicGround(seed, [
    ownedSpawn('missionary', 1, KNOWN_MONK_CELL.x, KNOWN_MONK_CELL.y, { vision: 9 }),
    ownedSpawn('militia', 1, WOUNDED_MILITIA_CELL.x, WOUNDED_MILITIA_CELL.y, { vision: 4, startHp: WOUNDED_MILITIA_HP }),
    ownedSpawn('villager', 2, 50, 22, { vision: VILLAGER_VISION }),
  ]);
}

function knownRelicGround(seed: string, monastics: PrototypeScenario['spawns']): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // Nothing to spend, so the AI trains and builds nothing: its Monastery's
      // units are all it plays.
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 52, y: 24 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('monastery', 1, KNOWN_MONASTERY_CELL.x, KNOWN_MONASTERY_CELL.y),
      ...monastics,
      gaiaSpawn('relic', KNOWN_NEAR_RELIC_CELL.x, KNOWN_NEAR_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('villager', 1, KNOWN_LOOKOUT_CELL.x, KNOWN_LOOKOUT_CELL.y, { vision: VILLAGER_VISION }),
      gaiaSpawn('relic', KNOWN_EXPLORED_RELIC_CELL.x, KNOWN_EXPLORED_RELIC_CELL.y, { amount: 0 }),
      gaiaSpawn('relic', KNOWN_UNSEEN_RELIC_CELL.x, KNOWN_UNSEEN_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('town-center', 2, 52, 24, { vision: 7 }),
    ],
  };
}
