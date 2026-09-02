// The premise `fog-memory-fixture` exists to set up: the enemy house starts in
// LIVE vision, so that a later test can walk the scout away and watch it become
// a remembered one.
//
// This lives in the simulation suite, not the browser spec that consumes it,
// because the browser cannot check it at a fixed tick. It ALSO used to be
// tick-sensitive here: the fixture's scout auto-engaged this very house and
// walked out of its own radius-4 vision within a few ticks, so asserting after
// three ticks failed in isolation and passed in the full suite. Nearest-first
// approaches (2026-09-02) ended the wander — a unit already in range no longer
// walks — so the premise is now stable at every tick, which the second case
// pins so a future movement change cannot quietly restore the flapping.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

function enemyHouse(bridge: ReturnType<typeof createSimulationBridge>) {
  return bridge
    .getRenderState()
    .entities.find(
      (entity) => entity.kind === 'building' && entity.entityType === 'house' && entity.owner === 2,
    );
}

describe('fog-memory-fixture premise', () => {
  it('starts the enemy house inside the scout\'s live vision', () => {
    const bridge = createSimulationBridge('fog-memory-fixture');
    const house = enemyHouse(bridge);
    expect(house, 'the fixture must place an enemy house').toBeDefined();
    expect(house!.x).toBe(14);
    expect(house!.y).toBe(10);
    expect(house!.isMemory, 'the house must START visible, or the memory test proves nothing')
      .toBe(false);
  });

  it('and the scout holds its ground, so the premise is stable to assert', () => {
    // It used to WANDER: the scout auto-engaged this house four tiles away and
    // the approach search sent it to whatever cell the enumeration named first,
    // which stepped it off (10,10) and out of its own radius-4 vision — false
    // at ticks 0-3, true at 4-6, false again by 12. Since approaches pick the
    // NEAREST cell (2026-09-02, play-test finding F2) a unit already in range
    // does not walk at all, so the house stays in LIVE vision indefinitely and
    // a consumer may assert the premise at any tick, browser boot included.
    const bridge = createSimulationBridge('fog-memory-fixture');
    for (let tick = 1; tick <= 300; tick += 1) {
      bridge.step(100);
      expect(enemyHouse(bridge)?.isMemory, `tick ${String(tick)}`).toBe(false);
    }
  });
});
