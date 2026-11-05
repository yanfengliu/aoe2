// AI production + research phase: computes the age-up planning state, buys what
// the escrow flags (`aiEscrowPhase.ts`, work 141 M2a), then in
// priority order trains military, pushes the next-age research + villager
// production at the Town Center, researches building techs, and trains/assigns
// monks. Runs after the building phase and before the attack phase.

import type { BuildingType, PlayerResources, ResearchableTechnologyType, TrainableUnitType } from '../../types';
import { canAfford, trainingCost } from '../../prototypeEconomyRules';
import { ownerConstructionCost, ownerResearchCost } from '../ownerCosts';
import { trainableInSameLine } from '../unitLines';
import { effectiveResearchCost } from '../../civBonusEffects';
import {
  AI_MONK_COUNT_CAP,
  AGE_PREREQUISITE_MILITARY_FLOOR,
  agePrerequisiteWoodReserve,
  ageUpReserveCost,
  canAffordWithReserve,
  militaryGrowthPausedForAgeUp,
  QUALIFYING_FEUDAL_BUILDINGS,
  pickUnitMix,
} from '../../ai';
import {
  marketActionForUnaffordableWant,
  researchOutranksQueue,
} from '../../aiMarketPlanning';
import { MARKET_TRANSACTION_AMOUNT } from '../bridgeConstants';
import {
  constructionStatesCodec,
  playerResourcesCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';
import { townCenterVillagerDemand, villagerReserve } from './aiVillagerDemand';
import { runEscrowPhase } from './aiEscrowPhase';
import { runTownCenterPhase } from './aiTownCenterPhase';
import { MONK_ACTION_RANGE } from './monkBehaviorSystem';

const addCosts = (a: Partial<PlayerResources>, b: Partial<PlayerResources>): Partial<PlayerResources> => ({
  food: (a.food ?? 0) + (b.food ?? 0),
  wood: (a.wood ?? 0) + (b.wood ?? 0),
  gold: (a.gold ?? 0) + (b.gold ?? 0),
  stone: (a.stone ?? 0) + (b.stone ?? 0),
});

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

export function runProductionPhase(deps: AiPhaseDeps, ctx: AiOwnerContext): void {
  const {
    accessor,
    monksByOwner,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    ownedMilitaryUnitIds,
    countQueuedUnits,
    getTrainOptions,
    getResearchOptions,
    pushAiMonkTaskIntentions,
    pushMonkContextAtEntityIntention,
    canUnitReachRange,
    findBuildingApproachPlan,
  } = deps;
  // Civ research discounts (v0.3.147): the AI budgets with ITS OWN prices —
  // a Byzantine AI must not over-save a third for Imperial it will not pay.
  const civOf = (o: number) => accessor.get(playerCivilizationsCodec).get(o);
  const ageOf = (o: number) => accessor.get(playerAgesCodec).get(o) ?? 'dark-age';
  const {
    owner,
    activeWorld,
    currentAge,
    stockpile,
    purchases,
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
  // DE's escrow first (`aiEscrowPhase.ts`, work 141 M2a). It buys what it flags
  // and holds the price of what it cannot pay for yet, after the age-up as DE
  // buys its age-ups first. While it holds or has bought anything, every
  // purchase below is checked once against a budget of what the decision has
  // not spent (`DecisionBudget`, applied by `purchases.buy`): the purchase's
  // own reserves as before, and the holds resource by resource, as DE's plain
  // `can-research` and `can-train` read them. Each check below is the path's
  // own, against the stockpile, as it always was; the budget, when it binds,
  // asks more of the same purchase, never less, since it has counted every
  // purchase asked for before it (work 141 M2a-2a). A held purchase it cannot
  // pay for is part of the plan.
  const escrow = runEscrowPhase(deps, ctx, ageUpReserve, savingForAgeUp);
  // The Castle's list drops only what is researched (`castleTechOptions`), so a
  // technology already queued there is asked for again, refused by the handler
  // and counted as a slot taken (work 141 review round 5). Skipping it moves the
  // coverage lab's match a long way (owner 1 then builds no Monastery or Siege
  // Workshop), so that fix is plan 106's card; `purchases.buy` only keeps a
  // refused request out of the escrow's budget.
  const planCosts: Array<Partial<PlayerResources>> = [...(escrow?.unpaid ?? [])];
  if (ctx.blockedBuildCost) planCosts.push(ctx.blockedBuildCost);
  for (const buildingType of RESEARCH_PRODUCERS) {
    if (!ownedQualifying.has(buildingType)) continue;
    const options = getResearchOptions(owner, buildingType);
    researchOptionsByBuilding.set(buildingType, options);
    if (!stockpile) continue;
    for (const tech of options) {
      // The OWNER's price, as the charge reads it (work 141): Spies is 200 gold
      // per living enemy villager, and priced off the table it looked affordable
      // with 200 gold, was pushed every decision and refused every time, and
      // the Castle researched nothing behind it (work 125's card).
      const cost = ownerResearchCost(activeWorld, accessor, owner, tech);
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
        const cost = ownerResearchCost(activeWorld, accessor, owner, tech);
        if (
          canAfford(stockpile, cost)
          && purchases.buy({ kind: 'research', buildingId, technology: tech, price: cost })
        ) {
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
  // A soldier leaves the next villager's cost behind (`aiVillagerDemand.ts`).
  const nextVillager = villagerReserve(townCenterVillagerDemand(deps, ctx));
  const soldierReserve = addCosts(militaryReserve, nextVillager);
  // Handlers charge in the order asked and none of these pushes is charged yet,
  // so while a villager is due each soldier is priced on top of those asked
  // before it (work 141 review round 0, F0: a Spearman and a Scout each passed
  // with 130 food and left the villager 15). Only while one is due: that is the
  // purchase this protects, and Imperial research asked before it is not counted.
  let soldiersAsked: Partial<PlayerResources> = {};
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
      // Advisory base cost (gates intention only; the validator and the charge
      // apply the owner's civilization cost rules, such as the Byzantine and
      // Viking seats' discounts, and no rule raises a price). Priced on what will
      // actually be trained, which is a NO-OP TODAY and deliberately kept: every
      // line costs the same at every tier (all 20 adjacent pairs checked; a
      // Spearman and a Halberdier are both 35 food / 25 wood). The one pair that
      // differs, Skirmisher to Elite Skirmisher, is unreachable because the mix
      // names the Skirmisher only in Feudal and its upgrade is Castle. If any
      // tier is ever repriced, this is already right.
      const cost = trainingCost(offered);
      const soldierFits = canAffordWithReserve(stockpile, cost, addCosts(soldierReserve, soldiersAsked))
        && purchases.buy({ kind: 'train', buildingId: producerId, unit: offered, price: cost }, { reserve: soldierReserve });
      if (!soldierFits) {
        // The Market sees the budget this check used (work 141 review round 1):
        // the unit plus what this decision already holds for the villager and
        // the soldiers before it, not its bare price against the whole purse.
        unaffordableWants.push(addCosts(cost, addCosts(nextVillager, soldiersAsked)));
        continue;
      }
      if (nextVillager.food !== undefined) soldiersAsked = addCosts(soldiersAsked, cost);
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
        && canAffordWithReserve(stockpile, trainingCost(castleUnit), addCosts(addCosts(ageUpReserve, nextVillager), soldiersAsked))
        && purchases.buy(
          { kind: 'train', buildingId: castleId, unit: castleUnit, price: trainingCost(castleUnit) },
          { reserve: addCosts(ageUpReserve, nextVillager) },
        )
      ) {
        pendingTrainsByBuilding.set(
          castleId,
          (pendingTrainsByBuilding.get(castleId) ?? 0) + 1,
        );
      }
    }
  }

  // The Town Center: the next age, the Market toward it, villagers (`aiTownCenterPhase.ts`).
  if (runTownCenterPhase(deps, ctx, nextAgeTech, qualifiesForNextAge)) marketActionPushed = true;

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
    // A trade spends gold or a commodity like any purchase, so while the escrow
    // holds anything it must fit the budget and be counted (review round 5).
    // Counted only when its handler will charge it (review round 8). While the
    // budget is active a trade the AI cannot pay for now is not asked for at all:
    // income arriving before its handler runs, the next tick, would let it
    // through uncounted (review round 9). `purchases.buy` prices a trade so.
    if (trade !== null) purchases.buy({ kind: 'trade', action: trade });
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
        purchases.buy({ kind: 'train', buildingId: monasteryId, unit: 'monk', price: trainingCost('monk') });
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
    pushAiMonkTaskIntentions(owner, pushMonkContextAtEntityIntention, (unitId, target) => (
      canUnitReachRange(unitId, target, MONK_ACTION_RANGE, activeWorld)
    ), (unitId, buildingId) => (
      findBuildingApproachPlan(unitId, buildingId, MONK_ACTION_RANGE, activeWorld) !== null
    ));
  }
}
