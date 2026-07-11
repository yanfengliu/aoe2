import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

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
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 28,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // Owner 2's Wonder FIRST (lower id).
      { kind: 'wonder', x: 24, y: 6, owner: 2, baseOwner: 2 },
      { kind: 'wonder', x: 14, y: 6, owner: 1, baseOwner: 1 },
    ],
  };
}
