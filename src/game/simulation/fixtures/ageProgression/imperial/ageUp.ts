import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../../prototypeScenario';
import { FIXTURE_NEARBY_VILLAGER_POSITION, createGrassFixtureTerrain, ownedSpawn } from '../../common';

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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 4, 6),
      ownedSpawn('castle', 1, 14, 6),
      ownedSpawn('villager', 1, FIXTURE_NEARBY_VILLAGER_POSITION.x, FIXTURE_NEARBY_VILLAGER_POSITION.y, {
        vision: 4,
      }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
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
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 24, 8, { vision: 7 }),
    ],
  };
}
