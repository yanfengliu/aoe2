import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createTerrainCell } from '../../mapGeneration/sharedTerrainHelpers';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// The AI's whole economy froze in a measured 30000-tick match because six of
// its villagers latched onto ONE sheep they could not reach and never let go:
// the reachability-aware recovery gave up, left the villager idle, and the
// ordinary idle→assign — which does not check reachability — picked the same
// nearest sheep straight back, every tick, forever. The state at tick 21000
// and tick 26000 was byte-identical (food 19, wood 19, 15 villagers).
//
// This fixture isolates the shape with NO reachable food at all: the only food
// on the map is a sheep on a one-cell island, and the only other work is wood.
// A villager that cannot reach any food must take wood instead (which is both
// what `assignIdleGatherer` was written to do and what a real player does), so
// the discriminator is simply that the owner's WOOD rises.
//
// Water is what seals the sheep, deliberately: a ring of trees would hand the
// villagers the very wood the test measures, and a ring of buildings would
// make the fixture about placement rather than about the gather loop.
export function createGatherIslandFoodFixture(seed: string): PrototypeScenario {
  const terrain = createGrassFixtureTerrain();
  const island = { x: 4, y: 4 };
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const x = island.x + dx;
      const y = island.y + dy;
      terrain[y]![x] = createTerrainCell(x, y, 'water');
    }
  }
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain,
    starts: [
      // Far, passive placeholder.
      { owner: 1, townCenter: { x: 50, y: 30 }, disableAi: true },
      // Economy under test: planner disabled, but a non-human owner's
      // villager-economy auto-gather still runs.
      { owner: 2, townCenter: { x: 8, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 50, 30, { vision: 7 }),
      ownedSpawn('town-center', 2, 8, 8, { vision: 7 }),
      // The only food on the map, marooned. Owned by player 2 so it is the
      // top-tier candidate its villagers reach for first.
      ownedSpawn('sheep', 2, island.x, island.y, { amount: 100, vision: 2 }),
      // The only other work: trees on open ground east of the Town Center.
      gaiaSpawn('tree', 13, 8, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('tree', 13, 9, { baseOwner: 2, amount: 100 }),
      gaiaSpawn('tree', 13, 10, { baseOwner: 2, amount: 100 }),
      // Exactly two villagers, so both take the food role (ordinals 0 and 1)
      // and nothing chops wood by default — every log gathered here is a
      // villager that gave up on the unreachable sheep.
      ownedSpawn('villager', 2, 6, 6, { vision: 4 }),
      ownedSpawn('villager', 2, 7, 6, { vision: 4 }),
    ],
  };
}
