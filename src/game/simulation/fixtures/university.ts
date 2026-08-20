import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// University fixtures: a completed University, a Town Center to measure a
// building-wide effect against, a Watch Tower for the tower technologies, and
// enough of everything to buy them.
function universityScenario(
  seed: string,
  startingAge: 'castle-age' | 'imperial-age',
): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge,
        startingResources: { food: 3000, wood: 2000, gold: 2000, stone: 1000 },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 8 },
        startingAge,
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('university', 1, 14, 8, { vision: 5 }),
      ownedSpawn('watch-tower', 1, 14, 12, { vision: 8 }),
      ownedSpawn('villager', 1, 10, 12, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 8, { vision: 4 }),
    ],
  };
}

export function createUniversityFixture(seed: string): PrototypeScenario {
  return universityScenario(seed, 'castle-age');
}

export function createUniversityImperialFixture(seed: string): PrototypeScenario {
  return universityScenario(seed, 'imperial-age');
}
