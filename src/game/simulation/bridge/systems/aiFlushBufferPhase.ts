// What DE's flush buffers read about one owner this decision (work 147 M2; the
// rule and its citations are in `aiFlushBuffers.ts`, spec §13.2 "DE's flush
// buffers"). The production phase asks it of each soldier it would train; it
// gathers the seat's farms, food villagers, Siege Workshops and ages the first
// time a soldier of a buffered line is asked about, and the army's superiority
// from the decision's ram census (`ramGoalInputs`), which it shares.
//
// The wood is the stockpile as the decision found it, which is what every other
// check of this AI reads: DE's goal rules read `wood-amount` before its pass's
// train actions spend (units.per sets each train goal at 9145-9540 and trains
// from 12771 on), and where its build rules fall in the pass is not known
// (plan 147: the file that loads the scripts is not installed).

import type { AgeType, BuildingComponent, ResearchableTechnologyType, TrainableUnitType } from '../../types';
import { targetFarmCount } from '../../aiEconomyPlan';
import { deAgeState, flushBufferHolds, type FlushBufferSituation, type FlushLine } from '../../aiFlushBuffers';
import { militarySuperiority, type RamGoalInputs } from '../../aiSiege';
import { inFlightTechByOwnerCodec, playerAgesCodec, playerCivilizationsCodec } from '../bridgeStateSerialize';
import { unitLineOf } from '../unitLines';
import { seatFarmWork } from './aiDarkAgeFarms';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';

const LINES: ReadonlyArray<readonly [FlushLine, TrainableUnitType]> = [['spear', 'spearman'], ['archer', 'archer'], ['skirmisher', 'skirmisher']];

const NEXT_AGE: Readonly<Record<AgeType, ResearchableTechnologyType | null>> = {
  'dark-age': 'feudal-age', 'feudal-age': 'castle-age', 'castle-age': 'imperial-age', 'imperial-age': null,
};

/** The buffered line `unit` belongs to, at any tier, or null. */
export function flushLineOf(unit: TrainableUnitType): FlushLine | null {
  const line = unitLineOf(unit);
  return LINES.find(([, root]) => unitLineOf(root) === line)?.[0] ?? null;
}

/** Whether DE's flush buffers hold back a soldier of `unit` this decision. */
export function flushBufferGate(
  deps: AiPhaseDeps,
  ctx: AiOwnerContext,
  ramCensus: () => RamGoalInputs,
): (unit: TrainableUnitType) => boolean {
  let situation: FlushBufferSituation | null = null;
  const read = (): FlushBufferSituation => {
    const { accessor, countOwnedUnits } = deps;
    const { activeWorld, owner, currentAge, targetOwner, pendingResearchKeys } = ctx;
    const work = seatFarmWork(activeWorld, accessor, owner);
    let siegeWorkshops = 0;
    for (const id of activeWorld.query('building')) {
      const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
      if (building?.owner === owner && building.buildingType === 'siege-workshop') siegeWorkshops += 1;
    }
    const next = NEXT_AGE[currentAge];
    const nextAgeResearched = next !== null && (
      (accessor.get(inFlightTechByOwnerCodec).get(owner)?.has(next) ?? false) || pendingResearchKeys.has(`${owner}:${next}`));
    const census = ramCensus();
    const targetAge = targetOwner === null ? null : accessor.get(playerAgesCodec).get(targetOwner) ?? 'dark-age';
    return {
      age: currentAge,
      ageState: deAgeState(currentAge, nextAgeResearched),
      enemyAgeState: targetAge === null ? 0 : deAgeState(targetAge, false),
      farms: work.farmsPlaced,
      // The building phase's own farm target, read the same way (`buildWants`).
      farmTarget: targetFarmCount(currentAge, countOwnedUnits(owner, 'villager')),
      idleFarms: work.idleFarms,
      foodVillagers: work.foodGatherers,
      militaryPopulation: census.militaryPopulation,
      superiority: militarySuperiority(census),
      siegeWorkshops,
      civilization: accessor.get(playerCivilizationsCodec).get(owner),
    };
  };
  return (unit) => {
    const line = flushLineOf(unit);
    if (line === null || !ctx.stockpile) return false;
    situation ??= read();
    return flushBufferHolds(line, ctx.stockpile.wood, situation);
  };
}
