import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Building damage states (v0.3.97): three buildings seeded WOUNDED below the
// 40% threshold and one healthy control house, so a single capture shows the
// fire-and-smoke look beside the clean one.
export function createDamageShowcaseFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 8, y: 10 } },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 10, { vision: 14, startHp: 700 }),
      ownedSpawn('house', 1, 16, 12, { startHp: 150 }),
      ownedSpawn('watch-tower', 1, 20, 10, { startHp: 300 }),
      ownedSpawn('house', 1, 16, 16),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
