import {
  MAP_HEIGHT,
  MAP_WIDTH,
  type PrototypeScenario,
} from '../../prototypeScenario';
import { createGrassFixtureTerrain } from '../common';

// campaign-11 regression. A food resource boxed in by tree blockers (every
// approach cell sealed → no path to it) used to deadlock villagers in
// `to-resource` forever: the gather state machine fell to `idle`, the
// bottom-of-loop idle→assign re-picked the same NEAREST unreachable resource
// every tick, and the reachable berries were never tried — food income stayed
// 0 and the player never left the Dark Age. (In campaign-11 the trap was the
// player's own boxed-in sheep; with the food villagers split across two
// unreachable owned sheep the over-subscription fan-out shuffled them between
// the sheep but never down to the reachable berries.)
//
// This fixture reproduces the essence via the SATURATION cap, not the owner
// tier: the boxed farm is the NEAREST food, and there are FEWER food villagers
// than the over-subscription fan-out cap (4), so the fan-out never triggers and
// they all stay latched on the nearest unreachable food. (A farm's food
// resource spawns neutral/home-base — tier-1 like the berries — so the owner
// tier does NOT separate them here; the count-below-cap is what keeps them
// stuck. The 3 spawned villagers default to food/food/wood, so 2 chase the
// farm and the 3rd harmlessly chops a ring tree.) Player 2 owns the economy
// under test (its non-human villagers auto-gather without an explicit order
// even with the AI planner disabled); player 1 is a far, passive placeholder.
export function createGatherUnreachableRerouteFixture(seed: string): PrototypeScenario {
  const ringOffsets: ReadonlyArray<readonly [number, number]> = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];
  return {
    seed,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    terrain: createGrassFixtureTerrain(),
    starts: [
      // Far, passive placeholder.
      { owner: 1, townCenter: { x: 50, y: 30 }, disableAi: true },
      // Economy under test. Planner disabled (deterministic) but the
      // villager-economy auto-gather still runs for this non-human owner.
      { owner: 2, townCenter: { x: 8, y: 8 }, disableAi: true },
    ],
    spawns: [
      {
        kind: 'town-center',
        x: 50,
        y: 30,
        owner: 1,
        baseOwner: 1,
        vision: { playerId: 1, radius: 7 },
      },
      {
        kind: 'town-center',
        x: 8,
        y: 8,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 7 },
      },
      // The boxed-in (unreachable) FARM — the NEAREST food to player 2's
      // villagers. (Its food resource spawns neutral/home-base [tier-1] despite
      // the owner: 2 spawn field; the reproduction relies on the below-cap
      // villager count, not the tier — see the header note.)
      {
        kind: 'farm',
        x: 4,
        y: 4,
        owner: 2,
        baseOwner: 2,
        farmFood: 175,
        vision: { playerId: 2, radius: 2 },
      },
      // Ring of trees sealing every approach cell of the boxed farm.
      ...ringOffsets.map(([dx, dy]) => ({
        kind: 'tree' as const,
        x: 4 + dx,
        y: 4 + dy,
        owner: null,
        baseOwner: null,
        amount: 100,
      })),
      // Reachable berries to the east (open approach cells), tier-1 (neutral,
      // home-base of player 2) so the tier-0 farm always outranks them in
      // assignment — the villagers only reach these once the reroute skips the
      // unreachable farm.
      {
        kind: 'berry-bush',
        x: 12,
        y: 4,
        owner: null,
        baseOwner: 2,
        amount: 200,
      },
      {
        kind: 'berry-bush',
        x: 13,
        y: 4,
        owner: null,
        baseOwner: 2,
        amount: 200,
      },
      {
        kind: 'berry-bush',
        x: 12,
        y: 5,
        owner: null,
        baseOwner: 2,
        amount: 200,
      },
      // Three player-2 villagers just east of the boxed farm's ring (open
      // cells, clear of the Town Center footprint at (8,8)-(11,11)). They
      // auto-assign to the tier-0 farm first (unreachable) before the reachable
      // berries.
      {
        kind: 'villager',
        x: 7,
        y: 3,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 4,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
      {
        kind: 'villager',
        x: 7,
        y: 5,
        owner: 2,
        baseOwner: 2,
        vision: { playerId: 2, radius: 4 },
      },
    ],
  };
}
