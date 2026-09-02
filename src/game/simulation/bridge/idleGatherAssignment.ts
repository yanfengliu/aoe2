// What a gatherer with no workable target does next.
//
// Assigning it a resource of the kind it wants is the ordinary case. The rest
// of this module exists for when that fails: the AI's own sheep were eaten, the
// enemy's were not gatherable, and farms were unaffordable, so eleven of its
// villagers stood idle wanting food while its wood sat at thirteen and blocked
// every building it wanted to put up. A villager with no work takes work of
// another kind rather than standing still.

import type { EconomyResourceKind, GathererComponent } from '../types';
import type { AssignmentOutcome } from './villagerGatherAssignment';

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
 *
 * Safe work first, of any kind (2026-09-02): the first pass over the kinds
 * refuses nodes under enemy static defences (`safeOnly`), so a villager whose
 * home gold is gone chops wood rather than mining under the enemy's Town
 * Centre. Only when no kind has a safe node does the second pass accept the
 * exception — the wanted kind first — and it visits only the kinds the first
 * pass reported as dangerous-only, so a map with nothing left costs no more
 * scans than before.
 */
export function assignIdleGatherer(
  gatherer: GathererComponent,
  assign: (safeOnly: boolean) => AssignmentOutcome,
): void {
  const wanted = gatherer.desiredResource;
  const dangerousOnly: EconomyResourceKind[] = [];
  const trySafe = (kind: EconomyResourceKind): boolean => {
    gatherer.desiredResource = kind;
    const outcome = assign(true);
    if (outcome === 'dangerous-only') dangerousOnly.push(kind);
    return outcome === 'assigned';
  };
  if (trySafe(wanted)) return;
  for (const kind of GATHER_KIND_FALLBACK_ORDER) {
    if (kind === wanted) continue;
    if (trySafe(kind)) return;
  }
  for (const kind of dangerousOnly) {
    gatherer.desiredResource = kind;
    if (assign(false) === 'assigned') return;
  }
  // Nothing anywhere: leave the desire where the caller's last try put it,
  // as before — the AI's rebalance resets it on its next decision.
}
