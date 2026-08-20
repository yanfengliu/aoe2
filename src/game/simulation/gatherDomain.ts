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

/** Resources that sit in water and can only be worked from a boat. */
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
export function canGathererHarvest(unitType: UnitType, resourceKind: ResourceKind): boolean {
  return isWaterUnit(unitType) === isWaterResource(resourceKind);
}
