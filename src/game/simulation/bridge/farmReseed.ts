// M1 Farms (slice 2): farm auto-reseed-if-affordable. When a farm's stored
// food reaches 0, the villager-economy gather loop calls this BEFORE its
// slice-1 `destroyResourceEntity` fallback. A farm is a building+resource
// HYBRID, so it is treated as a wood→food converter: if its OWNER can afford
// the farm's build cost (60 wood — the same CONSTRUCTION_COSTS['farm'] entry
// the placement charges) the owner is charged that wood and the farm's stored
// food is reset to its max, in place — the SAME entity, no destroy, no re-path,
// no HP change, instant. The assigned villager keeps gathering seamlessly. If
// the owner cannot pay, the helper returns false and the caller removes the
// farm exactly as slice 1 (an un-reseeded farm disappears in AoE2).
//
// Extracted into its own module so villagerEconomySystem.ts stays under the
// 500-LOC file ceiling.

import type { BuildingComponent, ResourceComponent } from '../types';
import type { GameWorld } from './pureHelpers';
import type { BridgeStateAccessor } from './bridgeStateAccessor';
import { playerResourcesCodec, researchedTechnologiesCodec } from './bridgeStateSerialize';
import { canAfford, constructionCost, spendResources } from '../prototypeEconomyRules';
import { farmFoodCapacity, EMPTY_TECH_SET } from '../economyTechEffects';

// The farm's build cost doubles as its reseed cost (AoE2 farm = a wood→food
// converter you re-pay to maintain). Read from the same source the build
// charges so the two never drift.
const FARM_RESEED_COST = constructionCost('farm');

// Attempt to auto-reseed a depleted resource if it is a farm and its owner can
// afford the wood. Returns true when the farm was reseeded (caller must NOT
// destroy it and must keep the gatherer targeting it); false when it is not a
// farm, has no owner to charge, or the owner is broke (caller destroys as in
// slice 1).
export function tryReseedFarm(
  world: GameWorld,
  accessor: BridgeStateAccessor,
  resourceId: number,
  resource: ResourceComponent,
): boolean {
  // Only the building+resource farm hybrid auto-reseeds; trees / gold / stone /
  // berries / wildlife all fall through to destroy.
  if (resource.resourceType !== 'farm') return false;
  if (world.getComponent<BuildingComponent>(resourceId, 'building') === undefined) return false;

  // The FARM's owner pays — not the gathering villager's owner. Farms are
  // gather-restricted to their owner, so today these are the same player, but
  // charging baseOwner keeps the cost on the farm's owner regardless.
  const owner = resource.baseOwner;
  if (owner === null) return false;

  const stockpile = accessor.get(playerResourcesCodec).get(owner);
  if (!stockpile || !canAfford(stockpile, FARM_RESEED_COST)) return false;

  spendResources(stockpile, FARM_RESEED_COST);
  accessor.markDirty(playerResourcesCodec);
  // Reset stored food to the farm's current capacity, DERIVED from the OWNER's
  // researched farm-food techs (Horse Collar / Heavy Plow / Crop Rotation):
  // farmFoodCapacity returns the base 175 plus the additive tech bonuses, so a
  // maintained farm reseeds to its UPGRADED cap (e.g. 250/375/550) once the
  // owner has the techs. maxAmount is widened (never lowered) so amount never
  // exceeds max even if a fixture seeded a higher max.
  const capacity = farmFoodCapacity(
    accessor.get(researchedTechnologiesCodec).get(owner) ?? EMPTY_TECH_SET,
  );
  resource.maxAmount = Math.max(resource.maxAmount, capacity);
  resource.amount = resource.maxAmount;
  return true;
}
