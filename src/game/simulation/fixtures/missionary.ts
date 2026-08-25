import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/**
 * A Spanish Monastery with everything a Missionary test needs in reach: an
 * enemy militia to convert, and a relic on the ground it must REFUSE to pick
 * up — the horse is the whole difference from a Monk, and both halves of it
 * (rides faster, carries nothing) want the same stage.
 */
export function createMissionaryFixture(seed: string): PrototypeScenario {
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
        civilization: 'Spanish',
        disableAi: true,
        startingResources: { food: 500, wood: 500, gold: 500, stone: 200 },
      },
      {
        owner: 2,
        townCenter: { x: 44, y: 26 },
        startingAge: 'castle-age',
        civilization: 'Franks',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('monastery', 1, 14, 8, { vision: 8 }),
      gaiaSpawn('relic', 18, 12),
      ownedSpawn('militia', 2, 20, 10, { vision: 3 }),
      ownedSpawn('town-center', 2, 44, 26, { vision: 7 }),
    ],
  };
}
