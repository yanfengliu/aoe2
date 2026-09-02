// The starvation rule must relieve only a unit that is actually WAITING — one
// that has been attempting to move on every tick — never one that stood still
// by choice and then asked once.
//
// Review E1 (docs/threads/current/concurrency-review-2026-09-02/REVIEW.md): the
// v0.3.175 clock was stamped on cell change alone, so it kept running while a
// unit built a Town Centre (~1,500 ticks), sat garrisoned, or stood parked, and
// such a unit was elected over genuinely contested ones on its first ask. The
// reviewer's instrument found 16 phantom consults across 10 units on the boot
// map by 30,000 ticks, and 2,800 genuine starvation consults across 17 units
// there — all after tick 3,000 — so the 20,000-tick census that called the
// boot map "preserved field-for-field" had simply stopped before the rule
// engaged.
//
// This runs the boot map to 30,000 ticks in self-play with a counter injected
// through the arbiter's `onStarvationRelief` hook, and classifies every
// admission the starvation rule grants by whether the winner had attempted to
// move within the previous tick. Measured on `aoe2-prototype` at 30,000 ticks:
//
//   before the fix (the shipped v0.3.178 arbiter, patched only with this
//   probe — firing whenever the starvation branch decided the election, a
//   starved winner that is itself the lowest id included):
//     relief admissions 245 across 18 units, first at tick 15,284;
//     PHANTOM 5 across 5 units — tick 17,761 unit 2171 "waited" 1,510 ticks
//     with its last attempt 1,511 ticks ago; tick 27,815 unit 2167, 2,353
//     waited / 2,354 since its last attempt; units 2498, 2218 and 2211 at
//     792-1,049. Every phantom was relieved on the very first tick it asked.
//     Measured twice, by two sessions, identically.
//   after the fix (clock restarts when a unit resumes attempting):
//     relief admissions 229 across 10 units, first at tick 22,195;
//     phantom 0 — also measured twice, identically.
//
// "Before" is one number per ARM and per PROBE, so both are named above; the
// second session learned that by failing to reproduce 245 / 5 twice first.
// The E1 rule alone removed from the fixed code (`|| attemptGap > 1` deleted
// from `trafficProgressClock`, E2's snapshot read kept) gives 259 / 18 /
// 15,284 / 6 phantom — the same units plus 2477 at 29,927; the shipped
// arbiter probed only where the winner is NOT the lowest id gives 212 / 15 /
// 17,439 / 3, because that probe cannot see a starved lowest id (33 of the
// 245 were one). The claim every arm agrees on is the one asserted here.
//
// (The reviewer's figures — 2,800 genuine and 16 phantom — counted CONSULTS
// in the starved state; these count ADMISSIONS the rule granted.) Both
// halves are asserted: no phantom relief, and the rule still engages on this
// map past the old census horizon (a mutant that never relieves anyone —
// stamping on every consult, the rejected attempt 2 — fails the second one).

import { describe, expect, it, vi } from 'vitest';
import type { Position } from 'civ-engine';

import type { TrafficReliefEvent } from '../../src/game/simulation/bridge/movementTrafficOps';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import type { UnitTransformComponent } from '../../src/game/simulation/types';

interface ReliefLedger {
  admissions: number;
  phantom: number;
  units: Set<number>;
  phantomUnits: Set<number>;
  firstTick: number | null;
  phantomExamples: string[];
}

const ledger: ReliefLedger = {
  admissions: 0,
  phantom: 0,
  units: new Set(),
  phantomUnits: new Set(),
  firstTick: null,
  phantomExamples: [],
};

/** How many ticks since the unit last attempted to move, read at the start of
 *  its consult — before the arbiter stamps anything for this tick. */
const attemptGapAtEntry = new Map<number, { tick: number; gap: number }>();

vi.mock('../../src/game/simulation/bridge/movementTrafficOps', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/game/simulation/bridge/movementTrafficOps')>();
  type Deps = Parameters<typeof mod.createMovementTrafficOps>[0];
  return {
    ...mod,
    createMovementTrafficOps: (deps: Deps) => {
      const ops = mod.createMovementTrafficOps({
        ...deps,
        onStarvationRelief: (event: TrafficReliefEvent) => {
          ledger.admissions += 1;
          ledger.units.add(event.unitId);
          ledger.firstTick ??= event.tick;
          const entry = attemptGapAtEntry.get(event.unitId);
          const gap = entry && entry.tick === event.tick ? entry.gap : Number.POSITIVE_INFINITY;
          if (gap > 1) {
            ledger.phantom += 1;
            ledger.phantomUnits.add(event.unitId);
            if (ledger.phantomExamples.length < 12) {
              ledger.phantomExamples.push(
                `tick ${String(event.tick)} unit ${String(event.unitId)} waited ${String(event.waited)} ticks, last attempt ${String(gap)} ticks ago`,
              );
            }
          }
        },
      });
      return {
        resolveMovementTraffic: (unitId: number, nextStep: Position, activeWorld?: GameWorld) => {
          const world = activeWorld ?? deps.world;
          const transform = world.getComponent<UnitTransformComponent>(unitId, 'unitTransform');
          const gap = transform?.trafficAttemptTick === undefined
            ? Number.POSITIVE_INFINITY
            : world.tick - transform.trafficAttemptTick;
          attemptGapAtEntry.set(unitId, { tick: world.tick, gap });
          return ops.resolveMovementTraffic(unitId, nextStep, activeWorld);
        },
      };
    },
  };
});

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';

/** Past the 20,000-tick census that missed the rule engaging (review I3). */
const HORIZON_TICKS = 30_000;

describe('the starvation rule on the boot map', () => {
  it('relieves only units that were attempting to move on the previous tick, and still engages', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([HUMAN_PLAYER_ID]),
    });
    for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) bridge.step(100);

    const summary = `relief admissions ${String(ledger.admissions)} across ${String(ledger.units.size)} units`
      + ` (first at tick ${String(ledger.firstTick)}), phantom ${String(ledger.phantom)}`
      + ` across ${String(ledger.phantomUnits.size)} units`
      + (ledger.phantomExamples.length > 0 ? `\n  ${ledger.phantomExamples.join('\n  ')}` : '');
    console.log(`RELIEF aoe2-prototype ${String(HORIZON_TICKS)} ticks: ${summary}`);

    expect(
      ledger.phantom,
      `a unit that was not attempting to move was relieved over units that were — ${summary}`,
    ).toBe(0);
    expect(
      ledger.admissions,
      `the starvation rule never engaged on the boot map by ${String(HORIZON_TICKS)} ticks, where it fired 2,800 times when measured — ${summary}`,
    ).toBeGreaterThan(0);
  }, 1_800_000);
});
