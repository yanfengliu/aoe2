// The judge of the builder's walk, judged (work 152 M1d).
//
// `builderWalkProbe.ts` decides, for every builder a computer seat names in the
// self-play gates, whether the seat should have sent somebody else. A judge
// that cannot fail proves nothing, so its rule is held here on hand-made
// orders, and its two searches on a hand-made grid. The claim it judges (spec
// §13.2): the builder is the nearest by walk of the villagers the policy may
// take, the lowest id on a tie; the policy passes over a villager who is the
// only one its seat has on a resource while another available villager can be
// sent, and takes the nearest of them all when none can.

import { describe, expect, it } from 'vitest';

import { betterBuilders, stepsBetween, walkToSite, type BuilderOrder, type PassabilityGrid } from './builderWalkProbe';

type Other = BuilderOrder['others'][number];
const other = (id: number, walk: number, lastOnItsResource = false): Other => ({ id, walk, lastOnItsResource });
function order(builder: { id: number; walk: number; last?: boolean; refusal?: string }, others: Other[]): BuilderOrder {
  return {
    tick: 0,
    owner: 2,
    kind: 'placement',
    buildingType: 'house',
    site: { x: 5, y: 5, width: 2, height: 2 },
    builderId: builder.id,
    builderWalk: builder.walk,
    builderAvailable: true,
    builderLastOnItsResource: builder.last ?? false,
    refusal: builder.refusal ?? null,
    others,
  };
}
const ids = (found: Array<{ id: number }>): number[] => found.map((one) => one.id);
const NEVER = Number.POSITIVE_INFINITY;

describe('who the seat should have sent instead', () => {
  it('is nobody when the builder has the shortest walk, or shares it with a higher id', () => {
    expect(betterBuilders(order({ id: 4, walk: 3 }, [other(2, 5), other(9, 3), other(1, NEVER)]))).toEqual([]);
  });

  it('is anyone with a shorter walk, and anyone with the same walk and a lower id', () => {
    expect(ids(betterBuilders(order({ id: 4, walk: 3 }, [other(2, 5), other(9, 2), other(3, 3), other(7, 3)])))).toEqual([9, 3]);
  });

  it('is not a nearer villager who is the last on its resource, while the builder is not', () => {
    expect(betterBuilders(order({ id: 4, walk: 3 }, [other(9, 1, true), other(2, 5)]))).toEqual([]);
  });

  it('is everyone else the policy may take, when the builder is a resource\'s last gatherer and one of them could go', () => {
    expect(ids(betterBuilders(order({ id: 4, walk: 1, last: true }, [other(2, 5), other(9, 8), other(7, 2, true)])))).toEqual([2, 9]);
  });

  it('is nobody when the builder is a last gatherer and nobody else could go: they are all the last, or out of reach', () => {
    expect(betterBuilders(order({ id: 4, walk: 1, last: true }, [other(7, 2, true), other(2, NEVER)]))).toEqual([]);
    // Among the last on their resources the nearest still goes.
    expect(ids(betterBuilders(order({ id: 4, walk: 6, last: true }, [other(7, 2, true), other(2, NEVER)])))).toEqual([7]);
  });

  it('is nobody when the walk reaches none of them and the lowest id is sent, as the game falls back', () => {
    expect(betterBuilders(order({ id: 2, walk: NEVER }, [other(4, NEVER), other(9, NEVER, true)]))).toEqual([]);
    expect(ids(betterBuilders(order({ id: 4, walk: NEVER }, [other(2, NEVER)])))).toEqual([2]);
  });

  it('is every villager the game would have taken, when it refuses the builder', () => {
    expect(ids(betterBuilders(order({ id: 4, walk: 0, refusal: 'placement_unreachable' }, [other(2, 30), other(9, 40, true)])))).toEqual([2, 9]);
    expect(betterBuilders(order({ id: 4, walk: 0, refusal: 'cannot_build' }, []))).toEqual([]);
  });
});

describe('the judge\'s own walks', () => {
  // . open, # closed. A wall with one gap, and a 2x2 site at (5,1).
  const rows = [
    '..#......',
    '..#..SS..',
    '..#..SS..',
    '.........',
  ];
  const grid: PassabilityGrid = {
    width: rows[0]!.length,
    height: rows.length,
    open: Uint8Array.from(rows.join('').split('').map((cell) => (cell === '.' ? 1 : 0))),
  };
  const site = { x: 5, y: 1, width: 2, height: 2 };

  it('walks round a wall to the nearest open cell beside the site', () => {
    expect(walkToSite(grid, { x: 4, y: 1 }, site), 'standing beside it').toBe(0);
    expect(walkToSite(grid, { x: 3, y: 0 }, site)).toBe(2);
    // West of the wall: down to the bottom row, through the gap, and up.
    expect(walkToSite(grid, { x: 1, y: 1 }, site)).toBe(6);
    expect(stepsBetween(grid, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(6);
  });

  it('counts the cell a villager stands on as open, and no closed cell as the place it arrives', () => {
    // On the wall itself: one step off it, then the walk from there.
    expect(walkToSite(grid, { x: 2, y: 1 }, site)).toBe(2);
    expect(stepsBetween(grid, { x: 2, y: 1 }, { x: 2, y: 0 }), 'a closed cell is nowhere to walk to').toBe(NEVER);
    // Inside the site's footprint (a foundation not yet started is open ground
    // in the game; here it is closed, and the villager steps off it).
    expect(walkToSite(grid, { x: 5, y: 1 }, site)).toBe(1);
  });

  it('reads a villager shut in, or off the map, as never arriving', () => {
    const shut: PassabilityGrid = { width: 3, height: 3, open: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]) };
    expect(walkToSite(shut, { x: 1, y: 1 }, { x: 5, y: 5, width: 1, height: 1 })).toBe(NEVER);
    expect(walkToSite(grid, { x: -1, y: 0 }, site)).toBe(NEVER);
  });
});
