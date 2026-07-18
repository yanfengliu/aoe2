import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import { FIXTURE_NEARBY_VILLAGER_POSITION, FIXTURE_PRIMARY_BUILDING_POSITION, FIXTURE_SECONDARY_BUILDING_POSITION, createGrassFixtureTerrain, ownedSpawn } from '../../common';
export function createFeudalMarketFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, FIXTURE_PRIMARY_BUILDING_POSITION.x, FIXTURE_PRIMARY_BUILDING_POSITION.y),
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createFeudalSpearmanFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, FIXTURE_PRIMARY_BUILDING_POSITION.x, FIXTURE_PRIMARY_BUILDING_POSITION.y),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Slice 12 Task B: deliberate overlap — the utility test
      // `can train a Spearman in Feudal Age and use its anti-scout
      // bonus` expects an enemy scout exactly at (14, 10) so its
      // `issueContextCommand(14, 10)` resolves to this scout. That
      // cell sits inside the Barracks footprint at (13..15, 8..10);
      // opt out of the fixture validator.
      ownedSpawn('scout', 2, 14, 10, { vision: 6, allowOverlappingSpawn: true }),
    ],
  };
}

export function createFeudalSkirmisherFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('archery-range', 1, FIXTURE_PRIMARY_BUILDING_POSITION.x, FIXTURE_PRIMARY_BUILDING_POSITION.y),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Keep the target outside the Town Center's six-cell arrow range,
      // but exactly inside a newly trained Skirmisher's five-cell vision.
      // The old overlapping spawn was culled before training completed,
      // which made the anti-archer exercise pass vacuously.
      ownedSpawn('archer', 2, 18, 7, { vision: 6 }),
    ],
  };
}

export function createFeudalWatchTowerFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('barracks', 1, FIXTURE_PRIMARY_BUILDING_POSITION.x, FIXTURE_PRIMARY_BUILDING_POSITION.y),
      ownedSpawn('blacksmith', 1, FIXTURE_SECONDARY_BUILDING_POSITION.x, FIXTURE_SECONDARY_BUILDING_POSITION.y),
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
      // Slice 12 Task B: deliberate overlap — the utility test
      // `can build a Watch Tower in Feudal Age and let it
      // automatically kill a nearby visible Scout` places a Watch
      // Tower near the human TC and measures whether the nearby
      // enemy scout dies within 520 ticks. The scout's exact (18,8)
      // position sits inside the Blacksmith footprint
      // (17..19, 8..10) but the tower's range 7 + the scout's
      // near-stationary spot makes the test time-boxed, so leaving
      // the scout at (18, 8) preserves the tower-range geometry.
      ownedSpawn('scout', 2, 18, 8, { allowOverlappingSpawn: true }),
    ],
  };
}
