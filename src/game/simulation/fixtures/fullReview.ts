import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn } from './common';

// Fixtures for full-review deferred-backlog regressions. Kept in their own file
// so the topical fixture modules (wonderRelic / siege) stay under the 500-LOC cap.

// Full-review L5: BOTH owners hold a completed Wonder with the SAME 10-tick
// countdown, so both expire on the same tick. Owner 2's Wonder is spawned FIRST
// (lower entity id → the strict-`<` tie-break iterates it first), so pre-fix the
// human (owner 1) was handed a `defeat`; the fix prefers the human on a tie.
export function createTwoWonderTieFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 8, y: 8 },
        startingAge: 'imperial-age',
        wonderCountdownOverrideTicks: 10,
      },
      {
        owner: 2,
        townCenter: { x: 28, y: 8 },
        startingAge: 'imperial-age',
        wonderCountdownOverrideTicks: 10,
      },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 8, 8, { vision: 7 }),
      ownedSpawn('town-center', 2, 28, 8, { vision: 7 }),
      // Owner 2's Wonder FIRST (lower id).
      ownedSpawn('wonder', 2, 24, 6),
      ownedSpawn('wonder', 1, 14, 6),
    ],
  };
}
