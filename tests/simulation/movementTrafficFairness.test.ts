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

import { describe, expect, it } from 'vitest';

import { electTrafficWinner } from '../../src/game/simulation/bridge/movementTrafficOps';

// The exact jam measured on seed-2 at tick 19,050.
const JAM = [2432, 2434, 2436, 2443, 2448, 2451, 2452, 2455, 2456, 2460];
const STARVATION_TICKS = 750;

/** Runs the election the way the arbiter does: the winner's clock resets. */
function runJam(ticks: number, startTick = 0): Map<number, number> {
  const lastProgress = new Map<number, number>(JAM.map((id) => [id, startTick]));
  const wins = new Map<number, number>(JAM.map((id) => [id, 0]));
  for (let tick = startTick; tick < startTick + ticks; tick += 1) {
    const winner = electTrafficWinner(JAM, tick, (id) => lastProgress.get(id));
    lastProgress.set(winner, tick);
    wins.set(winner, (wins.get(winner) ?? 0) + 1);
  }
  return wins;
}

describe('narrow-passage traffic election', () => {
  it('admits every member of a standing jam rather than starving the high ids', () => {
    // The liveness property. Without it a unit waits forever while its
    // neighbours walk past, which is what shipped.
    const wins = runJam(STARVATION_TICKS + 400);
    const starved = JAM.filter((id) => (wins.get(id) ?? 0) === 0);
    expect(starved, 'these jam members are never admitted — they starve').toEqual([]);
  });

  it('bounds how long any one unit waits', () => {
    // The measured defect was a 2,750-tick freeze. Relief must arrive within
    // roughly the threshold plus one pass through the jam.
    const lastProgress = new Map<number, number>(JAM.map((id) => [id, 0]));
    let worstWait = 0;
    for (let tick = 0; tick < 4000; tick += 1) {
      const winner = electTrafficWinner(JAM, tick, (id) => lastProgress.get(id));
      lastProgress.set(winner, tick);
      for (const id of JAM) worstWait = Math.max(worstWait, tick - (lastProgress.get(id) ?? 0));
    }
    expect(worstWait).toBeLessThan(STARVATION_TICKS + JAM.length + 5);
  });

  it('leaves a healthy jam on the stable lowest-id rule', () => {
    // Maps that never starve must keep their exact previous behaviour —
    // replacing the rule wholesale cost the boot map five stuck villagers.
    for (let tick = 0; tick < STARVATION_TICKS; tick += 1) {
      expect(electTrafficWinner(JAM, tick, () => tick)).toBe(Math.min(...JAM));
    }
  });

  it('treats a never-arbitrated unit as not starving', () => {
    // `undefined` means no record yet, not an infinitely old one.
    expect(electTrafficWinner(JAM, 99999, () => undefined)).toBe(Math.min(...JAM));
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
