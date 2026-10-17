import type { Position } from 'civ-engine';

// Values from the map constants, types only from the scenario module: a test
// that imports this file first must not load the scenario registry, which
// imports this file back.
import { MAP_HEIGHT, MAP_WIDTH } from '../mapGeneration/constants';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';
import type { PrototypeScenario } from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// Work 128 (defect register 2026-10-15): the Monks' relic play, on open grass.
//
// 'monk-carried-relic-fixture' is the player's. Its Monk stands beside a relic
// far from its Monastery, so carrying the relic home is a walk. Until work 128
// the carried relic claimed the Monk's own cell as a resource, so a Monk
// holding one could not walk anywhere (work 126 found the refusal). A villager
// stands nearby to test that a relic dropped by its carrier blocks the cell it
// lands on, as a relic on the ground does, and a second Monk stands by to step
// onto the carrier's cell, or to try to take the relic from its hands. A Farm
// beside it is walkable ground a carrier can die on, where no relic may land.
//
// 'monk-relic-cross-owner-fixture' puts the player's Monk beside a relic and
// the computer's Monk six cells off, so both are sent for it and the player's
// gets it first: a Monk of either side must not take a relic from another's
// hands (review round 0, SF6).
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
// place of the Monk and a wounded Militia beside it. Current DE lets it carry
// relics too, so the computer fetches its known relics then heals. Owner 2's
// villager keeps the AI's attack-group threshold in force, so the Militia stays.
//
// 'ai-monk-unreachable-relic-fixture' sets the nearest relic the seat knows of
// in a lake: water on every cell within five of it, past a Monk's reach of
// four. A farther relic on open grass is the one the Monk can fetch. In the
// '-heal-' variant the lake relic is the only one, and a wounded Militia waits
// beside the Monk (review round 0, SF2: the reviewer's probes, made fixtures).
//
// 'ai-monk-ally-sight-relic-fixture' puts the computer in seat 3 and makes the
// player its ally. The player's villager stands beside relic A when the match
// is seeded, and the test deletes it before the first tick: the computer's
// seat has never explored A itself, its ally has, and nobody sees A. Allies
// share sight from the first frame in DE (humanSight.ts).
export const MONK_CARRIED_RELIC_SEED = 'monk-carried-relic-fixture';
export const MISSIONARY_CARRIED_RELIC_SEED = 'missionary-carried-relic-fixture';
export const MONK_RELIC_CROSS_OWNER_SEED = 'monk-relic-cross-owner-fixture';
export const AI_MONK_KNOWN_RELIC_SEED = 'ai-monk-known-relic-fixture';
export const AI_MISSIONARY_KNOWN_RELIC_SEED = 'ai-missionary-known-relic-fixture';
export const AI_MONK_UNREACHABLE_RELIC_SEED = 'ai-monk-unreachable-relic-fixture';
export const AI_MONK_UNREACHABLE_RELIC_HEAL_SEED = 'ai-monk-unreachable-relic-heal-fixture';
export const AI_MONK_ALLY_SIGHT_RELIC_SEED = 'ai-monk-ally-sight-relic-fixture';
export const AI_MONK_BLOCKED_MONASTERY_SEED = 'ai-monk-blocked-monastery-fixture';

/** The player's Monk, the relic beside it, its Monastery and its villager. */
export const CARRIED_MONK_CELL: Position = { x: 32, y: 10 };
export const CARRIED_RELIC_CELL: Position = { x: 33, y: 10 };
export const CARRIED_MONASTERY_CELL: Position = { x: 8, y: 24 };
export const CARRIED_VILLAGER_CELL: Position = { x: 28, y: 14 };
export const CARRIED_SECOND_MONK_CELL: Position = { x: 30, y: 12 };
/** A Farm of the player's, walkable, for a carrier to die on. */
export const CARRIED_FARM_CELL: Position = { x: 34, y: 12 };

