// AI production + research phase: computes the age-up planning state, then in
// priority order trains military, pushes the next-age research + villager
// production at the Town Center, researches building techs, and trains/assigns
// monks. Runs after the building phase and before the attack phase.

import type { ResearchableTechnologyType } from '../../types';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { ownerConstructionCost } from '../ownerCosts';
import { effectiveResearchCost } from '../../civBonusEffects';
import {
  AI_MONK_COUNT_CAP,
  AGE_PREREQUISITE_MILITARY_FLOOR,
  agePrerequisiteWoodReserve,
  ageUpReserveCost,
  ageUpResourceBuffer,
  canAffordWithReserve,
  militaryGrowthPausedForAgeUp,
  QUALIFYING_FEUDAL_BUILDINGS,
  pickNextAgeResearch,
  pickUnitMix,
  villagerCapForAge,
} from '../../ai';
import { marketActionForAgeUpShortfall } from '../../aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import {
  constructionStatesCodec,
  playerResourcesCodec,
  productionQueuesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

export function runProductionPhase(deps: AiSystemDeps, ctx: AiOwnerContext): void {
  const {
    accessor,
    monksByOwner,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    ownedMilitaryUnitIds,
    countOwnedUnits,
    countQueuedUnits,
    pushQueueResearchIntention,
    pushQueueTrainIntention,
    pushMarketActionIntention,
    getTrainOptions,
    getResearchOptions,
    pushAiMonkTaskIntentions,
    pushMonkContextAtEntityIntention,
  } = deps;
  // Civ research discounts (v0.3.147): the AI budgets with ITS OWN prices —
  // a Byzantine AI must not over-save a third for Imperial it will not pay.
  const civOf = (o: number) => accessor.get(playerCivilizationsCodec).get(o);
  const ageOf = (o: number) => accessor.get(playerAgesCodec).get(o) ?? 'dark-age';
  const {
    owner,
    ownerTownCenterId,
    activeWorld,
    currentAge,
    stockpile,
    populationBlocked,
    findIdleProducerLocal,
    pendingTrainsByBuilding,
    pendingResearchByBuilding,
    pendingResearchKeys,
  } = ctx;

  const nextAgeTech: ResearchableTechnologyType | null =
    currentAge === 'dark-age' ? 'feudal-age'
    : currentAge === 'feudal-age' ? 'castle-age'
    : currentAge === 'castle-age' ? 'imperial-age'
    : null;
  const savingForAgeUp = ((): boolean => {
    if (!nextAgeTech) return false;
    const s = accessor.get(playerResourcesCodec).get(owner);
    if (!s) return false;
    const cost = effectiveResearchCost(civOf(owner), ageOf(owner), nextAgeTech);
    const foodTarget = cost.food ?? 0;
    const goldTarget = cost.gold ?? 0;
    const foodProgress = foodTarget > 0 ? s.food / foodTarget : 1;
    const goldProgress = goldTarget > 0 ? s.gold / goldTarget : 1;
    const minProgress = Math.min(foodProgress, goldProgress);
    return minProgress >= 0.6 && !canAfford(s, cost);
  })();

  // campaign-11 (c): reserve the next age-up's cost so military (sequenced
  // before the FIFO-later age-up research) trains only from the surplus
  // above it — else a Militia drains food below the cost and the research
  // silently no-ops. Military and CONSTRUCTION both spend wood — a spearman
  // costs 25 of it — so `agePrerequisiteWoodReserve` holds back what the next
  // qualifying building needs. This comment used to read "military is the only
  // pre-age-up food/gold spend (builds spend wood/stone)", which the roster had
  // made false, and the missing arbitration is what walled every AI into the
  // Feudal Age.
  const qualifiesForNextAge =
    nextAgeTech === 'feudal-age' ? canAdvanceToFeudalAge(owner)
    : nextAgeTech === 'castle-age' ? canAdvanceToCastleAge(owner)
    : nextAgeTech === 'imperial-age' ? canAdvanceToImperialAge(owner)
    : false;
  const ageUpReserve = ageUpReserveCost(currentAge, qualifiesForNextAge, civOf(owner));
  // COMPLETE buildings only, matching `countCompletedOwnedBuildings`, which is
  // what the age-advance rule itself counts — a foundation is not a
  // prerequisite and must not release the reserve.
  const ownedQualifying = new Set<string>();
  for (const id of activeWorld.query('building')) {
    const building = activeWorld
      .getComponent<{ owner: number; buildingType: string }>(id, 'building');
    if (!building || building.owner !== owner) continue;
    const construction = accessor.get(constructionStatesCodec).get(id);
    if (construction && !construction.isComplete) continue;
    ownedQualifying.add(building.buildingType);
  }
  const nextQualifying = QUALIFYING_FEUDAL_BUILDINGS
    .find((type) => !ownedQualifying.has(type));
  const prerequisiteWood = agePrerequisiteWoodReserve(
    currentAge,
    qualifiesForNextAge,
    ownedMilitaryUnitIds(owner).size,
    AGE_PREREQUISITE_MILITARY_FLOOR,
    // The OWNER's discounted price, not the base table — the Malians build
    // every building for 15% less, and the sibling age-up reserve was fixed
    // for exactly this in v0.3.147. Over-reserving extends the training pause.
    nextQualifying ? ownerConstructionCost(accessor, owner, nextQualifying).wood ?? 0 : 0,
  );
  const militaryReserve = prerequisiteWood > 0
    ? { ...ageUpReserve, wood: (ageUpReserve.wood ?? 0) + prerequisiteWood }
    : ageUpReserve;

  // Phase 1C: pickUnitMix BEFORE villager training (the +1-tick handler
  // delay otherwise mis-aligns the full-tcQueue corner case). Priority:
  // military, then age-up research, then villager.
  const mix = pickUnitMix(currentAge);
  // v0.1.92: pause military growth when stuck short of the next age → frees pop/wood for the 2nd Feudal-prereq building (see helper).
  if (!savingForAgeUp && !militaryGrowthPausedForAgeUp(currentAge, qualifiesForNextAge, ownedMilitaryUnitIds(owner).size)) {
    for (const { unitType, producer } of mix) {
      const producerId = findIdleProducerLocal(producer);
      if (producerId === null) continue;
      if (!stockpile) continue;
      // Advisory base cost (gates intention only; validator+charge apply
      // the Goths discount, and the AI is never Goths yet).
      const cost = trainingCost(unitType);
      if (!canAffordWithReserve(stockpile, cost, militaryReserve)) continue;
      if (!getTrainOptions(owner, producer).includes(unitType)) continue;
      pushQueueTrainIntention(producerId, unitType);
      // Phase 1C — increment so subsequent same-producer pushes (feudal+
      // pickUnitMix returns multiple unit types per producer) see this
      // push in their findIdleProducerLocal queue-length gate. Without
      // this, both archer and skirmisher would funnel into the same
      // archery-range in one tick, then the second handler would
      // silent-no-op on queue-full (per Gemini iter-1 F2).
      pendingTrainsByBuilding.set(
        producerId,
        (pendingTrainsByBuilding.get(producerId) ?? 0) + 1,
      );
    }

    // The Castle is the most expensive thing the AI builds and it trained
    // nothing from it. Its unique unit is not in `pickUnitMix` because that
    // function knows only the age: the right unit depends on the owner's
    // CIVILIZATION and on whether the elite upgrade is done. Reading the
    // Castle's own train options answers both, and keeps the AI's choice
    // identical to what a player would be offered.
    const castleId = findIdleProducerLocal('castle');
    if (castleId !== null && stockpile) {
      // Trebuchets are a siege weapon for a specific job, not a standing army —
      // the AI would otherwise fill its population with them.
      const castleUnit = getTrainOptions(owner, 'castle')
        .find((option) => option !== 'trebuchet');
      if (
        castleUnit !== undefined
        && canAffordWithReserve(stockpile, trainingCost(castleUnit), ageUpReserve)
      ) {
        pushQueueTrainIntention(castleId, castleUnit);
        pendingTrainsByBuilding.set(
          castleId,
          (pendingTrainsByBuilding.get(castleId) ?? 0) + 1,
        );
      }
    }
  }

  if (ownerTownCenterId !== null) {
    const tcConstruction = accessor.get(constructionStatesCodec).get(ownerTownCenterId);
    if (!tcConstruction || tcConstruction.isComplete) {
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
          return stockpile ? canAfford(stockpile, effectiveResearchCost(civOf(owner), ageOf(owner), tech)) : false;
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
        pushQueueResearchIntention(ownerTownCenterId, nextAge);
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
        && !canAfford(stockpile, effectiveResearchCost(civOf(owner), ageOf(owner), nextAgeTech))
      ) {
        const trade = marketActionForAgeUpShortfall(
          stockpile, effectiveResearchCost(civOf(owner), ageOf(owner), nextAgeTech), MARKET_TRANSACTION_AMOUNT);
        if (trade !== null) pushMarketActionIntention(owner, trade);
      }

      // Recompute the queue length post-age-up push so the villager
      // gate below sees the freshly-pushed age-up entry.
      const tcEffectiveQueueLength =
        tcPersistedQueueLength + tcPendingTrains + tcPendingResearch;
      const villagerCap = villagerCapForAge(currentAge);
      const currentVillagers =
        countOwnedUnits(owner, 'villager') + countQueuedUnits(ownerTownCenterId, 'villager') + tcPendingTrains;
      const villagerCost = trainingCost('villager');
      if (
        !populationBlocked
        && !savingForAgeUp
        && currentVillagers < villagerCap
        && tcEffectiveQueueLength < 2
        && stockpile
        // v0.1.96: villager training is NOT age-up-reserve-gated (unlike military ~549) —
        // gating the engine that GATHERS the reserve deadlocked the economy when the AI qualified
        // villager-poor (corpus: 7 Feudal vil frozen at 339/800). Cap gate + savingForAgeUp (~628) bank food.
        && canAfford(stockpile, villagerCost)
      ) {
        pushQueueTrainIntention(ownerTownCenterId, 'villager');
        // Iter-1 Gemini MINOR: increment so a future multi-TC / multi-pass
        // re-entry can't over-commit (mirrors the military push ~555).
        pendingTrainsByBuilding.set(
          ownerTownCenterId,
          (pendingTrainsByBuilding.get(ownerTownCenterId) ?? 0) + 1,
        );
      }
    }
  }

  if (!savingForAgeUp) {
    for (const buildingType of [
      'blacksmith',
      'archery-range',
      'barracks',
      'stable',
      'siege-workshop',
      'castle',
    ] as const) {
      const buildingId = findIdleProducerLocal(buildingType);
      if (buildingId === null) continue;
      const options = getResearchOptions(owner, buildingType);
      if (options.length === 0) continue;
      if (!stockpile) continue;
      for (const tech of options) {
        // Phase 1C: skip techs whose queue.research intention is
        // already pending (handler hasn't flipped inFlightTechByOwner).
        if (pendingResearchKeys.has(`${owner}:${tech}`)) continue;
        const cost = effectiveResearchCost(civOf(owner), ageOf(owner), tech);
        if (canAfford(stockpile, cost)) {
          pushQueueResearchIntention(buildingId, tech);
          // Update per-tick gating maps so subsequent same-tick
          // findIdleProducerLocal calls see this slot consumed.
          pendingResearchByBuilding.set(
            buildingId,
            (pendingResearchByBuilding.get(buildingId) ?? 0) + 1,
          );
          pendingResearchKeys.add(`${owner}:${tech}`);
          break;
        }
      }
    }
  }

  if (
    !savingForAgeUp
    && (currentAge === 'castle-age' || currentAge === 'imperial-age')
  ) {
    const monasteryId = findIdleProducerLocal('monastery');
    if (monasteryId !== null) {
      // V5-1: O(1) monk count via monksByOwner side map.
      const ownedMonks =
        (monksByOwner.get(owner)?.size ?? 0) + countQueuedUnits(monasteryId, 'monk');
      if (
        ownedMonks < AI_MONK_COUNT_CAP
        && stockpile
        && canAfford(stockpile, trainingCost('monk'))
        && getTrainOptions(owner, 'monastery').includes('monk')
      ) {
        pushQueueTrainIntention(monasteryId, 'monk');
      }
    }
  }

  // V5-1: O(1) skip-guard via monksByOwner side map. Iter-1 V4-12
  // used countOwnedUnits(owner, 'monk') for this gate, but
  // countOwnedUnits walks world.query('unit') — same cost as
  // assignAiMonkTasks itself, doubling the steady-state cost when
  // an AI has Monks. The side map is maintained in entityCreateOps,
  // entityDestroyOps, and monkTaskAppliers.flipConvertedUnit.
  if ((monksByOwner.get(owner)?.size ?? 0) > 0) {
    pushAiMonkTaskIntentions(owner, pushMonkContextAtEntityIntention);
  }
}
