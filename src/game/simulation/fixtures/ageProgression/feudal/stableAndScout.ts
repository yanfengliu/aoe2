import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../../../prototypeScenario';
import {
  FIXTURE_NEARBY_VILLAGER_POSITION,
  FIXTURE_PRIMARY_BUILDING_POSITION,
  FIXTURE_SECONDARY_BUILDING_POSITION,
  createGrassFixtureTerrain,
} from '../../common';
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
        kind: 'blacksmith',
        x: FIXTURE_SECONDARY_BUILDING_POSITION.x,
        y: FIXTURE_SECONDARY_BUILDING_POSITION.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'archer',
        x: 12,
        y: 12,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'stable',
        x: stableAnchor.x,
        y: stableAnchor.y,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'town-center',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
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
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 28,
        y: 16,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      {
        kind: 'tree',
        x: 11,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 13,
        y: 10,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 12,
        y: 9,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'tree',
        x: 12,
        y: 11,
        owner: null,
        baseOwner: null,
        amount: 100,
      },
      {
        kind: 'scout',
        x: 12,
        y: 10,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 6 },
        requiresSafeSpawn: true,
      },
    ],
  };
}