/** The cross-owner fixture's Monks and relic. */
export const CROSS_PLAYER_MONK_CELL: Position = { x: 29, y: 16 };
export const CROSS_RELIC_CELL: Position = { x: 30, y: 16 };
export const CROSS_COMPUTER_MONK_CELL: Position = { x: 36, y: 16 };

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

/** The unreachable fixtures: the Monk, the lake relic and its lookout, the far relic. */
export const ROUTE_MONK_CELL: Position = { x: 22, y: 16 };
export const LAKE_RELIC_CELL: Position = { x: 40, y: 16 };
export const LAKE_LOOKOUT_CELL: Position = { x: 34, y: 16 };
export const FAR_RELIC_CELL: Position = { x: 8, y: 28 };
/** Water this far from the lake relic, a Monk's reach of four plus one. */
const LAKE_RADIUS = 5;

/** The ally-sight fixture: the computer's seat, and the player's (its ally's) villager beside relic A. */
export const ALLY_SIGHT_AI_SEAT = 3;
export const ALLY_LOOKOUT_CELL: Position = { x: 41, y: 10 };

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
      ownedSpawn(seed === MISSIONARY_CARRIED_RELIC_SEED ? 'missionary' : 'monk', 1, CARRIED_MONK_CELL.x, CARRIED_MONK_CELL.y, { vision: MONK_VISION }),
      ownedSpawn('villager', 1, CARRIED_VILLAGER_CELL.x, CARRIED_VILLAGER_CELL.y, { vision: VILLAGER_VISION }),
      ownedSpawn('monk', 1, CARRIED_SECOND_MONK_CELL.x, CARRIED_SECOND_MONK_CELL.y, { vision: MONK_VISION }),
      ownedSpawn('farm', 1, CARRIED_FARM_CELL.x, CARRIED_FARM_CELL.y, { vision: 4 }),
      gaiaSpawn('relic', CARRIED_RELIC_CELL.x, CARRIED_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('town-center', 2, 52, 24, { vision: 7 }),
    ],
  };
}

export function createMonkRelicCrossOwnerFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'castle-age' },
      // The computer, with nothing to spend: its Monk is all it plays.
      {
        owner: 2,
        townCenter: { x: 52, y: 26 },
        startingAge: 'castle-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('monastery', 1, 10, 14),
      ownedSpawn('monk', 1, CROSS_PLAYER_MONK_CELL.x, CROSS_PLAYER_MONK_CELL.y, { vision: MONK_VISION }),
      gaiaSpawn('relic', CROSS_RELIC_CELL.x, CROSS_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('monk', 2, CROSS_COMPUTER_MONK_CELL.x, CROSS_COMPUTER_MONK_CELL.y, { vision: MONK_VISION }),
      ownedSpawn('monastery', 2, 46, 14),
      ownedSpawn('town-center', 2, 52, 26, { vision: 7 }),
    ],
  };
}

export function createAiMonkKnownRelicFixture(seed: string): PrototypeScenario {
  return knownRelicGround(seed, [
    ownedSpawn('monk', 1, KNOWN_MONK_CELL.x, KNOWN_MONK_CELL.y, { vision: MONK_VISION }),
  ]);
}

/** A river divides the nearest Monastery from a Monk and its relic; a farther
 *  Monastery on the Monk's bank can receive it. */
export function createAiMonkBlockedMonasteryFixture(seed: string): PrototypeScenario {
  const scenario = createAiMonkKnownRelicFixture(seed);
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    scenario.terrain[y]![29] = createTerrainCell(29, y, 'water');
    scenario.terrain[y]![30] = createTerrainCell(30, y, 'water');
  }
  scenario.spawns = [
    ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
    ownedSpawn('monastery', 1, 34, 16),
    ownedSpawn('monastery', 1, 6, 14),
    ownedSpawn('monk', 1, KNOWN_MONK_CELL.x, KNOWN_MONK_CELL.y, { vision: MONK_VISION }),
    gaiaSpawn('relic', KNOWN_NEAR_RELIC_CELL.x, KNOWN_NEAR_RELIC_CELL.y, { amount: 0 }),
    ownedSpawn('town-center', 2, 52, 24, { vision: 7 }),
  ];
  return scenario;
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

