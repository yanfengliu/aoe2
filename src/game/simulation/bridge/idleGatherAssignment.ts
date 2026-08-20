// What a gatherer with no workable target does next.
//
// Assigning it a resource of the kind it wants is the ordinary case. The rest
// of this module exists for when that fails: the AI's own sheep were eaten, the
// enemy's were not gatherable, and farms were unaffordable, so eleven of its
// villagers stood idle wanting food while its wood sat at thirteen and blocked
// every building it wanted to put up. A villager with no work takes work of
// another kind rather than standing still.

import type { EconomyResourceKind, GathererComponent } from '../types';

// How often a gatherer with no reachable target re-probes for one. The probe
// costs bounded pathfinding, so running it every tick for every stuck villager
// dominated the whole simulation once the AI's economy actually moved: a
// thousand ticks went from under two seconds to seventy. Staggering by id
// spreads that cost over ticks instead of spiking it on one, and retrying
// within a second of game time is far below noticing.
const REACHABILITY_RETRY_TICKS = 8;

/** Whether this gatherer should pay for a reachability probe on this tick. */
export function shouldRetryReachability(tick: number, gathererId: number): boolean {
  return (tick + gathererId) % REACHABILITY_RETRY_TICKS === 0;
}

// The kinds a villager falls back to, in the order it tries them. Wood first:
// it gates houses and farms, and a player short of wood is short of everything
// else soon after.
const GATHER_KIND_FALLBACK_ORDER: readonly EconomyResourceKind[] = [
  'wood', 'food', 'gold', 'stone',
];

/**
 * Assigns work to an idle gatherer, falling back through the other resource
 * kinds when nothing of the kind it wants can be gathered. `assign` is the
 * caller's assignment step; it is re-run once per alternative kind, and the
 * gatherer's `desiredResource` is left on whichever kind produced work (or on
 * the last one tried, when none did).
 */
export function assignIdleGatherer(
  gatherer: GathererComponent,
  assign: () => void,
): void {
  assign();
  if (gatherer.targetResourceId !== null) return;

  const wanted = gatherer.desiredResource;
  for (const kind of GATHER_KIND_FALLBACK_ORDER) {
    if (kind === wanted) continue;
    gatherer.desiredResource = kind;
    assign();
    if (gatherer.targetResourceId !== null) return;
  }
}
