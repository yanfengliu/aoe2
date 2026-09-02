// An AI economy must keep moving, and both owners must leave the Dark Age.
//
// The cheap twin of the `playtest-corpus.json` progression gate, which caught
// this in CI where it takes minutes; these two cases fail in about one.
//
// What happened (2026-09-02): ordering RESOURCE approach cells nearest-first
// deadlocked the gather economy. On the boot map all nine of owner 2's
// villagers ended stacked on ONE cell (51,28), every one latched in
// `to-resource` and motionless across a 60-tick trace, and its stockpile went
// byte-identical from tick 8,000 — food 415, wood 27, gold 310 — never leaving
// the Dark Age and eventually being wiped out. Baseline reached Feudal at
// 9,200 with 19 villagers.
//
// TWO HYPOTHESES WERE WRONG BEFORE THE RIGHT ONE, and a control killed each,
// not a re-reading of the code. First: DE build times had slowed the opening —
// but the stall reproduced with the OLD build times restored, so it was not
// the data. Second: the town bell was latching, because an enemy that stops
// wandering camps inside RAID_RADIUS and the all-clear waits for a stale
// sighting that never comes. That reads convincingly, a shelter cap was built
// for it, and it moved the measurement by exactly nothing — stockpile delta
// 162 before and after, Feudal at 14,100/13,800 both with the cap and with it
// disabled — so it was reverted. The cause was the resource ordering alone.
//
// The nearest-first rule stays where the finding that motivated it lives:
// BUILDING approaches (see `approachOrdering.ts` and the F2 gate in
// `buildApproachNearestEdge.test.ts`). Making the gather path nearest-first is
// its own change and needs its own measurement.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

/** Past the measured Feudal transition on both corpus seeds, with margin:
 *  `aoe2-prototype` 14,100 / 13,800 and `default-seed` 10,100 / 10,400 at
 *  v0.3.187. A horizon that sits ON a transition reports a match mid-advance,
 *  which is how the corpus gate came to fail at 13,000 on a game that was 800
 *  ticks from passing it. `playtest-corpus.json` carries the same 20,000. */
const HORIZON_TICKS = 20_000;

describe('the AI economy', () => {
  it('keeps gathering rather than freezing', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([1]),
    });
    const stockpile = (): number => {
      const res = bridge.getEconomyState().playerResources[2]
        ?? { food: 0, wood: 0, gold: 0, stone: 0 };
      return (res.food ?? 0) + (res.wood ?? 0) + (res.gold ?? 0) + (res.stone ?? 0);
    };

    for (let tick = 0; tick < 6_000; tick += 1) bridge.step(100);
    const before = stockpile();
    for (let tick = 0; tick < 6_000; tick += 1) bridge.step(100);
    const after = stockpile();

    // A working economy SPENDS as well as gathers, so the stockpile is not a
    // straight line up — but a frozen one does neither. The deadlocked run
    // moved by 162 across these 6,000 ticks (10 minutes of game time) while
    // gathering nothing at all; a live one moves by hundreds.
    expect(
      Math.abs(after - before),
      `owner 2's stockpile moved by ${String(after - before)} over 6,000 ticks — it is frozen`,
    ).toBeGreaterThan(200);
  }, 300_000);

  it('gets EVERY owner out of the Dark Age on the boot map', () => {
    const bridge = createSimulationBridge('aoe2-prototype', {
      forceAiForOwners: new Set([1]),
    });
    const reached: Record<number, number | null> = { 1: null, 2: null };
    for (let tick = 1; tick <= HORIZON_TICKS; tick += 1) {
      bridge.step(100);
      if (tick % 100 !== 0) continue;
      const ages = bridge.getEconomyState().ages ?? {};
      for (const owner of [1, 2]) {
        if (reached[owner] === null && ages[owner] !== undefined && ages[owner] !== 'dark-age') {
          reached[owner] = tick;
        }
      }
      if (reached[1] !== null && reached[2] !== null) break;
    }
    const stuck = Object.entries(reached).filter(([, tick]) => tick === null).map(([owner]) => owner);
    expect(
      stuck,
      `owner(s) never left the Dark Age within ${String(HORIZON_TICKS)} ticks: ${JSON.stringify(reached)}`,
    ).toEqual([]);
  }, 600_000);
});
