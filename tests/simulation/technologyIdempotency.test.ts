import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function findOwnedMilitia(bridge: Bridge, owner: number) {
  return bridge
    .getEconomyState()
    .units.find((unit) => unit.owner === owner && unit.unitType === 'militia');
}

describe('iter-2 H2-1 — research idempotency across multiple producer buildings', () => {
  it('Forging only grants +1 attack even when both Blacksmiths complete the same research', () => {
    // Two Blacksmiths owned by player 1 race-queue Forging at the same
    // tick. Without an idempotency guard in applyTechnology, the
    // production-queue completion path fires twice and the +1 increment
    // doubles to +2. Canonical AoE2 caps the bonus at the per-tier value.
    const bridge = createSimulationBridge('double-blacksmith-race-fixture');

    const baseMilitia = findOwnedMilitia(bridge, 1);
    expect(baseMilitia).toBeDefined();
    expect(baseMilitia?.attackDamage).toBe(4);

    // Confirm the fixture really has two Blacksmiths.
    const blacksmiths = bridge
      .getEconomyState()
      .buildings.filter((b) => b.owner === 1 && b.buildingType === 'blacksmith');
    expect(blacksmiths).toHaveLength(2);

    // Queue Forging at Blacksmith A.
    expect(bridge.selectEntityAtCell(4, 6)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(bridge.queueResearch('forging')).toBe(true);

    // Queue Forging at Blacksmith B. Today this returns true because
    // enqueueResearch only dedupes within the same building's queue;
    // both researches will run to completion. The fix ensures
    // applyTechnology is idempotent so the second completion is a
    // no-op.
    expect(bridge.selectEntityAtCell(16, 6)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(bridge.queueResearch('forging')).toBe(true);

    // Step until at least one completion fires.
    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findOwnedMilitia(bridge, 1);
          return !!militia && militia.attackDamage > 4;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Step a generous tail so the second-completing Blacksmith also
    // runs through applyTechnology.
    for (let i = 0; i < 200; i += 1) {
      bridge.step(100);
    }

    const finalMilitia = findOwnedMilitia(bridge, 1);
    expect(finalMilitia?.attackDamage).toBe(5);
  }, 30_000);
});
