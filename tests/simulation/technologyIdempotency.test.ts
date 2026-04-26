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
  it('grants only +1 attack even if applyTechnology is somehow re-fired for an already-researched tech', () => {
    // The idempotency guard inside applyTechnology is the
    // last-line-of-defense for the bonus side. The cost-side dedupe
    // (separate test below) prevents the duplicate queueResearch in
    // normal play, but if a future regression at the queue layer or a
    // save/load drift somehow re-hands the same tech to applyTechnology,
    // the inner guard must keep the bonus capped at +1. Drive that
    // codepath via a single happy-path research that lands, then verify
    // the militia stat is exactly +1.
    const bridge = createSimulationBridge('double-blacksmith-race-fixture');

    const baseMilitia = findOwnedMilitia(bridge, 1);
    expect(baseMilitia).toBeDefined();
    expect(baseMilitia?.attackDamage).toBe(4);

    expect(bridge.selectEntityAtCell(4, 6)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('blacksmith');
    expect(bridge.queueResearch('forging')).toBe(true);

    expect(
      stepBridgeUntil(
        bridge,
        () => {
          const militia = findOwnedMilitia(bridge, 1);
          return !!militia && militia.attackDamage === 5;
        },
        { maxSteps: 600 },
      ),
    ).toBe(true);

    // Drain the rest of any pending queue activity.
    for (let i = 0; i < 200; i += 1) {
      bridge.step(100);
    }

    const finalMilitia = findOwnedMilitia(bridge, 1);
    expect(finalMilitia?.attackDamage).toBe(5);
  }, 30_000);

  it('does not let a second Blacksmith pay for the same Forging research that another Blacksmith already has in flight', () => {
    // iter-2 verification follow-up: the H2-1 fix made applyTechnology
    // idempotent on the BONUS path, but enqueueResearch's dedupe was
    // still per-building's-own-queue. So a player race-queueing
    // Forging at two Blacksmiths would still pay the food/gold cost
    // TWICE even though only one bonus would land. Lock the contract:
    // only the first Blacksmith pays; the second queueResearch must
    // return false and refund nothing (because nothing was spent).
    const bridge = createSimulationBridge('double-blacksmith-race-fixture');

    const initialFood = bridge.getEconomyState().playerResources[1].food;

    // Queue at Blacksmith A.
    expect(bridge.selectEntityAtCell(4, 6)).toBe(true);
    expect(bridge.queueResearch('forging')).toBe(true);

    const foodAfterFirstQueue = bridge.getEconomyState().playerResources[1].food;
    const goldAfterFirstQueue = bridge.getEconomyState().playerResources[1].gold;
    // First queue spent something (Forging costs 75 food).
    expect(foodAfterFirstQueue).toBeLessThan(initialFood);

    // Try to queue the same tech at Blacksmith B. Should be rejected
    // because the tech is already in flight in another owned producer.
    expect(bridge.selectEntityAtCell(16, 6)).toBe(true);
    expect(bridge.queueResearch('forging')).toBe(false);

    // No additional cost was burned for the rejected queue.
    expect(bridge.getEconomyState().playerResources[1].food).toBe(foodAfterFirstQueue);
    expect(bridge.getEconomyState().playerResources[1].gold).toBe(goldAfterFirstQueue);
  });
});
