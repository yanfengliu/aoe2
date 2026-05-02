import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  FIXTURE_NEARBY_VILLAGER_POSITION,
  FIXTURE_PRIMARY_BUILDING_POSITION,
  createGrassFixtureTerrain,
} from '../../common';
export function createFeudalMissingPrereqFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 700,
          wood: 375,
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
        kind: 'mill',
        x: 5,
        y: 8,
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

export function createFeudalAgeFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: {
          food: 700,
          wood: 375,
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
        kind: 'mill',
        x: 5,
        y: 8,
        owner: 1,
        baseOwner: 1,
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

