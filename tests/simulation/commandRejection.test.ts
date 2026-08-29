import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
} from './createSimulationBridge.helpers';

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

  it('B2 invariant: same-frame market.action batch over budget — handler re-check silently no-ops the unaffordable surplus', () => {
    // DESIGN v17 §6.4 B2: validator does best-effort affordability against
    // the pre-trade stockpile, so all N submissions in the same frame
    // accept. Handler's authoritative re-check (in executeMarketActionDirect)
    // catches the post-spend overdraw and silently returns false.
    //
    // Setup: feudal-market-fixture starts food=200, market costs no food.
    // After 280 steps (market construction + a touch of gathering), food
    // is around 200 still. Each sell-food removes 100 food. Submit 5
    // sell-food commands same-frame; validator sees food=200 every time
    // and accepts all 5; handler 1 + 2 succeed (food → 100 → 0), handler
    // 3-5 silent no-op (food=0 < 100).
    const bridge = createSimulationBridge('feudal-market-fixture');

    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
    placeBuildingNearTownCenter(bridge, 'market', 1, [{ x: 17, y: 8 }]);
    for (let i = 0; i < 700; i += 1) bridge.step(100); // §12.4.2 clock (v0.3.160): walks run ~6x longer.
    expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);

    const foodBefore = bridge.getHudState().playerResources.food;
    expect(foodBefore).toBeGreaterThanOrEqual(100); // sell-food cost
    const goldBefore = bridge.getHudState().playerResources.gold;
    const affordableSells = Math.floor(foodBefore / 100);

    const submissions: boolean[] = [];
    for (let i = 0; i < affordableSells + 3; i += 1) {
      submissions.push(bridge.issueMarketAction('sell-food'));
    }
    // All submissions validator-accept (validator sees pre-spend stockpile).
    expect(submissions.every((ok) => ok === true)).toBe(true);
    // Pre-step: nothing has applied yet.
    expect(bridge.getHudState().playerResources.food).toBe(foodBefore);
    expect(bridge.getHudState().playerResources.gold).toBe(goldBefore);

    bridge.step(100);
    // After step: handlers applied sequentially. M = affordableSells
    // succeed; the surplus 3 hit the re-check and silent-no-op. Final
    // food drops by exactly affordableSells * 100, gold increases by
    // the cumulative trade revenue.
    expect(bridge.getHudState().playerResources.food).toBe(foodBefore - affordableSells * 100);
    expect(bridge.getHudState().playerResources.gold).toBeGreaterThan(goldBefore);
  }, 15_000);

  it('B2 invariant: same-frame building.placeConfirm batch over budget — handler re-check silently no-ops the unaffordable + occupied-cell surplus', () => {
    // DESIGN v17 §6.4 B2: validator does best-effort affordability +
    // placement-not-blocked against the pre-spend state; handler
    // (startConstructionDirect) re-checks authoritatively. Two same-frame
    // building.placeConfirm commands at the same anchor will both
    // validator-accept (validator can't see prior-frame submissions);
    // first handler succeeds, second handler hits placement-blocked
    // (foundation occupies the cell) and silently no-ops.
    const bridge = createSimulationBridge();
    expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);

    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    // Submit twice at the same anchor without intervening step.
    expect(bridge.confirmBuildingPlacement(14, 14)).toBe(true);
    // Second confirm: first validator-acceptance cleared placementMode,
    // so the bridge facade's "placementMode.current === null" guard
    // fires and the second submission silently rejects at HUD time
    // (mirroring pre-1B). To exercise the validator-level B2 contract,
    // we re-enter placement mode after the first submission.
    expect(bridge.beginBuildingPlacement('house')).toBe(true);
    expect(bridge.confirmBuildingPlacement(14, 14)).toBe(true);

    // Both submissions accepted at validator time (food/wood unchanged
    // pre-step; isPlacementBlocked sees pre-handler occupancy).
    const woodBefore = bridge.getHudState().playerResources.wood;
    const housesBefore = bridge
      .getEconomyState()
      .buildings.filter((b) => b.owner === 1 && b.buildingType === 'house').length;

    bridge.step(100);

    // After step: handler 1 builds the house at (10, 10) and spends; handler 2
    // re-checks placement, finds the foundation occupies the cell, silently
    // no-ops. Net: 1 house, 1 spend.
    const houses = bridge.getEconomyState().buildings.filter((b) => b.owner === 1 && b.buildingType === 'house');
    expect(houses.length - housesBefore).toBe(1);
    // House cost is 25 wood. Exactly one foundation landed → exactly one
    // 25-wood spend. The second handler hit the placement-blocked re-check
    // and silent-no-op'd (no double-spend).
    expect(woodBefore - bridge.getHudState().playerResources.wood).toBe(25);
  }, 15_000);

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
