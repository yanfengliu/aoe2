// A unit that cannot reach its target's nearest cells runs at most one failed
// path search a tick, never one per candidate cell (work 123). The gate counts
// searches, not time, so a slow runner cannot pass or fail it.
//
// What happened. de-ground.spec.ts:139 orders every human unit on the boot map
// to (36, 14). The four sheep follow by herd orders, which replan every tick,
// and the planner ran one A* per candidate cell — every cell of the map,
// nearest the target first — until one reached. From tick 91 two sheep are
// boxed in beside their Town Centre: 1,781-2,759 searches a tick with the AI
// off (measured 2026-10-11, this fixture), 300-600 ms of a 100 ms tick in
// Node, and 84-90 s of the spec's 90 s limit on CI. The planner now floods the
// start's reachable cells after one failed search and skips the rest
// (tests/simulation/movementPlanCandidateReach.test.ts holds the answers equal).
//
// The fixture is that walk with the AI off on both seats, so every search is
// the human's eight units' (three villagers, the scout, four sheep). It checks
// that the boxed-in state is still reached — a failed search made by the herd
// system (read off the call stack) on at least ten ticks — or the count below
// would pass without exercising anything.
//
// BOUND: one map, one order, 110 ticks; findGridPath calls only (the engine's
// one grid search, which the planner calls), counted through a module mock.

import { describe, expect, it, vi } from 'vitest';

const searches = vi.hoisted(() => ({ calls: 0, failed: 0, herdFailed: 0 }));
vi.mock('civ-engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('civ-engine')>();
  return {
    ...actual,
    findGridPath: (...args: Parameters<typeof actual.findGridPath>) => {
      searches.calls += 1;
      const result = actual.findGridPath(...args);
      if (result === null) {
        searches.failed += 1;
        if (new Error().stack?.includes('herdableMovementSystem')) searches.herdFailed += 1;
      }
      return result;
    },
  };
});

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('a boxed-in move', () => {
  it('runs at most one failed search per ordered unit a tick, from a herd boxed in beside its Town Centre', () => {
    const bridge = createSimulationBridge('aoe2-prototype', { disableAiForOwners: new Set([1, 2]) });
    const size = bridge.getMapSize();
    expect(bridge.selectUnitsInBox(0, 0, size.width, size.height)).toBe(true);
    const ordered = bridge.getSelectionState().selectedEntityIds.length;
    expect(ordered, 'three villagers, the scout and four sheep').toBe(8);
    expect(bridge.issueMoveCommand(36, 14)).toBe(true);
    let boxedInTicks = 0;
    for (let tick = 1; tick <= 110; tick += 1) {
      searches.calls = 0;
      searches.failed = 0;
      searches.herdFailed = 0;
      bridge.step(100);
      if (searches.herdFailed > 0) boxedInTicks += 1;
      expect(searches.failed, `failed path searches at tick ${String(tick)}`).toBeLessThanOrEqual(ordered);
      expect(searches.calls, `path searches at tick ${String(tick)}`).toBeLessThanOrEqual(3 * ordered);
    }
    expect(boxedInTicks, 'ticks with a failed herd search: the fixture no longer boxes a sheep in').toBeGreaterThanOrEqual(10);
  });
});
