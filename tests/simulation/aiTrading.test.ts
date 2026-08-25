import { describe, expect, it } from 'vitest';

import { AI_TRADE_CART_CAP } from '../../src/game/simulation/bridge/systems/aiTradePhase';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { stepBridgeUntil } from './createSimulationBridge.helpers';

// Spec §6.7's last required system: the AI trades on its own. Given a Market
// of its own and anybody else's to run to, an AI trains Trade Carts (up to a
// small cap) and routes them without being told — the same recorded command
// channel a human's right-click uses.

describe('an AI with a Market trades on its own', () => {
  it('trains carts, routes them, and gold arrives from the route', () => {
    // ai-trade-fixture stands a Market for each player with player 2's AI
    // LIVE (disableAi beats forceAi by design, so the passive trade fixture
    // cannot be switched on from options).
    const bridge = createSimulationBridge('ai-trade-fixture');

    // The AI trains a cart at its Market…
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'trade-cart',
      ),
      { maxSteps: 2_000 },
    ), 'the AI never trained a trade cart').toBe(true);

    // …routes it at the other player's Market with no order from anybody…
    expect(stepBridgeUntil(
      bridge,
      () => bridge.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'trade-cart' && unit.task === 'trading',
      ),
      { maxSteps: 1_000 },
    ), 'the AI never routed its cart').toBe(true);

    // …and the route pays: owner 2's gold strictly rises across round trips.
    const goldAt = () => bridge.getEconomyState().playerResources[2]!.gold;
    const before = goldAt();
    expect(stepBridgeUntil(bridge, () => goldAt() > before, { maxSteps: 6_000 }),
      'no gold ever arrived from the route').toBe(true);
  }, 180_000);

  it('stops at the cap instead of drowning its economy in carts', () => {
    const bridge = createSimulationBridge('ai-trade-fixture');
    for (let step = 0; step < 4_000; step += 1) bridge.step(100);
    const carts = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 2 && unit.unitType === 'trade-cart',
    );
    expect(carts.length).toBeLessThanOrEqual(AI_TRADE_CART_CAP);
    expect(carts.length).toBeGreaterThan(0);
  }, 120_000);
});
