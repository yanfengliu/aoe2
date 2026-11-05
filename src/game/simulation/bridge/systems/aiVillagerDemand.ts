// Whether the computer's Town Center has a villager to train this decision,
// asked before the soldiers are bought so they can leave its cost (work 141).
// The villager push later in the phase recomputes the queue after any age-up
// it pushed, so the two can differ by that one entry: the reserve then holds a
// villager's food for one decision more than needed, never less.
//
// The production phase trains military first and the villager last, so with
// one pool of food a Dark-Age Militia was bought with the food the next
// villager needed: on the boot map at the lobby's defaults (6b5e9871 plus the
// DE food split), owner 2 sat at 6 villagers from 2:00 to 5:59 while four
// Militia went to the human's base and died. DE's AI keeps its Town Center
// working before anything else in the Dark Age; its usual opening trains no
// soldier with the food its next villager needs. So the soldier is priced on
// top of a villager's cost whenever the Town Center wants one.

import { trainingCost } from '../../prototypeEconomyRules';
import { villagerCapForAge } from '../../ai';
import type { PlayerResources } from '../../types';
import { constructionStatesCodec, productionQueuesCodec } from '../bridgeStateSerialize';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';

export interface TownCenterVillagerDemand {
  townCenterId: number;
  /** Entries in the Town Center's queue, persisted plus pushed this tick. */
  queueLength: number;
  /** Villagers owned, queued and pushed this tick. */
  villagers: number;
  cap: number;
  /** Complete, under the villager count, below the population cap, and the
   *  queue has room. */
  wantsVillager: boolean;
}

export function townCenterVillagerDemand(
  deps: Pick<AiPhaseDeps, 'accessor' | 'countOwnedUnits' | 'countQueuedUnits'>,
  ctx: Pick<AiOwnerContext, 'owner' | 'ownerTownCenterId' | 'currentAge' | 'populationBlocked'
    | 'pendingTrainsByBuilding' | 'pendingResearchByBuilding'>,
): TownCenterVillagerDemand | null {
  const townCenterId = ctx.ownerTownCenterId;
  if (townCenterId === null) return null;
  const construction = deps.accessor.get(constructionStatesCodec).get(townCenterId);
  if (construction && !construction.isComplete) return null;
  // The AI only pushes villagers to the Town Center, so every pending train
  // there is a pending villager.
  const pendingTrains = ctx.pendingTrainsByBuilding.get(townCenterId) ?? 0;
  const queueLength = (deps.accessor.get(productionQueuesCodec).get(townCenterId)?.length ?? 0)
    + pendingTrains + (ctx.pendingResearchByBuilding.get(townCenterId) ?? 0);
  const villagers = deps.countOwnedUnits(ctx.owner, 'villager')
    + deps.countQueuedUnits(townCenterId, 'villager') + pendingTrains;
  const cap = villagerCapForAge(ctx.currentAge);
  return {
    townCenterId,
    queueLength,
    villagers,
    cap,
    wantsVillager: !ctx.populationBlocked && villagers < cap && queueLength < 2,
  };
}

/** What a soldier must leave behind: the next villager's cost, when one is due. */
export function villagerReserve(demand: TownCenterVillagerDemand | null): Partial<PlayerResources> {
  return demand?.wantsVillager ? trainingCost('villager') : {};
}
