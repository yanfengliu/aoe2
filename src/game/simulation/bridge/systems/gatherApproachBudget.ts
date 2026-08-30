// How long a villager may spend walking to a CONTESTED resource before it
// gives up and fans out to an uncontended one.
//
// This used to be a flat 80 ticks, and that number was written when a unit
// moved 2 fine units per tick — 0.5 tiles/tick, so 80 ticks bought roughly 40
// tiles of walking and only a villager genuinely stuck behind others ever
// reached it. The §12.4.2 movement clock (v0.3.160) walks a villager at 0.08
// tiles/tick, which turns the same 80 ticks into 6.4 tiles.
//
// Measured on `aoe2-prototype` (2026-08-29): owner 2's food assignments sat a
// median 7 tiles away — an ~87-tick walk — so the villager abandoned its
// target JUST before arriving, was reassigned to another far target, and
// repeated that forever. It gathered 8% of the time and never left the Dark
// Age, while owner 1, whose food sat a median 3 tiles away (~37 ticks), was
// untouched. That is why the freeze looked map-specific: the bug only bites
// where the walk is longer than the budget.
//
// So the budget is expressed as TRAVEL, not as ticks: the walk the villager
// was actually given, plus a margin for traffic and the approach step, and a
// floor so a target underfoot still gets a fair chance. Any future change to
// the movement clock moves this with it, which a bare tick count cannot do.

import { UNIT_SUBGRID_RESOLUTION, UNIT_SUBGRID_STEP_PER_TICK } from '../pureHelpers';

/** Ticks a villager needs to cover one tile at the base walk speed. */
const TICKS_PER_TILE = UNIT_SUBGRID_RESOLUTION / UNIT_SUBGRID_STEP_PER_TICK;

/** Slack over the ideal walk: traffic yields, lane alignment, the final step. */
const APPROACH_SLACK = 1.25;

/** A target underfoot still gets this long, so the fan-out cannot thrash. */
const MINIMUM_APPROACH_TICKS = 40;

/**
 * The tick budget for walking `distanceTiles` to a contested resource. Always
 * longer than the walk itself, so a villager is never judged on a clock that
 * cannot finish the journey it was handed, and bounded well under a stall so
 * the fan-out this backs still fires for a villager that is genuinely queued.
 */
export function gatherApproachBudgetTicks(distanceTiles: number): number {
  const walk = Math.max(0, distanceTiles) * TICKS_PER_TILE;
  return Math.max(MINIMUM_APPROACH_TICKS, Math.round(walk * APPROACH_SLACK));
}
