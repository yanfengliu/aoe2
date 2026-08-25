import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Garrison-scaled tower arrows (structures.csv "Max 5 arrows", v0.3.96):
// archers and villagers each add an arrow; infantry add none. Two archers,
// a villager, and a militia stand by the tower; the enemy KNIGHT is parked
// in range — 100 HP and 2 pierce armor survive the pre-garrison sniping, so
// one post-garrison volley is cleanly measurable as a delta.
export function createTowerArrowsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, startingAge: 'feudal-age' },
      { owner: 2, townCenter: { x: 52, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('watch-tower', 1, 20, 14, { vision: 10 }),
      ownedSpawn('archer', 1, 22, 16),
      ownedSpawn('archer', 1, 23, 16),
      ownedSpawn('villager', 1, 24, 16),
      ownedSpawn('militia', 1, 25, 16),
      ownedSpawn('knight', 2, 25, 14),
      ownedSpawn('town-center', 2, 52, 30, { vision: 4 }),
    ],
  };
}
