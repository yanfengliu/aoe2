import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../prototypeScenario';
import { createGrassFixtureTerrain } from './common';

// Line-of-sight tech fixture (v0.1.80). Player 1 (human, AI disabled) starts in
// Castle Age with a Town Center (base vision 7) at (4,4), a Barracks at (4,10)
// — Barracks has NO vision source, so it never widens the fog — and a lone
// Militia (canonical base vision 3) parked far east at (30,4) so its reveal is
// isolated from the TC's. A generous food/gold stock lets a test drive real
// Town Watch (75f), Town Patrol (300f/200g) and Tracking (75f) research cycles.
// Probes (Euclidean, dx²+dy² <= r²): TC reveal grows 7 -> 11 (Town Watch) ->
// 15 (Town Patrol); the Militia reveal grows 3 -> 5 (Tracking). Player 2 sits
// in the far corner, out of every probe's range.
export function createLosTechsFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 4, y: 4 },
        startingAge: 'castle-age',
        disableAi: true,
        startingResources: { food: 2000, wood: 0, gold: 1000, stone: 0 },
      },
      {
        owner: 2,
        townCenter: { x: 56, y: 32 },
        startingAge: 'castle-age',
        disableAi: true,
      },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 4,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'barracks',
        x: 4,
        y: 10,
        owner: 1,
        baseOwner: 1,
      },
      {
        kind: 'militia',
        x: 30,
        y: 4,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 3 },
      },
      {
        kind: 'town-center',
        x: 56,
        y: 32,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
    ],
  };
}
