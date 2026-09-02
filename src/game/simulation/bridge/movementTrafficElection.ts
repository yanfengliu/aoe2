// The narrow-passage election and the starvation clock it reads. Split out of
// movementTrafficOps.ts (which sits at the 500-line cap) so the rule that
// decides who enters a contested cell, and the rule that decides what
// "waiting" means, live in one short file the tests import directly.

import type { Position } from 'civ-engine';

import type { UnitTransformComponent } from '../types';

/**
 * Ticks a unit may wait in a contested passage — attempting to move on every
 * tick and never changing cell — before the election prefers it over the
 * standing lowest-id winner.
 *
 * Chosen against measurement, not taste. Across six seeds the healthy maps
 * never held a WALKING villager still for more than 500 ticks, while the
 * pathological ones reached 1,250-5,250. The clock counts only continuous
 * attempting (see `trafficProgressClock`), so the phases that routinely
 * exceed 750 ticks on every map — a Town Centre build is ~1,500, a garrison
 * or a parked army is unbounded — never reach it. Gated at the boundary by
 * `movementTrafficFairness.test.ts` (749/750 elect lowest-id, 751 relieves)
 * and in play by `movementTrafficReplenishedJam.test.ts`.
 */
export const TRAFFIC_STARVATION_TICKS = 750;

/** The starvation clock's inputs: the unit's persisted record and its live cell. */
export type TrafficClockRecord = Pick<
  UnitTransformComponent,
  'trafficProgressTick' | 'trafficProgressCellX' | 'trafficProgressCellY' | 'trafficAttemptTick'
>;

/**
 * The tick this unit's starvation clock counts from, or undefined when the
 * unit has no record (never arbitrated — not starving).
 *
 * The clock measures CONTINUOUS CONTESTED WAITING and nothing else, so it
 * restarts at `tick` when the unit has changed cell since the record (it is
 * getting somewhere), and when it has not attempted to move within the last
 * tick (it was standing still by choice — a builder at its site, a garrisoned
 * or parked unit). Before that second rule the clock ran across every phase a
 * unit spends not moving, so a builder that finished a Town Centre and was
 * then retasked through a one-wide gap won its first contested election over
 * a unit that had been asking for 700 ticks; measured on the boot map at 16
 * phantom consults across 10 units in 30,000 ticks (review E1).
 *
 * One rule for both readers: the arbiter's per-consult stamp and the
 * tick-start snapshot the election reads both go through here, so every
 * member of a jam sees the same clock for every other member.
 */
export function trafficProgressClock(
  record: TrafficClockRecord,
  position: Position,
  tick: number,
): number | undefined {
  if (record.trafficProgressTick === undefined) return undefined;
  const moved = record.trafficProgressCellX !== position.x
    || record.trafficProgressCellY !== position.y;
  const attemptGap = record.trafficAttemptTick === undefined
    ? Number.POSITIVE_INFINITY
    : tick - record.trafficAttemptTick;
  if (moved || attemptGap > 1) return tick;
  return record.trafficProgressTick;
}

export interface TrafficElection {
  readonly winner: number;
  /** True when the winner was chosen by the starvation rule, not lowest-id. */
  readonly starved: boolean;
  /** How long the starved winner had waited; 0 for a lowest-id winner. */
  readonly waited: number;
}

/**
 * Elects the single unit admitted from a closed jam.
 *
 * Two properties are load-bearing. It is a pure function of the jam, the tick
 * and each member's clock, and every member of one closure must read the same
 * clocks — the caller supplies them from the tick-start snapshot, never live —
 * so every member elects the SAME winner, or two units drive into one cell.
 *
 * The shipped rule was `Math.min(...cycle)` alone, which is stable but unfair:
 * it admits only the lowest id, so in a continuously-replenished jam the high
 * ids are never admitted at all. Measured on `seed-2` — eleven villagers
 * head-on in a one-tile choke — admission was monotonic in id from 88% down to
 * 0.6%, and five villagers stood still for up to 2,750 ticks.
 *
 * Lowest-id is KEPT as the ordinary rule, because replacing it outright
 * regressed the boot map from zero stuck villagers to five. It yields only to
 * a member whose clock says it has waited past TRAFFIC_STARVATION_TICKS.
 */
export function electTrafficWinnerDetailed(
  cycle: Iterable<number>,
  tick: number,
  lastProgressTick: (id: number) => number | undefined,
): TrafficElection {
  const ids = [...cycle].sort((left, right) => left - right);
  if (ids.length === 0) return { winner: -1, starved: false, waited: 0 };
  if (ids.length === 1) return { winner: ids[0]!, starved: false, waited: 0 };
  let starved = -1;
  let longestWait = TRAFFIC_STARVATION_TICKS;
  for (const id of ids) {
    const since = lastProgressTick(id);
    // A unit with no record has never been arbitrated; it is not starving.
    if (since === undefined) continue;
    const waited = tick - since;
    // Strictly greater keeps the winner stable when two units tie: the sorted
    // scan reaches the lower id first and later ties do not displace it.
    if (waited > longestWait) {
      longestWait = waited;
      starved = id;
    }
  }
  return starved === -1
    ? { winner: ids[0]!, starved: false, waited: 0 }
    : { winner: starved, starved: true, waited: longestWait };
}

/** The winner alone — what the unit tests and the arbiter's callers want. */
export function electTrafficWinner(
  cycle: Iterable<number>,
  tick: number,
  lastProgressTick: (id: number) => number | undefined,
): number {
  return electTrafficWinnerDetailed(cycle, tick, lastProgressTick).winner;
}
