import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Khmer "Villagers can garrison in Houses" (civilizations.csv). One house,
// one villager, one militia: the villager may enter (Khmer only), the militia
// never may — houses shelter no soldiers even for the Khmer.
export function createCivKhmerHouseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 } },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('house', 1, 12, 6),
      ownedSpawn('villager', 1, 15, 8),
      ownedSpawn('militia', 1, 16, 8),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
