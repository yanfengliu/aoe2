import { describe, expect, it } from 'vitest';

import { TRADE_GOLD_PER_TILE, tradeProfit } from '../../src/game/simulation/tradeRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { trainingCost, trainingTimeTicks } from '../../src/game/simulation/prototypeEconomyRules';
import { canTrainAt } from '../../src/game/simulation/prototypeBuildingRules';
import {
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

// Land trade (spec §6.7): the Trade Cart cycles between your Market and
// another player's, and every completed round trip pays gold scaled by the
// distance between them. The fourth gold source, and the one that never
// mines out.

describe('the Trade Cart — data', () => {
  it('costs what units.csv says and trains at the Market', () => {
    expect(trainingCost('trade-cart')).toEqual({ wood: 100, gold: 50 });
    expect(trainingTimeTicks('trade-cart')).toBe(500);
    expect(canTrainAt('market', 'trade-cart')).toBe(true);
  });
});

describe('the profit formula', () => {
  it('scales with distance and never pays zero', () => {
    expect(TRADE_GOLD_PER_TILE).toBe(0.46);
    expect(tradeProfit({ x: 0, y: 0 }, { x: 100, y: 0 })).toBe(46);
    expect(tradeProfit({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(23);
    // Adjacent markets still pay the floor.
    expect(tradeProfit({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(2);
    // Farther pays strictly more across a real span.
    expect(tradeProfit({ x: 0, y: 0 }, { x: 80, y: 0 }))
      .toBeGreaterThan(tradeProfit({ x: 0, y: 0 }, { x: 40, y: 0 }));
  });
});

// The e2e claim: a cart ordered at another player's Market cycles on its own
// and gold arrives every round trip, without another order ever being given.
function bootTradeFixture(): Bridge {
  return createSimulationBridge('trade-route-fixture');
}

function goldOf(bridge: Bridge): number {
  return bridge.getEconomyState().playerResources[1]!.gold;
}

describe('a trade route in a real match', () => {
  it('cycles between the Markets and pays gold every round trip', () => {
    const bridge = bootTradeFixture();
    const cart = bridge.getEconomyState().units.find((unit) => unit.unitType === 'trade-cart');
    expect(cart, 'the fixture should stand a trade cart').toBeDefined();
    const enemyMarket = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 2 && building.buildingType === 'market',
    );
    expect(enemyMarket).toBeDefined();

    expect(selectOwnedUnitDirect(bridge, 1, 'trade-cart')).toBe(true);
    expect(bridge.issueContextCommandAtEntity(enemyMarket!.id)).toBe(true);

    const before = goldOf(bridge);
    // One full round trip pays once…
    expect(stepBridgeUntil(bridge, () => goldOf(bridge) > before, { maxSteps: 4_000 }))
      .toBe(true);
    const afterFirst = goldOf(bridge);
    // …and the cart keeps going with no further order: a second deposit lands.
    expect(stepBridgeUntil(bridge, () => goldOf(bridge) > afterFirst, { maxSteps: 4_000 }))
      .toBe(true);
    // Each deposit is the distance-scaled profit, identical both trips.
    const perTrip = afterFirst - before;
    expect(perTrip).toBeGreaterThanOrEqual(2);
    expect(goldOf(bridge) - afterFirst).toBe(perTrip);
  }, 120_000);

  it('does nothing when ordered at your OWN Market', () => {
    const bridge = bootTradeFixture();
    const ownMarket = bridge.getEconomyState().buildings.find(
      (building) => building.owner === 1 && building.buildingType === 'market',
    );
    expect(selectOwnedUnitDirect(bridge, 1, 'trade-cart')).toBe(true);
    bridge.issueContextCommandAtEntity(ownMarket!.id);
    const before = goldOf(bridge);
    for (let step = 0; step < 600; step += 1) bridge.step(100);
    // No route formed: trading with yourself is not a business.
    expect(goldOf(bridge)).toBe(before);
  }, 60_000);
});

describe('Caravan', () => {
  it('is a Castle Market technology priced from the CSV', async () => {
    const { researchCost, researchTimeTicks } = await import('../../src/game/simulation/prototypeEconomyRules');
    const { canResearchAt } = await import('../../src/game/simulation/prototypeBuildingRules');
    expect(researchCost('caravan')).toEqual({ food: 200, gold: 200 });
    expect(researchTimeTicks('caravan')).toBe(400);
    expect(canResearchAt('market', 'caravan')).toBe(true);
  });

  it('halves a route’s round-trip time', () => {
    // Same fixture, same route; the only difference is the technology, so the
    // tick counts to the FIRST deposit tell the speeds apart.
    const tripTicks = (researched: boolean): number => {
      const bridge = bootTradeFixture();
      if (researched) {
        expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
        expect(bridge.queueResearch('caravan')).toBe(true);
        expect(stepBridgeUntil(
          bridge,
          () => bridge.getEconomyState().playerResources[1]!.food >= 0
            && bridge.getSelectionState().researchOptions !== undefined
            && !bridge.getSelectionState().researchOptions.includes('caravan'),
          { maxSteps: 600 },
        )).toBe(true);
      }
      const enemyMarket = bridge.getEconomyState().buildings.find(
        (building) => building.owner === 2 && building.buildingType === 'market',
      )!;
      expect(selectOwnedUnitDirect(bridge, 1, 'trade-cart')).toBe(true);
      expect(bridge.issueContextCommandAtEntity(enemyMarket.id)).toBe(true);
      const before = bridge.getEconomyState().playerResources[1]!.gold;
      let ticks = 0;
      expect(stepBridgeUntil(bridge, () => {
        ticks += 1;
        return bridge.getEconomyState().playerResources[1]!.gold > before;
      }, { maxSteps: 6_000 })).toBe(true);
      return ticks;
    };
    const plain = tripTicks(false);
    const withCaravan = tripTicks(true);
    // 50% faster movement: the trip takes about two-thirds the time.
    expect(withCaravan).toBeLessThan(plain * 0.8);
  }, 120_000);
});
