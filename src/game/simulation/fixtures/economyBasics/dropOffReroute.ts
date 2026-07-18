import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain, ownedSpawn, gaiaSpawn } from '../common';

// AI-vs-AI grounding regression (2026-07-01). The SYMMETRIC twin of the
// campaign-11 gather-unreachable-reroute (v0.1.47): that fix rerouted a
// villager off an unreachable RESOURCE, but the DROP-OFF leg kept the same
// deadlock. A villager that gathered to a full carry, then found its NEAREST
// drop-off building unreachable (all approach cells blocked — e.g. the AI
// packed buildings around its own Town Center), latched in `to-dropoff`
// forever: `findNearestDropOffBuilding` returns the nearest by distance with
// no reachability check, and the economy loop just `setStuck` and retried the
// SAME unreachable nearest every interval, never trying a farther REACHABLE
// drop-off. Deposited food froze, so the owner never reached the 500 food for
// Feudal and stayed in the Dark Age all game (found by replaying an 8000-tick
// AI-vs-AI run: food pinned at 121, villagers pinned at 6, two food villagers
// perpetually `to-dropoff` carrying 10 each).
//
// This fixture reproduces the essence: player 2 owns a reachable berry cluster
// (its villagers gather it and fill up) whose NEAREST food drop-off is a Mill
// sealed by a tree ring (every approach cell blocked → unreachable). The only
// other food drop-off is the Town Center, farther but reachable. Pre-fix the
// villagers latch on the unreachable-nearest Mill and never deposit (food
// flat); the fix reroutes them to the reachable Town Center so food rises.
// Player 2 owns the economy under test (its non-human villagers auto-gather
// without an explicit order even with the AI planner disabled); player 1 is a
// far, passive placeholder.
export function createDropOffUnreachableRerouteFixture(seed: string): PrototypeScenario {
  // 2x2 Mill anchored at (20,12) → footprint cells (20..21, 12..13). Ring every
  // perimeter cell (including corners) with trees so no approach cell is
  // reachable. This Mill is the NEAREST food drop-off to the berry cluster.
  const millAnchor = { x: 20, y: 12 };
  const ringCells: ReadonlyArray<readonly [number, number]> = [
    // top row (y = 11) and bottom row (y = 14), x from 19..22
    [19, 11], [20, 11], [21, 11], [22, 11],
    [19, 14], [20, 14], [21, 14], [22, 14],
    // left column (x = 19) and right column (x = 22), y from 12..13
    [19, 12], [19, 13],
    [22, 12], [22, 13],
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // Far, passive placeholder.
      { owner: 1, townCenter: { x: 50, y: 28 }, disableAi: true },
      // Economy under test. Planner disabled (deterministic) but the
      // villager-economy auto-gather still runs for this non-human owner.
      { owner: 2, townCenter: { x: 8, y: 8 }, disableAi: true },
    ],
    spawns: [
      ownedSpawn('town-center', 1, 50, 28, { vision: 7 }),
      // The REACHABLE drop-off — farther than the boxed Mill, so the fix must
      // fall through to it once the unreachable-nearest Mill is skipped.
      ownedSpawn('town-center', 2, 8, 8, { vision: 7 }),
      // The boxed (unreachable) Mill — the NEAREST food drop-off to the berries.
      ownedSpawn('mill', 2, millAnchor.x, millAnchor.y, { vision: 2 }),
      // Tree ring sealing every approach cell of the boxed Mill.
      ...ringCells.map(([x, y]) => ({
        kind: 'tree' as const,
        x,
        y,
        owner: null,
        baseOwner: null,
        amount: 100,
      })),
      // Reachable berry cluster the villagers gather (home-base neutral of
      // player 2, tier-1). Sits between the Mill (south, boxed) and the TC
      // (west, reachable): the villagers fill up here, then head to drop off.
      gaiaSpawn('berry-bush', 20, 8, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 21, 8, { baseOwner: 2, amount: 400 }),
      gaiaSpawn('berry-bush', 20, 9, { baseOwner: 2, amount: 400 }),
      // Two player-2 villagers just west of the berries (open cells, clear of
      // the Town Center footprint at (8,8)-(11,11) and the berry cells). They
      // auto-assign to the reachable berries, fill up, then must drop off.
      ownedSpawn('villager', 2, 18, 8, { vision: 4 }),
      ownedSpawn('villager', 2, 18, 9, { vision: 4 }),
    ],
  };
}
