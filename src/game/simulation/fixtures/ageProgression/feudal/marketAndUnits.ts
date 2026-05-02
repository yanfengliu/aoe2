import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  FIXTURE_NEARBY_VILLAGER_POSITION,
  FIXTURE_PRIMARY_BUILDING_POSITION,
  FIXTURE_SECONDARY_BUILDING_POSITION,
  createGrassFixtureTerrain,
} from '../../common';
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
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
      {
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can train a Spearman in Feudal Age and use its anti-scout
        // bonus` expects an enemy scout exactly at (14, 10) so its
        // `issueContextCommand(14, 10)` resolves to this scout. That
        // cell sits inside the Barracks footprint at (13..15, 8..10);
        // opt out of the fixture validator.
        kind: 'scout',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
        allowOverlappingSpawn: true,
      },
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
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
      {
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can train a Skirmisher in Feudal Age and use its anti-
        // archer bonus` expects an enemy archer exactly at (14, 10)
        // so its `issueContextCommand(14, 10)` resolves to this
        // archer. That cell sits inside the Archery Range footprint
        // at (13..15, 8..10); opt out of the fixture validator.
        kind: 'archer',
        x: 14,
        y: 10,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 6 },
        allowOverlappingSpawn: true,
      },
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
        x: FIXTURE_PRIMARY_BUILDING_POSITION.x,
        y: FIXTURE_PRIMARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'blacksmith',
        x: FIXTURE_SECONDARY_BUILDING_POSITION.x,
        y: FIXTURE_SECONDARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'villager',
        x: FIXTURE_NEARBY_VILLAGER_POSITION.x,
        y: FIXTURE_NEARBY_VILLAGER_POSITION.y,
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
      {
        // Slice 12 Task B: deliberate overlap — the utility test
        // `can build a Watch Tower in Feudal Age and let it
        // automatically kill a nearby visible Scout` places a Watch
        // Tower near the human TC and measures whether the nearby
        // enemy scout dies within 520 ticks. The scout's exact (18,8)
        // position sits inside the Blacksmith footprint
        // (17..19, 8..10) but the tower's range 7 + the scout's
        // near-stationary spot makes the test time-boxed, so leaving
        // the scout at (18, 8) preserves the tower-range geometry.
        kind: 'scout',
        x: 18,
        y: 8,
        owner: 2,
        baseOwner: 2,
        allowOverlappingSpawn: true,
      },
    ],
  };
}
