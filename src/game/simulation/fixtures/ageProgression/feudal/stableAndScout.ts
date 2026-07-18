import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../../prototypeScenario';
import { FIXTURE_NEARBY_VILLAGER_POSITION, FIXTURE_PRIMARY_BUILDING_POSITION, FIXTURE_SECONDARY_BUILDING_POSITION, createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../../common';
export function createFeudalBlacksmithFixture(seed: string): PrototypeScenario {
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
          gold: 250,
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
      ownedSpawn('blacksmith', 1, FIXTURE_SECONDARY_BUILDING_POSITION.x, FIXTURE_SECONDARY_BUILDING_POSITION.y),
      ownedSpawn('archer', 1, 12, 12, { vision: 6 }),
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createFeudalStableFixture(seed: string): PrototypeScenario {
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
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}

export function createBlockedStableSpawnFixture(seed: string): PrototypeScenario {
  const stableAnchor = { x: 12, y: 8 };
  const ringTreeSpawns: ScenarioSpawnSpec[] = [];

  for (let y = stableAnchor.y - 1; y <= stableAnchor.y + 3; y += 1) {
    for (let x = stableAnchor.x - 1; x <= stableAnchor.x + 3; x += 1) {
      const insideStable = x >= stableAnchor.x && x <= stableAnchor.x + 2
        && y >= stableAnchor.y && y <= stableAnchor.y + 2;
      if (insideStable) {
        continue;
      }

      ringTreeSpawns.push({
        kind: 'tree',
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      });
    }
  }

  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'feudal-age',
        startingResources: {
          food: 250,
          wood: 200,
          gold: 100,
          stone: 200,
        },
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 16 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('stable', 1, stableAnchor.x, stableAnchor.y),
      ownedSpawn('town-center', 2, 28, 16, { vision: 7 }),
      ...ringTreeSpawns,
    ],
  };
}

export function createIsolatedScoutSpawnFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 16 },
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 28, 16, { vision: 7 }),
      gaiaSpawn('tree', 11, 10, { amount: 100 }),
      gaiaSpawn('tree', 13, 10, { amount: 100 }),
      gaiaSpawn('tree', 12, 9, { amount: 100 }),
      gaiaSpawn('tree', 12, 11, { amount: 100 }),
      ownedSpawn('scout', 1, 12, 10, { vision: 6, requiresSafeSpawn: true }),
    ],
  };
}

