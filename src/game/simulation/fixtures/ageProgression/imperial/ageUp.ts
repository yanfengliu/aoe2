import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import {
  FIXTURE_NEARBY_VILLAGER_POSITION,
  createGrassFixtureTerrain,
} from '../../common';

// Slice 7A fixture: Castle-Age human with two Castle-Age-unlocked buildings
// (Monastery + Castle) already completed. Used to assert the Imperial Age
// research option appears at the Town Center and can be queued end-to-end
// so the player's age flips to 'imperial-age' on completion.
export function createImperialAgeFixture(seed: string): PrototypeScenario {
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
        // Plenty of resources for the 1000 food / 800 gold Imperial Age cost
        // plus any follow-on training.
        startingResources: {
          food: 2000,
          wood: 600,
          gold: 1600,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
        kind: 'monastery',
        x: 4,
        y: 6,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'castle',
        x: 14,
        y: 6,
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

// Slice 7A fixture: Castle-Age human with zero Castle-Age-unlocked buildings.
// Imperial Age should be *visible* at the Town Center (it's the next age)
// but not *researchable* (prereq not met), mirroring the Feudal → Castle
// missing-prereq test.
export function createImperialMissingPrereqFixture(seed: string): PrototypeScenario {
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
          food: 2000,
          wood: 600,
          gold: 1600,
          stone: 400,
        },
      },
      {
        owner: 2,
        townCenter: { x: 24, y: 8 },
        startingAge: 'castle-age',
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
