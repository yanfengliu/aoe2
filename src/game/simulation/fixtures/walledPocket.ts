// A pocket of open ground sealed off by a closed ring of trees, plus open map
// outside it. Built for the walk-order gate (2026-09-06): the standing loop
// played a 93-minute Black Forest match in which the whole army was ordered
// across the map and nothing happened at all — no movement, no message. The
// map had sealed itself, and every walk order into the sealed-off half was
// accepted and dropped in silence.
//
// The pocket interior is (2..7, 2..7); the ring is the border of (1..8, 1..8),
// so the only ways out are tree cells. Two owner-1 units start inside it and
// one starts outside, which is what lets one fixture carry the defect AND its
// two controls:
//   - inside  -> a far cell outside : the order cannot be carried out,
//   - inside  -> a cell in the pocket: a short order still works,
//   - outside -> a far cell outside : a long order across a reachable map is
//                carried out (86 manhattan, past the old candidate radius of
//                max(width, height) = 60).

import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
  type ScenarioSpawnSpec,
} from '../prototypeScenario';
import { createGrassFixtureTerrain, gaiaSpawn, ownedSpawn } from './common';

/** Interior of the sealed pocket, inclusive. */
export const WALLED_POCKET_INTERIOR = { minX: 2, minY: 2, maxX: 7, maxY: 7 };
/** Owner-1 unit that starts sealed inside the pocket, at its far corner. */
export const WALLED_POCKET_INSIDE_UNIT = { x: 2, y: 2 };
/** The pocket cell closest to `WALLED_POCKET_FAR_TARGET` — as far as a sealed
 *  unit can walk toward it. */
export const WALLED_POCKET_NEAREST_TO_FAR_TARGET = { x: 7, y: 7 };
/** Owner-1 unit that starts on the open side of the ring. */
export const WALLED_POCKET_OUTSIDE_UNIT = { x: 2, y: 33 };
/** Open, passable, and reachable from everywhere EXCEPT the pocket. */
export const WALLED_POCKET_FAR_TARGET = { x: 57, y: 33 };
/** Open and reachable from the OUTSIDE unit, 86 manhattan cells away. */
export const WALLED_POCKET_LONG_REACHABLE_TARGET = { x: 57, y: 2 };

function ringOfTrees(): ScenarioSpawnSpec[] {
  const trees: ScenarioSpawnSpec[] = [];
  const { minX, minY, maxX, maxY } = WALLED_POCKET_INTERIOR;
  for (let y = minY - 1; y <= maxY + 1; y += 1) {
    for (let x = minX - 1; x <= maxX + 1; x += 1) {
      const inside = x >= minX && x <= maxX && y >= minY && y <= maxY;
      if (inside) continue;
      trees.push(gaiaSpawn('tree', x, y, { amount: 100 }));
    }
  }
  return trees;
}

export function createWalledPocketFixture(seed: string): PrototypeScenario {
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      {
        owner: 1,
        townCenter: { x: 30, y: 16 },
        startingResources: { food: 200, wood: 200, gold: 100, stone: 100 },
      },
      { owner: 2, townCenter: { x: 50, y: 28 } },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 30, 16, { vision: 7 }),
      ownedSpawn('scout', 1, WALLED_POCKET_INSIDE_UNIT.x, WALLED_POCKET_INSIDE_UNIT.y, { vision: 6 }),
      ownedSpawn('villager', 1, 7, 2, { vision: 4 }),
      ownedSpawn('scout', 1, WALLED_POCKET_OUTSIDE_UNIT.x, WALLED_POCKET_OUTSIDE_UNIT.y, { vision: 6 }),
      ownedSpawn('town-center', 2, 50, 28, { vision: 7 }),
      ...ringOfTrees(),
    ],
  };
}
