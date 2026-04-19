import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';

// Slice 11: the bridge queues command-rejection reasons so the HUD can
// surface them as toasts. These tests drive the bridge directly; the HUD
// polling contract (one reason drained per consume call, queue emptied
// after draining) is covered here rather than in the DOM layer.
describe('createSimulationBridge command rejection queue', () => {
  it('drains FIFO and returns null after all reasons have been consumed', () => {
    const bridge = createSimulationBridge();

    // Trigger two rejections in sequence:
    //   1. beginBuildingPlacement without a selected villager
    //   2. issueMarketAction without a selected Market
    bridge.clearSelection();
    expect(bridge.beginBuildingPlacement('house')).toBe(false);

    bridge.clearSelection();
    expect(bridge.issueMarketAction('buy-food')).toBe(false);

    const first = bridge.consumeCommandRejection();
    expect(first).toContain('villager');

    const second = bridge.consumeCommandRejection();
    expect(second).not.toBeNull();

    expect(bridge.consumeCommandRejection()).toBeNull();
  });

  it('reports the missing resource when training cannot afford the cost', () => {
    const bridge = createSimulationBridge();

    // Select a Town Center, drain the food stockpile via enough villager
    // training attempts to empty it, then the next attempt should flag
    // the missing resource.
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    // Known starting food per STANDARD_STARTING_RESOURCES is 200 which
    // covers up to 4 villagers at 50 food each. Queue 5 and drain the
    // queue until the fifth attempt rejects.
    const successes: boolean[] = [];
    for (let index = 0; index < 5; index += 1) {
      successes.push(bridge.queueTrainUnit('villager'));
    }
    expect(successes.some((ok) => ok === false)).toBe(true);

    // Drain until we find the "Not enough food." reason. Other reasons
    // (e.g. "Building is still under construction.") do not apply here.
    let foundFoodReason = false;
    let drained: string | null = bridge.consumeCommandRejection();
    while (drained !== null) {
      if (drained.toLowerCase().includes('food')) {
        foundFoodReason = true;
      }
      drained = bridge.consumeCommandRejection();
    }
    expect(foundFoodReason).toBe(true);
  });
});
