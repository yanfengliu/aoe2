// The Town Center's part of the AI's production phase: the next age's research,
// the Market trade toward an age it qualifies for and cannot pay for, and the
// villager queue. Split out of `aiSystemProductionPhase.ts` (work 141 M2a), which
// had reached its 500-line budget; the comments are those it carried there.

import type { ResearchableTechnologyType } from '../../types';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { effectiveResearchCost } from '../../civBonusEffects';
import { ageUpResourceBuffer, pickNextAgeResearch } from '../../ai';
import { marketActionForAgeUpShortfall } from '../../aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import {
  constructionStatesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  productionQueuesCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';
import { ownerTrainingCost } from '../ownerCosts';
import { villagerWanted } from './aiVillagerDemand';

/** Returns whether it asked the Market for a trade (one a decision at most). */
export function runTownCenterPhase(
  deps: AiPhaseDeps,
  ctx: AiOwnerContext,
  nextAgeTech: ResearchableTechnologyType | null,
  qualifiesForNextAge: boolean,
): boolean {
  const {
    accessor,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    countOwnedUnits,
    countQueuedUnits,
  } = deps;
  const {
    owner,
    ownerTownCenterId,
    currentAge,
    stockpile,
    populationBlocked,
    pendingTrainsByBuilding,
    pendingResearchByBuilding,
    pendingResearchKeys,
    purchases,
  } = ctx;
  // While DE's escrow holds or has bought anything, what this phase buys is
  // counted in the decision's budget, so the purchases after it (the Market,
  // the later Monks, Trade Carts, tribute) see it spent. A hold never stops it
  // (`countOnly`): DE buys its age-ups first, and its villagers may spend
  // escrow (work 141 review round 7).
  if (ownerTownCenterId === null) return false;
  const tcConstruction = accessor.get(constructionStatesCodec).get(ownerTownCenterId);
  if (tcConstruction && !tcConstruction.isComplete) return false;
  const civ = accessor.get(playerCivilizationsCodec).get(owner);
  const age = accessor.get(playerAgesCodec).get(owner) ?? 'dark-age';
  let marketActionPushed = false;

  const bufferCost = ageUpResourceBuffer(currentAge);
  const hasBuffer = stockpile ? canAfford(stockpile, bufferCost) : false;
  const nextAge = pickNextAgeResearch(
    currentAge,
    (tech) => {
      if (tech === 'feudal-age') return canAdvanceToFeudalAge(owner);
      if (tech === 'castle-age') return canAdvanceToCastleAge(owner);
      if (tech === 'imperial-age') return canAdvanceToImperialAge(owner);
      return false;
    },
    (tech) => {
      return stockpile ? canAfford(stockpile, effectiveResearchCost(civ, age, tech)) : false;
    },
  );
  // Effective TC queue length BEFORE the age-up gate (productionQueues
  // mixes train + research; without it a full 2-deep TC lands age-up
  // research at depth 3, which the handler has no recheck for).
  const tcPersistedQueueLength = accessor.get(productionQueuesCodec).get(ownerTownCenterId)?.length ?? 0;
  // The AI only pushes villagers to the TC, so every pending TC
  // queue.train counts as a pending villager (narrow this if a future
  // non-villager TC train — king / fishing-boat — is added).
  const tcPendingTrains = pendingTrainsByBuilding.get(ownerTownCenterId) ?? 0;
  let tcPendingResearch = pendingResearchByBuilding.get(ownerTownCenterId) ?? 0;
  const tcEffectiveQueueLengthBeforeAgeUp =
    tcPersistedQueueLength + tcPendingTrains + tcPendingResearch;

  // The age-up may push onto a FULL (2-deep) villager queue (depth 3):
  // a rich AI keeps the TC queue full, so gating at < 2 starved the
  // age-up (grounded 2026-07-02); the handler advances queued research
  // past a pop-blocked unit so it completes.
  if (
    nextAge
    && hasBuffer
    && !pendingResearchKeys.has(`${owner}:${nextAge}`)
    && tcEffectiveQueueLengthBeforeAgeUp < 3
  ) {
    // An age-up already in flight is asked for again and refused uncharged, so it is not counted.
    purchases.buy(
      { kind: 'research', buildingId: ownerTownCenterId, technology: nextAge, price: effectiveResearchCost(civ, age, nextAge) },
      { countOnly: true },
    );
    tcPendingResearch += 1;
    pendingResearchByBuilding.set(ownerTownCenterId, tcPendingResearch);
    pendingResearchKeys.add(`${owner}:${nextAge}`);
  }

  // v0.1.91: qualifies for the next age but can't afford it → trade at
  // the Market to cover the shortfall (one batch/tick). The market.action
  // validator gates ownership + affordability, so an owner with no Market
  // just no-ops like any rejected AI intention. Robust successor to
  // gather-weight tuning (v0.1.91 FIND): self-corrects whichever age-up
  // resource the chaotic AI-vs-AI economy left short.
  if (
    nextAgeTech
    && qualifiesForNextAge
    && stockpile
    && !canAfford(stockpile, effectiveResearchCost(civ, age, nextAgeTech))
  ) {
    const trade = marketActionForAgeUpShortfall(
      stockpile, effectiveResearchCost(civ, age, nextAgeTech), MARKET_TRANSACTION_AMOUNT);
    if (trade !== null) {
      purchases.buy({ kind: 'trade', action: trade }, { countOnly: true });
      marketActionPushed = true;
    }
  }

  // Recompute the queue length post-age-up push so the villager
  // gate below sees the freshly-pushed age-up entry.
  const tcEffectiveQueueLength =
    tcPersistedQueueLength + tcPendingTrains + tcPendingResearch;
  const currentVillagers =
    countOwnedUnits(owner, 'villager') + countQueuedUnits(ownerTownCenterId, 'villager') + tcPendingTrains;
  const villagerCost = trainingCost('villager');
  // Not held back by `savingForAgeUp` (work 141): DE's AI keeps training
  // villagers while it saves for an age — in the Dark Age to 25 villagers
  // whatever its food, in the Feudal Age until it can pay for the Castle
  // Age (Promisory units.per 328-386 and 409-415) — and banks the age's
  // cost once it stops at its villager count. The latch stopped villagers
  // at 60% of the cost, so the Town Center idled while the AI could pay.
  // Nor by the escrow (work 141 M2a): DE's villagers may spend escrowed
  // resources while the AI has fewer than 65 (units.per 11760-11778).
  if (
    !populationBlocked
    && villagerWanted(deps, owner, currentAge, currentVillagers)
    && tcEffectiveQueueLength < 2
    && stockpile
    // v0.1.96: villager training is NOT age-up-reserve-gated (unlike military) —
    // gating the engine that GATHERS the reserve deadlocked the economy when the AI qualified
    // villager-poor (corpus: 7 Feudal vil frozen at 339/800). The cap banks the food (work 141).
    && canAfford(stockpile, villagerCost)
  ) {
    purchases.buy(
      { kind: 'train', buildingId: ownerTownCenterId, unit: 'villager', price: ownerTrainingCost(accessor, owner, 'villager') },
      { countOnly: true },
    );
    // Iter-1 Gemini MINOR: increment so a future multi-TC / multi-pass
    // re-entry can't over-commit (mirrors the military push above).
    pendingTrainsByBuilding.set(
      ownerTownCenterId,
      (pendingTrainsByBuilding.get(ownerTownCenterId) ?? 0) + 1,
    );
  }
  return marketActionPushed;
}
