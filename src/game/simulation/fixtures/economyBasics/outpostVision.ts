import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from '../common';

// An Outpost standing when its owner advances an age. structures.csv gives the
// Outpost "+2 Line of sight per age" on a base of 6, and this is the half that
// cannot be derived at creation: the post is already built, so something has to
// bump it. The player starts with the Dark-Age prerequisites and the 500 food
// for Feudal already banked, so the only thing the test does is advance.
export function createOutpostVisionFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingResources: { food: 700, wood: 375, gold: 200, stone: 200 },
      },
      { owner: 2, townCenter: { x: 40, y: 26 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      // v0.3.136: a scout for the Feudal-attack sweep test to watch.
      ownedSpawn('scout', 1, 12, 14),
      // Two Dark-Age buildings: the Feudal age-up prerequisite.
      ownedSpawn('mill', 1, 5, 8),
      ownedSpawn('barracks', 1, 13, 8),
      // The Outpost under test, clear of every footprint.
      ownedSpawn('outpost', 1, 8, 14),
      // A builder, so the same fixture can also put up a NEW Outpost after the
      // age-up and check it starts at the age's radius rather than the base one.
      ownedSpawn('villager', 1, 14, 14, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 26, { vision: 7 }),
    ],
  };
}
