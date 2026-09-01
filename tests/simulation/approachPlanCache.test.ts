// The approach-plan cache must answer ONLY for the exact state its stored
// answer was computed in, because that is the whole basis for it being safe.
//
// Measured on `default-seed` warmed 33,000 ticks: 32.8 resource + 7.9 building
// A* per tick at 50 units — about one per unit per tick — while
// `movePathCache`, the pre-existing positive cache, recorded ZERO hits because
// it only covers explicit move commands and an AI never issues one.
// Pathfinding was 23% of tick self time.
//
// With the cache, three seeds at 20,000 ticks produced BYTE-IDENTICAL state
// fingerprints (every unit position, every building, resources, ages) at
// 35-58% more ticks/second. Identical output is the contract; these tests pin
// the key that makes it hold.

import { describe, expect, it } from 'vitest';

import {
  APPROACH_CACHE_LIMIT,
  createApproachPlanCache,
} from '../../src/game/simulation/bridge/approachPlanCache';

const AT = { x: 4, y: 7 };
const PLAN = { destination: { x: 9, y: 9 }, nextStep: { x: 5, y: 7 } };

describe('approach-plan cache', () => {
  it('replays the stored answer for the identical state', () => {
    const cache = createApproachPlanCache<typeof PLAN>();
    cache.set('r1:2', 5, AT, PLAN);
    expect(cache.get('r1:2', 5, AT)?.plan).toBe(PLAN);
  });

  it('does not answer once the unit has left the cell it searched from', () => {
    // The load-bearing one. A* was run FROM a cell; its answer says nothing
    // about a different cell, so the entry must stop applying the moment the
    // unit steps out of it.
    const cache = createApproachPlanCache<typeof PLAN>();
    cache.set('r1:2', 5, AT, PLAN);
    expect(cache.get('r1:2', 5, { x: 5, y: 7 })).toBeNull();
  });

  it('does not answer once topology has changed', () => {
    // structuralRevision bumps when a building, resource or terrain cell
    // changes — exactly the inputs a path depends on.
    const cache = createApproachPlanCache<typeof PLAN>();
    cache.set('r1:2', 5, AT, PLAN);
    expect(cache.get('r1:2', 6, AT)).toBeNull();
  });

  it('never answers when there is no revision to check against', () => {
    // No revision source means no way to know whether topology moved. Answering
    // anyway would be a stale path, so it must decline in both directions.
    const cache = createApproachPlanCache<typeof PLAN>();
    cache.set('r1:2', undefined, AT, PLAN);
    expect(cache.get('r1:2', undefined, AT)).toBeNull();
    expect(cache.size).toBe(0);
    cache.set('r1:2', 5, AT, PLAN);
    expect(cache.get('r1:2', undefined, AT)).toBeNull();
  });

  it('remembers a NULL plan as an answer, not as a miss', () => {
    // "No path from here" is a real result and re-deriving it is exactly the
    // cost this exists to avoid. A miss and a stored null must be
    // distinguishable, which is why get() returns a wrapper rather than a plan.
    const cache = createApproachPlanCache<typeof PLAN>();
    cache.set('r1:2', 5, AT, null);
    const hit = cache.get('r1:2', 5, AT);
    expect(hit).not.toBeNull();
    expect(hit?.plan).toBeNull();
  });

  it('keeps entries separate per key', () => {
    const cache = createApproachPlanCache<typeof PLAN>();
    const other = { destination: { x: 1, y: 1 }, nextStep: { x: 2, y: 2 } };
    cache.set('r1:2', 5, AT, PLAN);
    cache.set('b1:9:1', 5, AT, other);
    expect(cache.get('r1:2', 5, AT)?.plan).toBe(PLAN);
    expect(cache.get('b1:9:1', 5, AT)?.plan).toBe(other);
  });

  it('drops everything rather than growing without bound', () => {
    const cache = createApproachPlanCache<typeof PLAN>();
    for (let i = 0; i <= APPROACH_CACHE_LIMIT; i += 1) cache.set(`r${i}:1`, 5, AT, PLAN);
    expect(cache.size).toBeLessThanOrEqual(APPROACH_CACHE_LIMIT);
  });
});
