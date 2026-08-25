// Tribute (spec §6.8): one player sends a resource to another, paying a fee on
// top — 30%, cut by Coinage and removed by Banking, both derived from the
// SENDER's researched set at execution time. Needs a completed Market, which
// is AoE2's own rule and the reason the tribute buttons live on the Market's
// command card.
//
// The transfer is atomic and instantaneous: no carrier walks it over, so
// there is nothing to persist beyond the two stockpiles it moves between.

import type { EconomyResourceKind } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import {
  playerResourcesCodec,
  researchedTechnologiesCodec,
} from './bridgeStateSerialize';
import { tributeCost, tributeFeeRateFor } from '../tributeRules';
import type { ResearchableTechnologyType } from '../types';

const EMPTY_TECH_SET: ReadonlySet<ResearchableTechnologyType> = new Set();

export interface TributeOpsDeps {
  world: GameWorld;
  accessor: BridgeStateAccessor;
  humanPlayerId: number;
  isMatchRunning: () => boolean;
  playerOwnsCompletedMarket: (playerId: number) => boolean;
  enqueueRejection: (message: string) => void;
}

export interface TributeOps {
  /** Authoritative transfer, shared by the command handler and the validator's
   *  best-effort pre-check. Returns false and moves nothing on any miss. */
  executeTributeDirect(
    playerId: number,
    toPlayerId: number,
    resource: EconomyResourceKind,
    amount: number,
  ): boolean;
  /** The human sends tribute — submits the recorded command. */
  sendTribute(toPlayerId: number, resource: EconomyResourceKind, amount: number): boolean;
  /** Every other player the human could tribute to, for the command card. */
  listTributeTargets(): number[];
  /** The human's CURRENT tribute fee rate, for the button tooltips. */
  humanTributeFeeRate(): number;
}

export function createTributeOps(deps: TributeOpsDeps): TributeOps {
  const {
    world, accessor, humanPlayerId, isMatchRunning,
    playerOwnsCompletedMarket, enqueueRejection,
  } = deps;

  function canTribute(
    playerId: number,
    toPlayerId: number,
    resource: EconomyResourceKind,
    amount: number,
  ): { cost: number } | null {
    if (!Number.isInteger(playerId) || !Number.isInteger(toPlayerId)) return null;
    if (playerId === toPlayerId) return null;
    if (!Number.isInteger(amount) || amount <= 0) return null;
    const stockpiles = accessor.get(playerResourcesCodec);
    const sender = stockpiles.get(playerId);
    const recipient = stockpiles.get(toPlayerId);
    if (!sender || !recipient) return null;
    if (!playerOwnsCompletedMarket(playerId)) return null;
    const feeRate = tributeFeeRateFor(
      accessor.get(researchedTechnologiesCodec).get(playerId) ?? EMPTY_TECH_SET,
    );
    const cost = tributeCost(amount, feeRate);
    if (sender[resource] < cost) return null;
    return { cost };
  }

  function executeTributeDirect(
    playerId: number,
    toPlayerId: number,
    resource: EconomyResourceKind,
    amount: number,
  ): boolean {
    const priced = canTribute(playerId, toPlayerId, resource, amount);
    if (!priced) return false;
    const stockpiles = accessor.get(playerResourcesCodec);
    stockpiles.get(playerId)![resource] -= priced.cost;
    stockpiles.get(toPlayerId)![resource] += amount;
    accessor.markDirty(playerResourcesCodec);
    return true;
  }

  function sendTribute(
    toPlayerId: number,
    resource: EconomyResourceKind,
    amount: number,
  ): boolean {
    if (!isMatchRunning()) return false;
    // Pre-check so a doomed submit rejects with a reason instead of silently
    // dying in the validator.
    if (!canTribute(humanPlayerId, toPlayerId, resource, amount)) {
      enqueueRejection(
        'Tribute rejected: it needs a completed Market, another player, and the amount plus its fee in stock.',
      );
      return false;
    }
    const result = world.submitWithResult('tribute.send', {
      playerId: humanPlayerId,
      toPlayerId,
      resource,
      amount,
    });
    if (!result.accepted) {
      enqueueRejection('Tribute rejected. Check resources and the recipient.');
      return false;
    }
    return true;
  }

  function listTributeTargets(): number[] {
    const owners: number[] = [];
    for (const owner of accessor.get(playerResourcesCodec).keys()) {
      if (owner !== humanPlayerId) owners.push(owner);
    }
    return owners.sort((a, b) => a - b);
  }

  function humanTributeFeeRate(): number {
    return tributeFeeRateFor(
      accessor.get(researchedTechnologiesCodec).get(humanPlayerId) ?? EMPTY_TECH_SET,
    );
  }

  return { executeTributeDirect, sendTribute, listTributeTargets, humanTributeFeeRate };
}
