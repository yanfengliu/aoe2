// The premise `fog-memory-fixture` exists to set up: the enemy house starts in
// LIVE vision, so that a later test can walk the scout away and watch it become
// a remembered one.
//
// This lives in the simulation suite, not the browser spec that consumes it,
// because the browser cannot check it at a fixed tick. Boot there advances a
// variable number of ticks under load, and the fixture's scout auto-engages
// this very house and steps out of its own radius-4 vision almost immediately:
// asserting after three ticks failed in isolation and passed in the full suite,
// and asserting after none did exactly the reverse. Here the tick count is
// deterministic, so the premise can be stated once and stated honestly.

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

  it('and the scout leaves on its own, which is why nothing may assume it stays', () => {
    // Not a defect — a scout auto-engaging an enemy building four tiles away is
    // ordinary behaviour. It is recorded because it is the reason the browser
    // spec cannot pin the premise at a fixed tick: measured false at ticks 0-3,
    // true at 4-6, and false again by 12 as the scout drifts back.
    const bridge = createSimulationBridge('fog-memory-fixture');
    let becameMemory: number | null = null;
    for (let tick = 1; tick <= 8 && becameMemory === null; tick += 1) {
      bridge.step(100);
      if (enemyHouse(bridge)?.isMemory === true) becameMemory = tick;
    }
    expect(
      becameMemory,
      'the scout no longer wanders off — the browser spec may be able to pin the premise directly again',
    ).not.toBeNull();
  });
});
