// Unit-repair fixture (v0.3.107): a villager beside a badly damaged
// Battering Ram, plus a healthy ram (a full-HP target must charge nothing)
// and an idle far-off enemy so the match stays live.

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

export function createUnitRepairFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 6, y: 6 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 500, wood: 500, gold: 500, stone: 500 },
      },
      {
        owner: 2,
        townCenter: { x: 50, y: 30 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 6, { vision: 8 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
      ownedSpawn('villager', 1, 12, 10),
      // 40/175: badly hurt, well clear of the death threshold.
      ownedSpawn('battering-ram', 1, 14, 10, { startHp: 40 }),
      ownedSpawn('battering-ram', 1, 16, 12),
    ],
  };
}
