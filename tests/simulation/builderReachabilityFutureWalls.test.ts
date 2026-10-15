// The route a builder must walk to a new site does not count on crossing a
// foundation of its owner's or an ally's that nobody has started (work 126;
// builderReachability.ts, foundationClaims.ts).
//
// Units walk over an unstarted foundation now (update 185872), but it is a wall
// from its first build progress. A placement's route that crossed one would
// strand the new foundation the moment the first went up (the register entry of
// 2026-09-06; placementReachability.test.ts holds the human seat's queued
// chain). This is the true-map check every AI seat places by: the future walls
// come in as a mask.
//
// A builder standing on such a foundation may walk off it on any side, and the
// start puts it beside the footprint on whichever side is nearest; it cannot
// know which side it will be on when the wall goes up. So a site counts as
// reached only from every side it could be on (the review of work 126, round
// 0): in a one-cell pass the foundation fills, a site on one side is refused,
// and on open ground, where every side is one component, it is reached.
//
// BOUND: the reachability check alone, on hand-drawn 10x5 grids (a one-cell
// corridor, and the same with open rows above and below it), the future wall
// given as a mask; the bridge wires the occupancy's foundations into it
// (wirePreSeedOps.ts), and the explored-ground check reads the same rule
// (placementKnowledge.ts, `reachesFromEvery`).

import { describe, expect, it } from 'vitest';

import { createBuilderReachability } from '../../src/game/simulation/bridge/builderReachability';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';

const WIDTH = 10;
const HEIGHT = 5;
const CORRIDOR_Y = 2;
const FUTURE_WALL = { x: 4, y: CORRIDOR_Y };
/** A 1x1 site north of the corridor's east end: in the corridor its only open
 *  ring cell is (8,2). */
const SITE = { x: 8, y: 1 };
const BUILDER = 7;

function worldWithBuilderAt(cell: { x: number; y: number }): GameWorld {
  return {
    getComponent: (id: number, component: string) => {
      if (id !== BUILDER) return undefined;
      if (component === 'position') return { ...cell };
      if (component === 'unit') return { unitType: 'villager', owner: 1 };
      return undefined;
    },
  } as unknown as GameWorld;
}

/** `ground`: 'corridor' opens row 2 only; 'open' opens rows 1-3 but the site's
 *  own cell, so the foundation in row 2 splits nothing. */
function reach(builderAt: { x: number; y: number }, futureWall: boolean, ground: 'corridor' | 'open' = 'corridor'): boolean {
  const reachability = createBuilderReachability({
    mapWidth: WIDTH,
    mapHeight: HEIGHT,
    isCellPassableForUnit: (_id, x, y) => x >= 0 && x < WIDTH
      && (ground === 'corridor' ? y === CORRIDOR_Y : y >= 1 && y <= 3)
      && !(ground === 'open' && x === SITE.x && y === SITE.y),
    structuralRevision: () => 0,
    getApproachCellsForFootprint: (anchor, width, height) => {
      const ring: Array<{ x: number; y: number }> = [];
      for (let x = anchor.x; x < anchor.x + width; x += 1) ring.push({ x, y: anchor.y - 1 }, { x, y: anchor.y + height });
      for (let y = anchor.y; y < anchor.y + height; y += 1) ring.push({ x: anchor.x - 1, y }, { x: anchor.x + width, y });
      return ring;
    },
    futureWallsOf: (owner) => {
      if (!futureWall || owner !== 1) return null;
      const mask = new Uint8Array(WIDTH * HEIGHT);
      mask[FUTURE_WALL.y * WIDTH + FUTURE_WALL.x] = 1;
      return mask;
    },
  });
  return reachability.canAnyBuilderReachFootprint([BUILDER], SITE.x, SITE.y, 1, 1, worldWithBuilderAt(builderAt));
}

describe('a placement\'s route and its owner\'s unstarted foundations (work 126)', () => {
  it('does not count on crossing one, which will be a wall', () => {
    expect(reach({ x: 0, y: CORRIDOR_Y }, true), 'the route crossed a future wall').toBe(false);
  });

  it('the control: with no foundation in the corridor the same site is reached', () => {
    expect(reach({ x: 0, y: CORRIDOR_Y }, false)).toBe(true);
  });

  it('a builder standing on one in a pass it fills does not count on the side the site is on', () => {
    expect(reach(FUTURE_WALL, true), 'the site was taken as reached from one side of the pass only').toBe(false);
  });

  it('a builder standing on one in open ground reaches a site beside it, from every side', () => {
    expect(reach(FUTURE_WALL, true, 'open'), 'a builder on its own unstarted foundation reached nothing').toBe(true);
  });
});
