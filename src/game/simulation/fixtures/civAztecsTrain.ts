import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Civ-bonus Aztecs-creation-speed fixture (v0.1.84). Player 1 (AI disabled)
// owns a completed Barracks and enough resources to train a Militia. The only
// thing that varies between the two variants is owner 1's civilization —
// Aztecs (military units train 15% faster) vs a non-Aztecs control — so a twin
// race isolates the bonus: a test queues a Militia at the Barracks in each run
// and compares ticks-to-completion.
function createCivAztecsTrainScenario(seed: string, civilization: string): PrototypeScenario {
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
        civilization,
        disableAi: true,
        startingResources: { food: 500, wood: 0, gold: 500, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 40, y: 24 },
        startingAge: 'feudal-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('barracks', 1, 4, 10, { vision: 6 }),
      ownedSpawn('town-center', 2, 40, 24, { vision: 7 }),
    ],
  };
}

// Aztecs: the military-creation-speed civ under test.
export function createCivAztecsTrainFixture(seed: string): PrototypeScenario {
  return createCivAztecsTrainScenario(seed, 'Aztecs');
}

// Control: a non-Aztecs civ (no creation-speed bonus). Byte-identical geometry.
export function createCivAztecsTrainControlFixture(seed: string): PrototypeScenario {
  return createCivAztecsTrainScenario(seed, 'Persians');
}