export function createAiMonkUnreachableRelicFixture(seed: string): PrototypeScenario {
  return lakeRelicGround(seed, [
    gaiaSpawn('relic', FAR_RELIC_CELL.x, FAR_RELIC_CELL.y, { amount: 0 }),
    // A sentry beside the far relic, so the seat knows of it as well.
    ownedSpawn('villager', 1, FAR_RELIC_CELL.x + 1, FAR_RELIC_CELL.y + 1, { vision: VILLAGER_VISION }),
  ]);
}

export function createAiMonkUnreachableRelicHealFixture(seed: string): PrototypeScenario {
  return lakeRelicGround(seed, [
    ownedSpawn('militia', 1, WOUNDED_MILITIA_CELL.x, WOUNDED_MILITIA_CELL.y, { vision: 4, startHp: WOUNDED_MILITIA_HP }),
    // An enemy unit on the map keeps the AI's attack-group threshold in force.
    ownedSpawn('villager', 2, 50, 26, { vision: VILLAGER_VISION }),
  ]);
}

function lakeRelicGround(seed: string, extra: PrototypeScenario['spawns']): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const distance = Math.abs(x - LAKE_RELIC_CELL.x) + Math.abs(y - LAKE_RELIC_CELL.y);
      if (distance >= 1 && distance <= LAKE_RADIUS) terrain[y]![x] = createTerrainCell(x, y, 'water');
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
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
      { owner: 2, townCenter: { x: 52, y: 28 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('monastery', 1, 12, 14),
      ownedSpawn('monk', 1, ROUTE_MONK_CELL.x, ROUTE_MONK_CELL.y, { vision: MONK_VISION }),
      // On the lake shore: it explores the lake relic, and the test deletes it.
      ownedSpawn('villager', 1, LAKE_LOOKOUT_CELL.x, LAKE_LOOKOUT_CELL.y, { vision: 7 }),
      gaiaSpawn('relic', LAKE_RELIC_CELL.x, LAKE_RELIC_CELL.y, { amount: 0 }),
      ...extra,
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
    ],
  };
}

export function createAiMonkAllySightRelicFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // The player, the computer's ally: its villager is the lookout, which
      // the test deletes with the Delete key.
      { owner: 1, townCenter: { x: 4, y: 28 }, team: 1 },
      { owner: 2, townCenter: { x: 52, y: 28 }, team: 2, disableAi: true },
      {
        owner: ALLY_SIGHT_AI_SEAT,
        townCenter: { x: 4, y: 4 },
        team: 1,
        startingAge: 'castle-age',
        startingResources: { food: 0, wood: 0, gold: 0, stone: 0 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', ALLY_SIGHT_AI_SEAT, 4, 4, { vision: 7 }),
      ownedSpawn('monastery', ALLY_SIGHT_AI_SEAT, KNOWN_MONASTERY_CELL.x, KNOWN_MONASTERY_CELL.y),
      ownedSpawn('monk', ALLY_SIGHT_AI_SEAT, KNOWN_MONK_CELL.x, KNOWN_MONK_CELL.y, { vision: MONK_VISION }),
      gaiaSpawn('relic', KNOWN_EXPLORED_RELIC_CELL.x, KNOWN_EXPLORED_RELIC_CELL.y, { amount: 0 }),
      ownedSpawn('villager', 1, ALLY_LOOKOUT_CELL.x, ALLY_LOOKOUT_CELL.y, { vision: VILLAGER_VISION }),
      ownedSpawn('town-center', 1, 4, 28, { vision: 7 }),
      ownedSpawn('town-center', 2, 52, 28, { vision: 7 }),
    ],
  };
}
