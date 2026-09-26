import type { Position } from 'civ-engine';

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

// An attack on an animal flies as a shot when the attacker shoots
// (tests/simulation/wildlifeShots.test.ts, defect register "A blast landed
// where DE's does not", 2026-09-26). An Archer stands four cells from a boar,
// in range, and a Militia beside another; a boar never starts a fight, so each
// stands still until it is attacked. Every AI is off and no enemy is near, so
// neither of owner 1's units finds anything to do on its own.

export const WILDLIFE_SHOTS_ARCHER: Position = { x: 10, y: 10 };
export const WILDLIFE_SHOTS_ARCHER_BOAR: Position = { x: 14, y: 10 };
export const WILDLIFE_SHOTS_MILITIA: Position = { x: 10, y: 20 };
export const WILDLIFE_SHOTS_MILITIA_BOAR: Position = { x: 11, y: 20 };

export function createWildlifeShotsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      { owner: 1, townCenter: { x: 4, y: 4 }, disableAi: true },
      { owner: 2, townCenter: { x: 50, y: 30 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 4, 4, { vision: 7 }),
      ownedSpawn('town-center', 2, 50, 30, { vision: 7 }),
      ownedSpawn('archer', 1, WILDLIFE_SHOTS_ARCHER.x, WILDLIFE_SHOTS_ARCHER.y, { vision: 8 }),
      gaiaSpawn('boar', WILDLIFE_SHOTS_ARCHER_BOAR.x, WILDLIFE_SHOTS_ARCHER_BOAR.y, { amount: 340 }),
      ownedSpawn('militia', 1, WILDLIFE_SHOTS_MILITIA.x, WILDLIFE_SHOTS_MILITIA.y, { vision: 4 }),
      gaiaSpawn('boar', WILDLIFE_SHOTS_MILITIA_BOAR.x, WILDLIFE_SHOTS_MILITIA_BOAR.y, { amount: 340 }),
    ],
  };
}
