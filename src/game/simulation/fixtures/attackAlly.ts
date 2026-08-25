import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Ally-attack semantics (v0.3.102): three Town Centers in one militia's
// sight — its own, an ALLY's (team 1), and an ENEMY's (team 2), both other
// players inert. Close quarters so the walk/attack outcomes land in a few
// hundred ticks and nothing is fogged.
export function createAttackAllyFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 6, y: 8 }, team: 1 },
      { owner: 2, townCenter: { x: 16, y: 8 }, team: 1, disableAi: true },
      { owner: 3, townCenter: { x: 26, y: 8 }, team: 2, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 6, 8, { vision: 7 }),
      ownedSpawn('militia', 1, 12, 14, { vision: 18 }),
      ownedSpawn('town-center', 2, 16, 8, { vision: 7 }),
      ownedSpawn('town-center', 3, 26, 8, { vision: 7 }),
    ],
  };
}
