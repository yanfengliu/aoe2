// AI production + research phase: computes the age-up planning state, then in
// priority order trains military, pushes the next-age research + villager
// production at the Town Center, researches building techs, and trains/assigns
// monks. Runs after the building phase and before the attack phase.

import type { BuildingType, PlayerResources, ResearchableTechnologyType, TrainableUnitType } from '../../types';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { ownerConstructionCost } from '../ownerCosts';
import { trainableInSameLine } from '../unitLines';
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
import {
  marketActionForAgeUpShortfall,
  marketActionForUnaffordableWant,
  researchOutranksQueue,
} from '../../aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import {
  constructionStatesCodec,
  playerResourcesCodec,
  productionQueuesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiSystemDeps } from './aiSystemTypes';

// Every building the AI researches at, in the order it consults them. Named
// once because the plan scan and the research loop below MUST walk the same
// list in the same order — the scan records the first entry a producer cannot
// pay for, and the loop buys the first it can.
const RESEARCH_PRODUCERS = [
  'blacksmith',
  'archery-range',
  'barracks',
  'stable',
  'siege-workshop',
  'castle',
] as const;

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

  // THE PLAN, computed before the queue gets to spend (v0.3.222). Two things the
  // owner wants and cannot pay for: the building its build order is stuck on
  // (handed over by the building phase, which ran first this tick) and the
  // technologies standing unbought at the producers it owns. Both are lumps —
  // 200 wood for a Siege Workshop, 220 food and 120 gold for an `iron-casting` —
  // and a queue that buys in 25-wood, 45-gold bites every decision tick is why
  // they never form. See `marketActionForUnaffordableWant` for the measurement.
  const researchOptionsByBuilding = new Map<BuildingType, ResearchableTechnologyType[]>();
  const planCosts: Array<Partial<PlayerResources>> = [];
  if (ctx.blockedBuildCost) planCosts.push(ctx.blockedBuildCost);
  for (const buildingType of RESEARCH_PRODUCERS) {
    if (!ownedQualifying.has(buildingType)) continue;
    const options = getResearchOptions(owner, buildingType);
    researchOptionsByBuilding.set(buildingType, options);
    if (!stockpile) continue;
    for (const tech of options) {
      const cost = effectiveResearchCost(civOf(owner), ageOf(owner), tech);
      if (canAfford(stockpile, cost)) break;
      // The first entry it cannot pay for, matching the research loop below,
      // which walks the same list in the same order and buys the first it can.
      planCosts.push(cost);
      break;
    }
  }
  // Buy one affordable upgrade per idle producer. WHERE IT RUNS is the point:
  // `researchOutranksQueue` carries the measurement and the age scope.
  const runResearchPhase = (): void => {
    if (savingForAgeUp) return;
    for (const buildingType of RESEARCH_PRODUCERS) {
      const buildingId = findIdleProducerLocal(buildingType);
      if (buildingId === null) continue;
      // Computed once above, for the plan; the list does not depend on which
      // producer is idle, so reading it twice would only cost the civ filter
      // twice. Falls back for a producer under construction when the plan scan
      // ran (it reads COMPLETE buildings, `findIdleProducerLocal` need not).
      const options = researchOptionsByBuilding.get(buildingType)
        ?? getResearchOptions(owner, buildingType);
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
  };
  if (researchOutranksQueue(currentAge)) runResearchPhase();

  // Phase 1C: pickUnitMix BEFORE villager training (the +1-tick handler
  // delay otherwise mis-aligns the full-tcQueue corner case). Priority:
  // military, then age-up research, then villager.
  const mix = pickUnitMix(currentAge);
  // One `getTrainOptions` call per PRODUCER, not per mix entry. It runs a civ
  // denial filter and allocates, and the mix names the same producer more than
  // once (Feudal asks the Archery Range for both an Archer and a Skirmisher).
  // It also now runs before the affordability check rather than after, so
  // without this it would run for every idle producer every decision tick.
  const offersByProducer = new Map<BuildingType, TrainableUnitType[]>();
  // What this owner wanted from a producer standing IDLE and could not pay for.
  // Feeds the Market below: an owner banking one resource while short of the one
  // its units are priced in has a trade available, and before v0.3.222 it never
  // made it. Empty unless the military loop below actually ran and rejected
  // something on price.
  //
  // "Could not afford EVERYTHING it wanted" is the trigger, deliberately NOT
  // "could not afford anything". Measured on the coverage lab at 45,000 ticks,
  // the worse-off seat could always afford the one gold-free unit in the
  // Imperial mix — it ended with 46 Spearmen out of an army of 93, holding
  // 1,093 stone and 23 gold — so a rule that waited for a fully idle producer
  // would never have fired for the seat that needed it most.
  const unaffordableWants: Array<Partial<PlayerResources>> = [];
  // At most ONE market trade per decision tick, whichever gate asks for it: the
  // age-up shortfall keeps priority, because an age is worth more than a unit.
  let marketActionPushed = false;
  // v0.1.92: pause military growth when stuck short of the next age → frees pop/wood for the 2nd Feudal-prereq building (see helper).
  if (!savingForAgeUp && !militaryGrowthPausedForAgeUp(currentAge, qualifiesForNextAge, ownedMilitaryUnitIds(owner).size)) {
    for (const { unitType, producer } of mix) {
      const producerId = findIdleProducerLocal(producer);
      if (producerId === null) continue;
      if (!stockpile) continue;
      // The tier this owner ACTUALLY has, not the top of the line.
      //
      // `pickUnitMix` names the top — Halberdier, Arbalest, Cavalier — while a
      // producer offers `latestResearchedInChain`. An owner that reached the
      // Imperial age without the upgrades was offered a Spearman and asked for
      // a Halberdier, so this test rejected EVERY entry in the mix and the AI
      // trained nothing from any building for the rest of the match. Measured
      // on `fortress` at 60,000 ticks: five military buildings, idle in 100% of
      // samples, armies of 2 and 0, while holding 1,231 wood and 595 food.
      let offers = offersByProducer.get(producer);
      if (offers === undefined) {
        offers = getTrainOptions(owner, producer);
        offersByProducer.set(producer, offers);
      }
      const offered = trainableInSameLine(unitType, offers);
      if (offered === undefined) continue;
      // Advisory base cost (gates intention only; validator+charge apply
      // the Goths discount, and the AI is never Goths yet). Priced on what will
      // actually be trained, which is a NO-OP TODAY and deliberately kept: every
      // line costs the same at every tier (all 20 adjacent pairs checked; a
      // Spearman and a Halberdier are both 35 food / 25 wood). The one pair that
      // differs, Skirmisher to Elite Skirmisher, is unreachable because the mix
      // names the Skirmisher only in Feudal and its upgrade is Castle. If any
      // tier is ever repriced, this is already right.
      const cost = trainingCost(offered);
      if (!canAffordWithReserve(stockpile, cost, militaryReserve)) {
        unaffordableWants.push(cost);
        continue;
      }
      pushQueueTrainIntention(producerId, offered);
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
        if (trade !== null) {
          pushMarketActionIntention(owner, trade);
          marketActionPushed = true;
        }
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

  // v0.3.222: the Market's second job — the surplus trade. The age-up path
  // above fires only while an age-up is pending, so it is dead for the whole
  // Imperial age; this one asks the same question of the UNIT the AI is trying
  // to train. It only fires when the military loop above found an idle producer,
  // wanted something from it, and was refused on price — so a fed AI never
  // trades, and one that is population-blocked or paused for an age-up never
  // reaches here. The `market.action` validator re-checks the Market and the
  // stockpile, so an owner without one no-ops like any rejected AI intention.
  // `currentAge` carries the rule's SCOPE: it declines outside the Imperial
  // Age, which is exactly where the age-up trade above goes dead, so the two
  // never bid for the same stockpile. Run in every age it spends the gold a
  // Feudal seat is saving for its Castle Age — traced doing exactly that on the
  // coverage lab, where it cost owner 2 the Imperial Age and 37 of its 38
  // villagers. The check lives in `marketActionForUnaffordableWant` rather than
  // here so it is unit-testable; that function carries the measurement.
  //
  // `militaryReserve` rides along as an untouchable floor anyway (it is empty in
  // the Imperial Age), so the invariant is visible rather than assumed.
  if (!marketActionPushed && stockpile && (planCosts.length > 0 || unaffordableWants.length > 0)) {
    // The age-up reserve rides along as an untouchable floor — it is empty in
    // the Imperial Age, which is the only age this fires in, so the invariant is
    // visible here rather than assumed.
    const trade = marketActionForUnaffordableWant(
      currentAge, stockpile, planCosts, unaffordableWants,
      militaryReserve, MARKET_TRANSACTION_AMOUNT);
    if (trade !== null) pushMarketActionIntention(owner, trade);
  }

  if (!researchOutranksQueue(currentAge)) runResearchPhase();

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
