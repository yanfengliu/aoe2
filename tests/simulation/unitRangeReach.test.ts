// The computer's relic search asks one search per state, not one per decision
// (unitRangeReach.ts; work 128, review round 0, SF2).
//
// An idle Monk whose only known relic lies out of reach is asked about it at
// every AI decision, and a failing range search explores everything the Monk
// can reach. The answer is kept for the unit's cell and the structural
// revision, and asked afresh when either changes.
//
// BOUND: the memo's contract, with a counting planner in place of the real
// one; aiMonkKnownRelics.test.ts plays the real search in a match.

import type { Position } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { createUnitRangeReach } from '../../src/game/simulation/bridge/unitRangeReach';

const MONK = 7;
const LAKE_RELIC: Position = { x: 40, y: 16 };

function setUp(reachable: boolean) {
  let revision = 1;
  let monkCell: Position | null = { x: 22, y: 16 };
  const searches: Array<{ unitId: number; target: Position; range: number }> = [];
  const world = {
    getComponent: (id: number, name: string) => (id === MONK && name === 'position' ? monkCell : undefined),
  } as unknown as GameWorld;
  const ask = createUnitRangeReach((unitId, target, range) => {
    searches.push({ unitId, target, range });
    return reachable ? { destination: target, nextStep: target } : null;
  }, () => revision);
  return {
    ask: (target = LAKE_RELIC, range = 4) => ask(MONK, target, range, world),
    searches,
    bump: () => { revision += 1; },
    moveTo: (cell: Position | null) => { monkCell = cell; },
  };
}

describe('the reach ask keeps its answer for the unit\'s cell and the structural revision', () => {
  it('searches once for an unreachable relic however often an idle Monk is asked', () => {
    const reach = setUp(false);
    for (let decision = 0; decision < 50; decision += 1) expect(reach.ask()).toBe(false);
    expect(reach.searches).toHaveLength(1);
  });

  it('keeps a reachable answer too', () => {
    const reach = setUp(true);
    expect(reach.ask()).toBe(true);
    expect(reach.ask()).toBe(true);
    expect(reach.searches).toHaveLength(1);
  });

  it('asks afresh when the ground changes, when the unit moves, or for another cell or range', () => {
    const reach = setUp(false);
    reach.ask();
    reach.bump();
    reach.ask();
    expect(reach.searches, 'a structural change did not ask afresh').toHaveLength(2);
    reach.moveTo({ x: 23, y: 16 });
    reach.ask();
    expect(reach.searches, 'the unit left its cell and the old answer was kept').toHaveLength(3);
    reach.ask({ x: 8, y: 28 });
    reach.ask(LAKE_RELIC, 9);
    expect(reach.searches).toHaveLength(5);
  });

  it('answers no for a unit that is not on the map, without a search', () => {
    const reach = setUp(true);
    reach.moveTo(null);
    expect(reach.ask()).toBe(false);
    expect(reach.searches).toHaveLength(0);
  });
});
