// Which gatherer can harvest which resource, by DOMAIN.
//
// The resource-kind filter alone is not enough. A fish is FOOD, exactly like a
// berry bush, so a land villager assigned to gather food would happily pick a
// fish, walk to the shoreline, and stand there forever — it cannot enter a
// water cell (spec §12.4). On the default map that pinned the AI's food
// villagers at the coast and its entire stockpile stopped moving at around tick
// 6000: a frozen economy that looked like a pathing bug and was really a
// mis-assignment.
//
// The rule is the same complementary one that governs movement: a water
// gatherer harvests only water resources, a land gatherer only land ones.

import { isWaterUnit } from './unitDomain';
import type { ResourceKind, UnitType } from './types';

/** Resources that sit in water. Open water is boat-only; a fish against the
 *  shore is villager work too (see `canGathererHarvest`). */
const WATER_RESOURCES = new Set<ResourceKind>(['fish']);

export function isWaterResource(resourceKind: ResourceKind): boolean {
  return WATER_RESOURCES.has(resourceKind);
}

/**
 * Whether this unit can actually work this resource.
 *
 * Deliberately expressed as domains rather than a list of pairs: a new water
 * resource or a new ship is covered without touching this, and the failure mode
 * it prevents — a unit walking forever toward something it can never stand
 * beside — is silent, so it must not depend on anyone remembering to add a case.
 */
export function canGathererHarvest(
  unitType: UnitType,
  resourceKind: ResourceKind,
  options?: { readonly onShore?: boolean },
): boolean {
  // AoE2's one exception, and it is not an exception to the rule above so much
  // as a correction to what "water resource" means: SHORE fish are gathered by
  // villagers standing on the land beside them, with no Dock and no Fishing
  // Ship. Only open water is boat work. The caller decides whether this fish
  // touches land (shoreFishing.isShoreFish) — a land gatherer with `onShore`
  // has somewhere to stand, which is exactly what the domain rule was there to
  // guarantee.
  if (resourceKind === 'fish' && options?.onShore === true) return true;
  return isWaterUnit(unitType) === isWaterResource(resourceKind);
}
