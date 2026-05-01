// Phase 1B market.action tests.

import { describe, it, expect } from 'vitest';

import { World } from 'civ-engine';
import { makeMarketActionValidator } from '../../src/game/simulation/handlers/market/marketActionValidator';
import { makeMarketActionHandler } from '../../src/game/simulation/handlers/market/marketActionHandler';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';
import type {
  BuildingType,
  MarketActionType,
  PlayerResources,
} from '../../src/game/simulation/types';

const STARTING_RESOURCES: PlayerResources = {
  food: 1000,
  wood: 1000,
  gold: 1000,
  stone: 1000,
};

function freshWorld() {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 16,
    gridHeight: 16,
    seed: 'test',
    tps: 60,
  });
}

function makeValidator(overrides: {
  playerResources?: Map<number, PlayerResources>;
  marketExchangeRates?: { food: number; wood: number; stone: number };
  getMarketOptions?: (owner: number, buildingType: BuildingType) => readonly MarketActionType[];
  playerOwnsCompletedMarket?: (playerId: number) => boolean;
  marketFeeRate?: number;
  marketTransactionAmount?: number;
} = {}) {
  return makeMarketActionValidator({
    playerResources: overrides.playerResources ?? new Map([[1, { ...STARTING_RESOURCES }]]),
    marketExchangeRates: overrides.marketExchangeRates ?? { food: 100, wood: 100, stone: 130 },
    getMarketOptions:
      overrides.getMarketOptions
      ?? (() => ['buy-food', 'sell-food', 'buy-wood', 'sell-wood', 'buy-stone', 'sell-stone'] as readonly MarketActionType[]),
    playerOwnsCompletedMarket:
      overrides.playerOwnsCompletedMarket ?? (() => true),
    marketFeeRate: overrides.marketFeeRate ?? 0.3,
    marketTransactionAmount: overrides.marketTransactionAmount ?? 100,
  });
}

describe('marketActionValidator', () => {
  it('rejects non-integer playerId', () => {
    const validator = makeValidator();
    const result = validator(
      { playerId: 1.5, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'invalid_player_id', message: expect.any(String) });
  });

  it('rejects when player owns no completed market', () => {
    const validator = makeValidator({
      playerOwnsCompletedMarket: () => false,
    });
    const result = validator(
      { playerId: 1, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'no_market', message: expect.any(String) });
  });

  it('rejects when action is not in market options', () => {
    const validator = makeValidator({
      getMarketOptions: () => [] as readonly MarketActionType[],
    });
    const result = validator(
      { playerId: 1, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'cannot_trade', message: expect.any(String) });
  });

  it('rejects when no stockpile exists for the player', () => {
    const validator = makeValidator({
      playerResources: new Map(),
    });
    const result = validator(
      { playerId: 1, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'no_stockpile', message: expect.any(String) });
  });

  it('rejects buy when player cannot afford the gold cost', () => {
    const validator = makeValidator({
      playerResources: new Map([[1, { food: 0, wood: 0, gold: 0, stone: 0 }]]),
    });
    const result = validator(
      { playerId: 1, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'insufficient_resources', message: expect.any(String) });
  });

  it('rejects sell when player has insufficient commodity', () => {
    const validator = makeValidator({
      playerResources: new Map([[1, { food: 50, wood: 50, gold: 1000, stone: 50 }]]),
    });
    const result = validator(
      { playerId: 1, actionType: 'sell-food' },
      freshWorld(),
    );
    expect(result).toEqual({ code: 'insufficient_resources', message: expect.any(String) });
  });

  it('accepts a fully valid buy request', () => {
    const validator = makeValidator();
    const result = validator(
      { playerId: 1, actionType: 'buy-food' },
      freshWorld(),
    );
    expect(result).toBe(true);
  });

  it('accepts a fully valid sell request', () => {
    const validator = makeValidator();
    const result = validator(
      { playerId: 1, actionType: 'sell-wood' },
      freshWorld(),
    );
    expect(result).toBe(true);
  });
});

describe('marketActionHandler', () => {
  it('delegates to executeMarketActionDirect', () => {
    const calls: Array<{ playerId: number; actionType: MarketActionType }> = [];
    const handler = makeMarketActionHandler({
      executeMarketActionDirect: (playerId, actionType) => {
        calls.push({ playerId, actionType });
        return true;
      },
    });
    handler({ playerId: 7, actionType: 'sell-wood' }, freshWorld());
    expect(calls).toEqual([{ playerId: 7, actionType: 'sell-wood' }]);
  });
});
