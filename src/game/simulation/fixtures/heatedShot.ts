import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';
import { createTerrainCell } from '../mapGeneration/sharedTerrainHelpers';

// Heated Shot fixture: a Watch Tower on a shoreline with an enemy Galley in
// the water beside it and an enemy Militia the same distance away on land, so
// the two volleys are comparable. Both enemies are passive.
//
// The technology is PRE-RESEARCHED on the `-researched` variant rather than
// queued in the test: researching it in-game takes 300 ticks, and the tower
// kills the militia long before that, so the comparison never gets to run.
function heatedShotScenario(seed: string, researched: boolean): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  for (let y = 6; y <= 14; y += 1) {
    for (let x = 16; x <= 22; x += 1) {
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 10 },
        startingAge: 'castle-age',
        startingResources: { food: 2000, wood: 1000, gold: 2000, stone: 800 },
        startingResearchedTechnologies: researched ? ['heated-shot'] : [],
      },
      { owner: 2, townCenter: { x: 40, y: 26 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 10, { vision: 7 }),
      ownedSpawn('university', 1, 6, 16, { vision: 6 }),
      // The tower sits two cells from the shoreline, so both targets are in
      // range and neither is adjacent.
      ownedSpawn('watch-tower', 1, 14, 10, { vision: 10 }),
      ownedSpawn('galley', 2, 17, 10, { vision: 6 }),
      ownedSpawn('militia', 2, 12, 10, { vision: 4 }),
      ownedSpawn('town-center', 2, 40, 26, { vision: 4 }),
    ],
  };
}

export function createHeatedShotFixture(seed: string): PrototypeScenario {
  return heatedShotScenario(seed, false);
}

export function createHeatedShotResearchedFixture(seed: string): PrototypeScenario {
  return heatedShotScenario(seed, true);
}
