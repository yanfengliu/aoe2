// The AI's escrow, run first in the production phase (work 141 M2a; DE's rules
// and their citations are in `aiEscrow.ts`). It gathers what DE's flags read,
// settles the escrow (`settleEscrow`), asks for what it can buy now, and opens
// the decision's budget (`DecisionBudget`, through `AiPurchases`), which keeps
// the held prices whole.

import type { BuildingComponent, PlayerResources, ResourceComponent } from '../../types';
import { trainingCost } from '../../prototypeEconomyRules';
import {
  conscriptionOffered,
  DecisionBudget,
  flaggedPurchases,
  settleEscrow,
  type EscrowPurchase,
} from '../../aiEscrow';
import type { RamLineUnit } from '../../aiSiege';
import { isEnemyOwner } from '../../alliances';
import { ownerResearchCost } from '../ownerCosts';
import {
  constructionStatesCodec,
  inFlightTechByOwnerCodec,
  monkCarriedRelicCodec,
  playerTeamsCodec,
} from '../bridgeStateSerialize';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';

export interface EscrowResult {
  /** Held purchases not bought yet, each as the budget its check used; the Market aims at these. */
  unpaid: Array<Partial<PlayerResources>>;
  /** A ram was asked for: DE trains one a pass (units.per 12905-12925), so the army loop asks for none. */
  ramBought: boolean;
}

export function runEscrowPhase(
  deps: AiPhaseDeps,
  ctx: AiOwnerContext,
  /** What the next age-up needs; DE buys its age-ups ahead of its flags. */
  ageUpReserve: Partial<PlayerResources>,
  /** The age-up latch holds soldiers and research, so it holds these too. */
  savingForAgeUp: boolean,
  /** The ram DE's ram goal wants now (`aiSiegePhase.ts`), bought ahead of the army and holding nothing. */
  ram: RamLineUnit | null = null,
  /** What a soldier leaves behind: the age-up's reserve, the age's prerequisite wood and the next villager. */
  soldierReserve: Partial<PlayerResources> = ageUpReserve,
): EscrowResult | null {
  const { accessor, monksByOwner, countQueuedUnits, getResearchOptions } = deps;
  const {
    activeWorld, owner, currentAge, stockpile, populationBlocked, purchases,
    findIdleProducerLocal, pendingTrainsByBuilding, pendingResearchByBuilding, pendingResearchKeys,
  } = ctx;
  if (!stockpile || savingForAgeUp || (currentAge !== 'castle-age' && currentAge !== 'imperial-age')) return null;

  const complete = (id: number): boolean => accessor.get(constructionStatesCodec).get(id)?.isComplete !== false;
  const teams = accessor.get(playerTeamsCodec);
  let monasteryStands = false;
  let castleStands = false;
  let monks = monksByOwner.get(owner)?.size ?? 0;
  let enemyMonks = false;
  for (const [other, ids] of monksByOwner) {
    if (ids.size > 0 && other !== owner && isEnemyOwner(teams, owner, other)) enemyMonks = true;
  }
  for (const id of activeWorld.query('building')) {
    const building = activeWorld.getComponent<BuildingComponent>(id, 'building');
    if (!building) continue;
    if (building.owner !== owner) {
      if (building.buildingType === 'monastery' && isEnemyOwner(teams, owner, building.owner)) enemyMonks = true;
      continue;
    }
    if (building.buildingType === 'monastery') {
      if (complete(id)) monasteryStands = true;
      monks += countQueuedUnits(id, 'monk') + (pendingTrainsByBuilding.get(id) ?? 0);
    } else if (building.buildingType === 'castle' && complete(id)) {
      castleStands = true;
    }
  }
  const carried = new Set<number>(accessor.get(monkCarriedRelicCodec).values());
  let relicsOnMap = 0;
  for (const id of activeWorld.query('resource', 'position')) {
    const resource = activeWorld.getComponent<ResourceComponent>(id, 'resource');
    if (resource?.resourceType === 'relic' && resource.owner === null && !carried.has(id)) relicsOnMap += 1;
  }
  const flagged = flaggedPurchases({
    age: currentAge,
    monastery: monasteryStands,
    monks,
    relicsOnMap,
    housingHeadroom: !populationBlocked,
    enemyMonks,
    castle: castleStands,
    conscriptionOffered: conscriptionOffered({
      castle: castleStands,
      listed: castleStands && getResearchOptions(owner, 'castle').includes('conscription'),
      inFlight: accessor.get(inFlightTechByOwnerCodec).get(owner)?.has('conscription') ?? false,
      asked: pendingResearchKeys.has(`${owner}:conscription`),
    }),
    ram,
  });

  const priceOf = (purchase: EscrowPurchase): Partial<PlayerResources> => (
    purchase.kind === 'train'
      ? trainingCost(purchase.unit)
      : ownerResearchCost(activeWorld, accessor, owner, purchase.technology)
  );
  const settled = settleEscrow(
    stockpile, flagged, priceOf, (purchase) => findIdleProducerLocal(purchase.producer) !== null, ageUpReserve, soldierReserve,
  );
  // Asked for before the budget opens, and so not checked by it: the settlement
  // is their check, and the budget starts with them spent.
  let ramBought = false;
  for (const purchase of settled.buy) {
    const producerId = findIdleProducerLocal(purchase.producer);
    if (producerId === null) continue;
    if (purchase.kind === 'train') {
      purchases.buy({ kind: 'train', buildingId: producerId, unit: purchase.unit, price: priceOf(purchase) });
      if (purchase.producer === 'siege-workshop') ramBought = true;
      pendingTrainsByBuilding.set(producerId, (pendingTrainsByBuilding.get(producerId) ?? 0) + 1);
    } else {
      purchases.buy({ kind: 'research', buildingId: producerId, technology: purchase.technology, price: priceOf(purchase) });
      pendingResearchByBuilding.set(producerId, (pendingResearchByBuilding.get(producerId) ?? 0) + 1);
      pendingResearchKeys.add(`${owner}:${purchase.technology}`);
    }
  }
  purchases.openBudget(new DecisionBudget(stockpile, settled.held, settled.bought));
  return { unpaid: settled.unpaid, ramBought };
}
