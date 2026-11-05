// The AI's tribute line (spec §6.8, AoE2 team play): keep an ALLY solvent.
// When the AI holds a fat stockpile of a resource and an ally is nearly dry,
// send one chunk through the same recorded tribute.send channel a human uses
// — the direct executor re-checks the Market, both stockpiles, and the fee at
// execution time, so this phase only decides, never bypasses.

import type { EconomyResourceKind } from '../../types';
import { areAllied } from '../../alliances';
import { constructionStatesCodec, playerResourcesCodec, playerTeamsCodec, researchedTechnologiesCodec } from '../bridgeStateSerialize';
import type { BuildingComponent } from '../../types';
import { tributeCost, tributeFeeRateFor } from '../../tributeRules';
import type { AiOwnerContext, AiPhaseDeps } from './aiSystemTypes';

// Presence-over-optimum scale, like the trade-cart cap: a 100 chunk when the
// ally is under 150 and the sender would still hold ~1000 before the fee.
export const AI_TRIBUTE_CHUNK = 100;
export const AI_TRIBUTE_ALLY_FLOOR = 150;
export const AI_TRIBUTE_SENDER_RESERVE = 1000;

const TRIBUTE_RESOURCES: readonly EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];

export function runTributePhase(deps: AiPhaseDeps, ctx: AiOwnerContext): void {
  const { world, accessor } = deps;
  const { owner, stockpile, purchases } = ctx;
  if (!stockpile) return;

  // A completed Market is the tribute prerequisite — cheap scan, same shape
  // as the trade phase's.
  const constructions = accessor.get(constructionStatesCodec);
  let ownMarket = false;
  for (const id of world.query('building')) {
    const building = world.getComponent<BuildingComponent>(id, 'building');
    if (!building || building.owner !== owner || building.buildingType !== 'market') continue;
    const construction = constructions.get(id);
    if (construction && !construction.isComplete) continue;
    ownMarket = true;
    break;
  }
  if (!ownMarket) return;

  const teams = accessor.get(playerTeamsCodec);
  const stockpiles = accessor.get(playerResourcesCodec);
  for (const [other, allyStockpile] of stockpiles) {
    if (other === owner || !areAllied(teams, owner, other)) continue;
    for (const resource of TRIBUTE_RESOURCES) {
      if (allyStockpile[resource] >= AI_TRIBUTE_ALLY_FLOOR) continue;
      if (stockpile[resource] < AI_TRIBUTE_SENDER_RESERVE) continue;
      // While DE's escrow holds or has bought anything, the chunk and its fee
      // go through the decision's budget like every purchase before it, so a
      // tribute cannot send what is held for a Monk or Conscription (work 141
      // review round 7: Conscription holds food too).
      const researched = accessor.get(researchedTechnologiesCodec).get(owner) ?? new Set();
      const price = { [resource]: tributeCost(AI_TRIBUTE_CHUNK, tributeFeeRateFor(researched)) };
      if (!purchases.buy({ kind: 'tribute', to: other, resource, amount: AI_TRIBUTE_CHUNK, price })) continue;
      // One chunk per decision tick: generosity with a metering valve.
      return;
    }
  }
}
