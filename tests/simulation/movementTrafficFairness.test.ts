// The narrow-passage traffic election must not let a unit starve.
//
// Measured defect (defect-register 2026-09-01): the election was
// `Math.min(...cycle)`, which admits only the lowest unit id in a jam. In a
// continuously-replenished jam the high ids are never admitted at all. On
// `seed-2` eleven villagers met head-on in a one-tile choke between trees at
// (48,29) and the lumber camp at (48,31), and admission was monotonic in id
// with no exceptions — 2432 at 88% down to 2460 at 0.6%, twelve wins out of
// 2,104 attempts. Five villagers stood motionless for up to 2,750 ticks, one
// holding a full 10-wood load it could not deliver. Every unit moved
// SOMETIMES, so this is starvation, not deadlock.
//
// Lowest-id is kept as the ordinary rule. Replacing it outright with a fair
// rotation cured four seeds (26 stuck villagers across six seeds down to 5)
// and REGRESSED the boot map from zero stuck villagers to five, so the
// rotation now engages only for a unit that has actually starved.
//
// These are unit tests of the pure election: the clocks are supplied. What
// derives the clocks from cell state — and what a mutant of that derivation
// cannot pass — is `movementTrafficReplenishedJam.test.ts` (review E8).

import { describe, expect, it } from 'vitest';

import {
  TRAFFIC_STARVATION_TICKS,
  electTrafficWinner,
} from '../../src/game/simulation/bridge/movementTrafficElection';
import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
} from '../../src/game/simulation/bridge/pureHelpers';

// The exact jam measured on seed-2 at tick 19,050.
const JAM = [2432, 2434, 2436, 2443, 2448, 2451, 2452, 2455, 2456, 2460];
const LOWEST = Math.min(...JAM);
/** Consecutive admissions that cross one cell at base walk speed: 13. */
const GRANTS_PER_CELL = Math.ceil(UNIT_SUBGRID_RESOLUTION / UNIT_SUBGRID_STEP_PER_TICK);
/**
 * The tuned threshold, as a LITERAL on purpose: measured across six seeds
 * (healthy maps never held a walking villager still past 500 ticks, the
 * pathological ones reached 1,250-5,250), so it is a contract, and the
 * boundary cases below pin the number rather than whatever the constant
 * happens to say. With the constant imported into the assertions a mutant
 * threshold of 1 walked every case green (review E8, M2). A deliberate
 * re-tune comes here and re-derives the cases and the wait bound.
 */
const STARVATION_TICKS = 750;

/**
 * Runs the election the way the arbiter does. A winner's clock resets only
 * when it CROSSES A CELL — after GRANTS_PER_CELL consecutive admissions — not
 * on admission (review E5: an admission-reset model is the mechanism the fix
 * rejected, and it understated the wait bound by a crossing per member).
 */
function runJam(ticks: number): { wins: Map<number, number>; worstWait: number } {
  const lastProgress = new Map<number, number>(JAM.map((id) => [id, 0]));
  const wins = new Map<number, number>(JAM.map((id) => [id, 0]));
  let leader = -1;
  let consecutive = 0;
  let worstWait = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const winner = electTrafficWinner(JAM, tick, (id) => lastProgress.get(id));
    wins.set(winner, (wins.get(winner) ?? 0) + 1);
    consecutive = winner === leader ? consecutive + 1 : 1;
    leader = winner;
    if (consecutive === GRANTS_PER_CELL) {
      lastProgress.set(winner, tick);
      consecutive = 0;
    }
    for (const id of JAM) worstWait = Math.max(worstWait, tick - (lastProgress.get(id) ?? 0));
  }
  return { wins, worstWait };
}

describe('narrow-passage traffic election', () => {
  it('is tuned to 750 ticks of contested waiting', () => {
    // The one place the shipped constant meets the tuned number. A re-tune
    // fails here first, with the cases below to re-derive.
    expect(TRAFFIC_STARVATION_TICKS, 'the threshold moved: re-derive this file').toBe(STARVATION_TICKS);
  });

  it('admits every member of a standing jam rather than starving the high ids', () => {
    // The liveness property. Without it a unit waits forever while its
    // neighbours walk past, which is what shipped.
    const { wins } = runJam(STARVATION_TICKS + GRANTS_PER_CELL * JAM.length + 50);
    const starved = JAM.filter((id) => (wins.get(id) ?? 0) === 0);
    expect(starved, 'these jam members are never admitted — they starve').toEqual([]);
  });

  it('bounds how long any one unit waits', () => {
    // Relief is serial: once the threshold passes, the starved members are
    // relieved in id order and each holds the lane for one crossing, so the
    // last of nine waits the threshold plus nine crossings. Measured defect
    // was a 2,750-tick freeze; this bound is 750 + 13 x 10 + 5 = 885.
    const { worstWait } = runJam(4000);
    expect(worstWait).toBeLessThan(STARVATION_TICKS + GRANTS_PER_CELL * JAM.length + 5);
  });

  it('keeps the lowest-id rule for a member that has waited up to the threshold', () => {
    // Maps that never starve must keep their exact previous behaviour —
    // replacing the rule wholesale cost the boot map five stuck villagers. A
    // threshold that engaged early would fail this on its second tick.
    const clock = (id: number): number => (id === 2460 ? 0 : 99999);
    for (let tick = 0; tick <= STARVATION_TICKS; tick += 1) {
      expect(electTrafficWinner(JAM, tick, (id) => Math.min(clock(id), tick))).toBe(LOWEST);
    }
  });

  it('relieves a member the tick its wait exceeds the threshold, and not one earlier', () => {
    // The boundary in both directions, so the constant is guarded by more
    // than its own definition: 749 and 750 elect the lowest id, 751 relieves.
    const waiter = 2460;
    const clock = (id: number): number => (id === waiter ? 0 : 99999);
    expect(electTrafficWinner(JAM, 749, (id) => Math.min(clock(id), 749))).toBe(LOWEST);
    expect(electTrafficWinner(JAM, 750, (id) => Math.min(clock(id), 750))).toBe(LOWEST);
    expect(electTrafficWinner(JAM, 751, (id) => Math.min(clock(id), 751))).toBe(waiter);
  });

  it('treats a never-arbitrated unit as not starving', () => {
    // `undefined` means no record yet, not an infinitely old one.
    expect(electTrafficWinner(JAM, 99999, () => undefined)).toBe(LOWEST);
  });

  it('is a pure function of the jam, the tick and each member last progress', () => {
    // Determinism is why the original rule was lowest-id and it must survive:
    // ECS iteration order must not decide who enters.
    const clock = (id: number): number => (id === 2460 ? 0 : 90000);
    for (const tick of [0, 1, 7, 19050, 123456]) {
      const first = electTrafficWinner(JAM, tick, clock);
      expect(electTrafficWinner(JAM, tick, clock)).toBe(first);
      expect(electTrafficWinner([...JAM].reverse(), tick, clock)).toBe(first);
    }
  });

  it('elects the longest-starved member, not merely any starved one', () => {
    const clock = (id: number): number => (id === 2460 ? 0 : 5000);
    // 2460 has waited 90,000 ticks; everyone else 85,000. The worst-off wins.
    expect(electTrafficWinner(JAM, 90000, clock)).toBe(2460);
  });
});
