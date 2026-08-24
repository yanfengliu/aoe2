import { describe, expect, it } from 'vitest';

import { MARKET_FEE_RATE } from '../../src/game/simulation/bridge/bridgeConstants';
import {
  GUILDS_MARKET_FEE_RATE,
  marketFeeRateFor,
} from '../../src/game/simulation/marketTechEffects';
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

// technologies.csv, Guilds (Market, Imperial, 300 food + 200 gold, 50s):
// "Commodity trading fee - 15% (from 30%)". The fee is the spread between what
// a buy costs and what a sell returns, so it is worth more the more you trade.

describe('Guilds — data', () => {
  it('costs what the CSV says and lives at the Market', () => {
    expect(researchCost('guilds')).toEqual({ food: 300, gold: 200 });
    expect(researchTimeTicks('guilds')).toBe(500);
    expect(canResearchAt('market', 'guilds')).toBe(true);
  });

  it('halves the Market’s cut, and leaves it alone otherwise', () => {
    expect(MARKET_FEE_RATE).toBe(0.3);
    expect(GUILDS_MARKET_FEE_RATE).toBe(0.15);
    expect(marketFeeRateFor(new Set())).toBe(MARKET_FEE_RATE);
    expect(marketFeeRateFor(new Set(['guilds']))).toBe(GUILDS_MARKET_FEE_RATE);
    // Another Market technology must not move the fee.
    expect(marketFeeRateFor(new Set(['cartography']))).toBe(MARKET_FEE_RATE);
  });
});

// The arithmetic above is not the claim. The claim is that a player selling
// wood at a real Market is paid more once Guilds is done.
function buildAMarket(researched: readonly string[]): Bridge {
  const boot = createSimulationBridge('new-tech-reach-fixture');
  const blob = asSchema2Blob(boot.saveGame());
  if (researched.length > 0) {
    worldStateOf(blob)[researchedTechnologiesCodec.slot] = [[1, [...researched]]];
  }
  const bridge = createSimulationBridge('new-tech-reach-fixture', { savedGame: blob });

  expect(selectOwnedUnitDirect(bridge, 1, 'villager')).toBe(true);
  expect(bridge.getSelectionState().buildOptions).toContain('market');
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
  return bridge;
}

function goldFromOneSale(bridge: Bridge): number {
  expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
  const before = bridge.getEconomyState().playerResources[1]!.gold;
  expect(bridge.issueMarketAction('sell-wood')).toBe(true);
  for (let step = 0; step < 20; step += 1) bridge.step(100);
  return bridge.getEconomyState().playerResources[1]!.gold - before;
}

describe('Guilds — what a player is actually paid', () => {
  it('returns more gold for the same wood, at the same exchange rate', () => {
    // The FIRST sale in each run, because selling moves the rate.
    const plain = goldFromOneSale(buildAMarket([]));
    const guilded = goldFromOneSale(buildAMarket(['guilds']));
    expect(plain).toBeGreaterThan(0);
    expect(guilded).toBeGreaterThan(plain);
  }, 120_000);
});

describe('Guilds — reachable at a Market', () => {
  it('is offered in the Imperial Age and drops out once researched', () => {
    const bridge = buildAMarket([]);
    expect(selectOwnedBuildingDirect(bridge, 1, 'market')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('guilds');
    expect(bridge.queueResearch('guilds')).toBe(true);

    expect(stepBridgeUntil(
      bridge,
      () => {
        selectOwnedBuildingDirect(bridge, 1, 'market');
        return !bridge.getSelectionState().researchOptions.includes('guilds');
      },
      { maxSteps: 1_500 },
    )).toBe(true);
  }, 120_000);
});
