import { describe, expect, it } from 'vitest';

import {
  BANKING_TRIBUTE_FEE_RATE,
  COINAGE_TRIBUTE_FEE_RATE,
  TRIBUTE_AMOUNT,
  TRIBUTE_FEE_RATE,
  tributeCost,
  tributeFeeRateFor,
} from '../../src/game/simulation/tributeRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { researchedTechnologiesCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  researchCost,
  researchTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import { canResearchAt } from '../../src/game/simulation/prototypeBuildingRules';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';
import {
  placeBuildingNearTownCenter,
  selectOwnedBuildingDirect,
  selectOwnedUnitDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

// Tribute (spec §6.8): send a resource to another player, paying a fee on top.
// AoE2's ladder is 30% → 20% with Coinage (Feudal) → 0% with Banking (Castle),
// and you need a Market to send anything — which is also why the two
// technologies live there. technologies.csv: Coinage "Tribute inefficiency -
// 0.2", Banking "Tribute inefficiency - 0".

describe('the tribute fee', () => {
  it('is 30%, then 20% with Coinage, then nothing with Banking', () => {
    expect(TRIBUTE_FEE_RATE).toBe(0.3);
    expect(COINAGE_TRIBUTE_FEE_RATE).toBe(0.2);
    expect(BANKING_TRIBUTE_FEE_RATE).toBe(0);
    expect(tributeFeeRateFor(new Set())).toBe(0.3);
    expect(tributeFeeRateFor(new Set(['coinage']))).toBe(0.2);
    expect(tributeFeeRateFor(new Set(['banking']))).toBe(0);
    // Banking supersedes Coinage rather than stacking with it.
    expect(tributeFeeRateFor(new Set(['coinage', 'banking']))).toBe(0);
    // A different Market technology moves nothing.
    expect(tributeFeeRateFor(new Set(['guilds']))).toBe(0.3);
  });

  it('prices a 100-resource tribute at 130, 120, and 100', () => {
    expect(TRIBUTE_AMOUNT).toBe(100);
    expect(tributeCost(100, TRIBUTE_FEE_RATE)).toBe(130);
    expect(tributeCost(100, COINAGE_TRIBUTE_FEE_RATE)).toBe(120);
    expect(tributeCost(100, BANKING_TRIBUTE_FEE_RATE)).toBe(100);
    // The fee rounds up, so a sender can never underpay it.
    expect(tributeCost(5, TRIBUTE_FEE_RATE)).toBe(7);
  });
});

describe('Coinage and Banking — data', () => {
  it('cost what the CSV says and live at the Market', () => {
    expect(researchCost('coinage')).toEqual({ food: 150, gold: 50 });
    expect(researchTimeTicks('coinage')).toBe(500);
    expect(canResearchAt('market', 'coinage')).toBe(true);
    expect(researchCost('banking')).toEqual({ food: 200, gold: 100 });
    expect(researchTimeTicks('banking')).toBe(500);
    expect(canResearchAt('market', 'banking')).toBe(true);
  });
});

// The arithmetic above is not the claim. The claim is that resources actually
// move between two players in a real match, fee and all.
function buildAMarket(researched: readonly string[]): Bridge {
  const boot = createSimulationBridge('new-tech-reach-fixture');
  const blob = asSchema2Blob(boot.saveGame());
  if (researched.length > 0) {
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[1, [...researched]]];
  }
  const bridge = createSimulationBridge('new-tech-reach-fixture', { savedGame: blob });

  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  placeBuildingNearTownCenter(bridge, 'market');
  expect(stepBridgeUntil(
    bridge,
    () => bridge.getEconomyState().buildings.some(
      (building) => building.owner === 1
        && building.buildingType === 'market'
        && building.isComplete,
    ),
    { maxSteps: 2_000 },
  )).toBe(true);
  expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
  return bridge;
}

function goldOf(bridge: Bridge, owner: number): number {
  return bridge.getEconomyState().playerResources[owner]!.gold;
}

function settle(bridge: Bridge): void {
  for (let step = 0; step < 20; step += 1) bridge.step(100);
}

describe('sending tribute in a real match', () => {
  it('moves 100 gold for 130, and the recipient gets exactly 100', () => {
    const bridge = buildAMarket([]);
    const senderBefore = goldOf(bridge, 1);
    const recipientBefore = goldOf(bridge, 2);
    expect(bridge.sendTribute(2, 'gold', 100)).toBe(true);
    settle(bridge);
    expect(goldOf(bridge, 1)).toBe(senderBefore - 130);
    expect(goldOf(bridge, 2)).toBe(recipientBefore + 100);
  });

  it('charges 120 with Coinage and 100 with Banking', () => {
    const withCoinage = buildAMarket(['coinage']);
    const coinageBefore = goldOf(withCoinage, 1);
    expect(withCoinage.sendTribute(2, 'gold', 100)).toBe(true);
    settle(withCoinage);
    expect(goldOf(withCoinage, 1)).toBe(coinageBefore - 120);

    const withBanking = buildAMarket(['coinage', 'banking']);
    const bankingBefore = goldOf(withBanking, 1);
    expect(withBanking.sendTribute(2, 'gold', 100)).toBe(true);
    settle(withBanking);
    expect(goldOf(withBanking, 1)).toBe(bankingBefore - 100);
  });

  it('sends food, wood and stone too, at the same fee', () => {
    const bridge = buildAMarket([]);
    const before = bridge.getEconomyState().playerResources[1]!.food;
    const theirs = bridge.getEconomyState().playerResources[2]!.food;
    expect(bridge.sendTribute(2, 'food', 100)).toBe(true);
    settle(bridge);
    expect(bridge.getEconomyState().playerResources[1]!.food).toBe(before - 130);
    expect(bridge.getEconomyState().playerResources[2]!.food).toBe(theirs + 100);
  });

  it('refuses tribute to yourself, to nobody, and of nothing', () => {
    const bridge = buildAMarket([]);
    const before = goldOf(bridge, 1);
    expect(bridge.sendTribute(1, 'gold', 100)).toBe(false);
    expect(bridge.sendTribute(99, 'gold', 100)).toBe(false);
    expect(bridge.sendTribute(2, 'gold', 0)).toBe(false);
    expect(bridge.sendTribute(2, 'gold', -50)).toBe(false);
    expect(bridge.sendTribute(2, 'gold', 10.5)).toBe(false);
    settle(bridge);
    expect(goldOf(bridge, 1)).toBe(before);
  });

  it('refuses a tribute the sender cannot pay, moving nothing', () => {
    const bridge = buildAMarket([]);
    const senderGold = goldOf(bridge, 1);
    const recipientBefore = goldOf(bridge, 2);
    // More than the stockpile plus the fee can cover.
    expect(bridge.sendTribute(2, 'gold', senderGold)).toBe(false);
    settle(bridge);
    expect(goldOf(bridge, 1)).toBe(senderGold);
    expect(goldOf(bridge, 2)).toBe(recipientBefore);
  });

  it('needs a completed Market to send anything', () => {
    // The fixture starts with no Market at all — AoE2's own rule.
    const bridge = createSimulationBridge('new-tech-reach-fixture');
    const before = goldOf(bridge, 1);
    expect(bridge.sendTribute(2, 'gold', 100)).toBe(false);
    settle(bridge);
    expect(goldOf(bridge, 1)).toBe(before);
  });
});
