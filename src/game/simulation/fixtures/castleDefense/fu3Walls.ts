import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// FU3 fixture: Feudal-Age human with a completed Barracks so the
// villager build options include palisade-wall. Mirrors the
// `fu3-stone-wall-fixture` layout but without the Castle-Age age-up.
export function createFu3PalisadeWallFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, 4, 4),
      ownedSpawn('villager', 1, 12, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// FU3 fixture: Castle-Age human + idle villager so the stone-wall build
// option is exposed in the villager's buildOptions selection state.
export function createFu3StoneWallFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// FU3 fixture: Castle-Age human, idle villager adjacent to a pre-built
// stone-wall. Used to confirm the wall blocks unit pathing (issueMove
// into the wall cell must be rejected).
export function createFu3StoneWallBlockingFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('stone-wall', 1, 18, 18),
      ownedSpawn('villager', 1, 18, 20, { vision: 4 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}

// FU3 fixture: pre-built stone-wall + enemy Battering Ram adjacent so
// the ram attacks the wall down. Wall starts with a low HP override so
// the test resolves in a handful of ticks without simulating a full
// 2000-HP takedown.
export function createFu3StoneWallCombatFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('stone-wall', 1, 20, 20, { startHp: 50 }),
      // Enemy Battering Ram one cell south of the wall. Ram atk 2 + 75
      // vs buildings = 77 per hit, so one reload cycle kills the 50-HP
      // wall segment.
      ownedSpawn('battering-ram', 2, 20, 21, { vision: 5 }),
      ownedSpawn('town-center', 2, 48, 28, { vision: 7 }),
    ],
  };
}
