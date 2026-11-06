// The game speed is presentation-side (spec §4.5, work 149): a frame's
// simulation delta is its elapsed time times the speed, so a faster match is
// the same match stepped further per frame. Driven through the frame delta
// the view computes (`frameSimulationDelta`) and the real bridge.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - The boot map (`aoe2-prototype`, owner 2's AI on, the human idle), from
//    its first tick: 10 seconds of 60 Hz frames for the pace, and a window of
//    300 ticks for the match.
//  - The frames are synthetic. The pace case uses even 60 Hz frames. The match
//    case uses a cycle of mostly long frames (8 to 400 ms, bounded to 250), so
//    at every speed most ticks run inside a frame that runs several, which is
//    where a rule applied once a frame instead of once a tick shows. That the
//    browser's own frames reach the bridge this way is
//    `tests/browser/game-speed.spec.ts` and the live check in plan 149.
//  - "The same match" is the whole save (every world slot and the commands
//    waiting between ticks), compared at EVERY tick a frame lands on, not only
//    the last: a command submitted a few ticks late can leave the match equal
//    again later (a Villager queued at a busy Town Center starts when it would
//    have), and the last-tick comparison this case first made missed exactly
//    that (plan 149). Proved red by draining the computer's queued commands
//    once a frame instead of once a tick in `bridge.step`.
//  - The computer queues few commands this early: in the first 300 ticks the
//    drain submits them before ticks 1, 31 and 271 (plan 149), so a defect
//    that only touches later or rarer commands is outside this window.

import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { GAME_SPEED_LADDER, GAME_SPEEDS } from '../../src/game/simulation/matchOptions';
import { frameSimulationDelta } from '../../src/game/visibleSimulationTiming';

const FRAME_60_HZ_MS = 1000 / 60;
const UNEVEN_FRAMES_MS = [250, 16.7, 400, 33.3, 250, 8.3, 100, 250, 66.7, 250];
const WINDOW_TICKS = 300;

type Bridge = ReturnType<typeof createSimulationBridge>;
const tickOf = (bridge: Bridge): number => bridge.getHudState().tick;
const matchOf = (bridge: Bridge): string => createHash('sha256').update(JSON.stringify(bridge.saveGame())).digest('hex');

describe('a match at each of DE\'s speeds', () => {
  it('advances its multiplier of ticks per real second', () => {
    const paced: Record<string, number> = {};
    for (const id of GAME_SPEED_LADDER) {
      const bridge = createSimulationBridge();
      for (let frame = 0; frame < 600; frame += 1) {
        bridge.step(frameSimulationDelta(FRAME_60_HZ_MS, GAME_SPEEDS[id].multiplier));
      }
      paced[id] = tickOf(bridge);
    }
    // 10 seconds at 10 ticks a second times the speed, give or take the tick
    // the accumulator still holds.
    for (const id of GAME_SPEED_LADDER) {
      expect(Math.abs(paced[id]! - 100 * GAME_SPEEDS[id].multiplier), `${id}: ${paced[id]} ticks`).toBeLessThanOrEqual(1);
    }
    expect(paced).toMatchObject({ slow: 100, casual: 150, normal: 170, fast: 200 });
  }, 60_000);

  it('is the same match, tick for tick, as one stepped a tick at a time', () => {
    // The reference: one tick per step, its save at every tick of the window.
    const reference = createSimulationBridge();
    const referenceAt = new Map<number, string>();
    while (tickOf(reference) < WINDOW_TICKS + 8) {
      reference.step(100);
      referenceAt.set(tickOf(reference), matchOf(reference));
    }
    for (const id of GAME_SPEED_LADDER) {
      const bridge = createSimulationBridge();
      let frame = 0;
      let bunchedTicks = 0;
      const differing: number[] = [];
      while (tickOf(bridge) < WINDOW_TICKS) {
        const before = tickOf(bridge);
        bridge.step(frameSimulationDelta(UNEVEN_FRAMES_MS[frame % UNEVEN_FRAMES_MS.length]!, GAME_SPEEDS[id].multiplier));
        const landed = tickOf(bridge);
        if (landed - before > 1) bunchedTicks += landed - before;
        if (landed > before && matchOf(bridge) !== referenceAt.get(landed)) differing.push(landed);
        frame += 1;
      }
      // Instrument check: most ticks really ran inside frames that ran several.
      expect(bunchedTicks, `${id}: only ${bunchedTicks} of ${tickOf(bridge)} ticks ran in a frame of several`).toBeGreaterThan(tickOf(bridge) / 2);
      expect(differing, `${id} (${GAME_SPEEDS[id].multiplier}x) differs from the tick-by-tick match at these ticks`).toEqual([]);
    }
  }, 120_000);
});
