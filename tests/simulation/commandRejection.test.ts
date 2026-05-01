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
      // Phase 1B queue.train: validators see the post-spend stockpile only
      // after the prior submission's handler has run. Step between
      // submissions so the affordability rejection lands on the 5th attempt.
      bridge.step(100);
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

  it('B2 invariant: same-frame queue.train batch over budget — handler re-check silently no-ops the unaffordable surplus', () => {
    // DESIGN v17 §6.4 B2: validator does best-effort affordability against
    // the pre-spend stockpile, so all N submissions in the same frame
    // accept. The handler's authoritative re-check (in enqueueTrainingDirect)
    // catches the post-spend overdraw and silently returns false. After ONE
    // bridge.step processes the queued commands, exactly M succeed (where
    // M = floor(stockpile / cost)) and the remaining N - M have no effect.
    const bridge = createSimulationBridge();
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    // Standard starting food = 200; villager cost = 50; affordable count = 4.
    // Submit 5 same-frame; expect exactly 4 enqueued + food drained to 0.
    const submissions: boolean[] = [];
    for (let index = 0; index < 5; index += 1) {
      submissions.push(bridge.queueTrainUnit('villager'));
    }
    expect(submissions).toEqual([true, true, true, true, true]);
    // Pre-step: nothing has executed yet — production queue empty + food unchanged.
    expect(bridge.getSelectionState().queue).toHaveLength(0);
    expect(bridge.getHudState().playerResources.food).toBe(200);

    // One step drains all 5 commands. Handler 1-4 succeed; handler 5 silent
    // no-ops (insufficient food).
    bridge.step(100);
    expect(bridge.getSelectionState().queue).toHaveLength(4);
    expect(bridge.getHudState().playerResources.food).toBe(0);
  });
});
