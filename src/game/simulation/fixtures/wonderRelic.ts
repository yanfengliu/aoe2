import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from './common';

// Slice 8 fixture: Imperial-Age human with no Wonder yet. Used to assert
// the villager build menu exposes 'wonder' once the Imperial gate is
// satisfied.
export function createWonderImperialFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a completed Wonder AND a
// villager. Used to assert the one-Wonder-per-owner cap — the villager's
// build options should not include 'wonder' even in Imperial Age.
export function createWonderExistingFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('wonder', 1, 14, 6),
      ownedSpawn('villager', 1, 6, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a completed Wonder and a
// countdown override of 10 ticks. Used for the Wonder-victory test so
// the countdown resolves quickly.
export function createWonderShortCountdownFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('wonder', 1, 14, 6),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
    ],
  };
}

// Slice 8 fixture: Imperial-Age human with a Wonder at very low HP and a
// short countdown override. An enemy Siege Ram is stationed adjacent to
// the Wonder so it is destroyed before the countdown can expire, proving
// the destruction-resets-countdown rule.
export function createWonderDestroyedFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 6, 12, { vision: 7 }),
      // Wonder starts with 4 HP so one militia swing finishes it. The
      // long 60-tick countdown gives the militia time to close, engage,
      // and swing before the countdown would naturally expire.
      ownedSpawn('wonder', 1, 14, 6, { startHp: 4 }),
      ownedSpawn('militia', 2, 18, 7, { vision: 10 }),
      ownedSpawn('town-center', 2, 28, 12, { vision: 7 }),
    ],
  };
}

// Slice 8 fixture: player-1 Monastery pre-loaded with every relic (and
// zero live relics on the map). Relic countdown override is set to 10
// ticks so the victory fires quickly.
export function createRelicShortCountdownFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 12, 6, { startingRelicsInMonastery: 3 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
    ],
  };
}

// Slice 8 fixture: player-1 Monastery with 2 relics, plus a live neutral
// relic on the map. Player 1 does NOT hold every relic, so the relic
// countdown must never complete even with an aggressive override.
export function createRelicNotAllHeldFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 12, 6, { startingRelicsInMonastery: 2 }),
      gaiaSpawn('relic', 20, 12, { amount: 0 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
    ],
  };
}

// FU7 fixture: player-1 simultaneously races a Wonder countdown and a
// Relic countdown — both with the same 10-tick override — so they hit
// zero on the same tick. The explicit `lastCompletedTick` resolver must
// pick Wonder (stable tie-break documented in the spec). Without the
// resolver the outcome depends on system-registration order, which is
// exactly the implicitness this follow-up removes.
export function createWonderRelicTieFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('wonder', 1, 14, 6),
      // Pre-loaded with every relic so the Relic countdown kicks off
      // on tick 0 alongside the Wonder's countdown.
      ownedSpawn('monastery', 1, 4, 12, { startingRelicsInMonastery: 3 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
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
export function createWonderOwnerAfterConversionFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monk', 1, 20, 10, { vision: 9 }),
      ownedSpawn('wonder', 2, 22, 6),
      ownedSpawn('villager', 2, 22, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 7 }),
    ],
  };
}
