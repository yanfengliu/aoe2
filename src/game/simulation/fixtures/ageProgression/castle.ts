import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { FIXTURE_NEARBY_VILLAGER_POSITION, FIXTURE_PRIMARY_BUILDING_POSITION, FIXTURE_SECONDARY_BUILDING_POSITION, createGrassFixtureTerrain, ownedSpawn } from '../common';

export function createCastleAgeFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('blacksmith', 1, FIXTURE_PRIMARY_BUILDING_POSITION.x, FIXTURE_PRIMARY_BUILDING_POSITION.y),
      ownedSpawn('stable', 1, FIXTURE_SECONDARY_BUILDING_POSITION.x, FIXTURE_SECONDARY_BUILDING_POSITION.y),
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createCastleTownCenterFixture(seed: string): PrototypeScenario {
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
        townCenter: { x: 34, y: 8 },
        // Pure human-production test (build a 2nd TC at (14,8), train a
        // villager). disableAi stops the enemy training/rushing, AND the
        // enemy TC is parked far east (34,8) so that — under the empty-TC-
        // fires-1 rule (spec §10.8) — it cannot shoot the human's villagers
        // clustered around the new forward TC (which had killed the trained
        // villager, dropping the count to 1). Together these isolate the
        // production assertions from any combat.
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('villager', 1, 6, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 34, 8, { vision: 7 }),
    ],
  };
}

export function createCastleUpgradesFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archery-range', 1, 12, 6),
      ownedSpawn('barracks', 1, 16, 6),
      ownedSpawn('stable', 1, 20, 6),
      ownedSpawn('blacksmith', 1, 4, 6),
      // Slice 12 Task B: moved from (10, 10) which sat inside the human
      // TC footprint (TC covers 8..11, 8..11). The (10, 13) slot keeps
      // the archer adjacent to the TC and out of any building
      // footprint so fixture validation passes.
      ownedSpawn('archer', 1, 10, 13, { vision: 5 }),
      ownedSpawn('spearman', 1, 12, 13, { vision: 3 }),
      ownedSpawn('scout', 1, 14, 13, { vision: 4 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Slice 12 Task B: moved from (22, 10) which sat inside the
      // enemy TC footprint (TC covers 24..27, 8..11). (22, 13) keeps
      // the archer adjacent to the enemy base and out of the footprint.
      ownedSpawn('archer', 2, 22, 13, { vision: 5 }),
    ],
  };
}
