// A player whose town is under attack cannot miss it (v0.3.229).
//
// GATES the defect register entry of 2026-09-24: the minimap mark lived 8 s of
// WALL CLOCK while the throttle that re-raises it counts 200 SIMULATION ticks,
// so at normal speed a sustained raid showed a dark minimap about 40% of the
// time, a paused game lost the mark after 8 s, and no alert said anything in
// words. These cases drive the real decision point (`gameAudioController`)
// and read the real mark (`getAttackWarning`) against a clock that is the
// game's own: ticks advance at TPS x the named speed per wall second while
// running, and not at all while paused. The wall clock is the one the module
// itself reads — `performance.now` is replaced with the simulated clock — so
// a mark that expired on the wall clock would be caught here, not hidden by a
// clock the test passed in beside the one the code uses.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - The feed is synthetic: one swing every 20 ticks on one cell, twice a
//    Militia's 10-tick reload, so the gaps between blows are wider than a
//    real raid's. That the decision reaches pixels and words on the real
//    match is `tests/browser/attack-warning.spec.ts` and
//    `tests/browser/attack-warning-sustained.spec.ts`.
//  - The frame clock is an even 60 frames a second. A real host's frames are
//    uneven; the mark reads only the tick, so that cannot change the verdict,
//    but it is not what is simulated here.
//  - Every case names its speed. The sustained raid runs at all three of the
//    §4.5 presets (the old dark share was 60% at slow, 40% at normal and 20%
//    at fast); the rest run at `normal` (1.5x), the speed the play session
//    that met the defect used.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGameAudioController, type GameAudioCue } from '../../src/audio/gameAudioController';
import { GAME_SPEEDS } from '../../src/game/simulation/matchOptions';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import {
  ATTACK_WARNING_HOLD_TICKS,
  ATTACK_WARNING_TEXT,
  ATTACK_WARNING_THROTTLE_TICKS,
  clearAttackWarning,
  getAttackWarning,
} from '../../src/ui/hud/attackWarning';

const FRAME_MS = 1000 / 60;
const SWING_EVERY_TICKS = 20;
/** The old mark's whole life on the wall clock. */
const OLD_FLASH_MS = 8_000;

interface Swing {
  tick: number;
  targetX: number;
  targetY: number;
  participants: { attackerOwner: number; targetOwner: number; targetIsEconomy: boolean };
}

function swingAt(tick: number): Swing {
  return {
    tick, targetX: 14, targetY: 9,
    participants: { attackerOwner: 2, targetOwner: 1, targetIsEconomy: true },
  };
}

// A running match: `frame()` advances the wall clock one frame and the tick
// by the named speed's share of it (unless paused), keeps the attack feed's
// last ten ticks the way the bridge does, polls the controller the way the
// audio mount's rAF loop does, and reads the mark the way the minimap does —
// at the frame's tick, on the module's own wall clock.
function runMatch(speed: keyof typeof GAME_SPEEDS) {
  const ticksPerMs = (TPS * GAME_SPEEDS[speed]) / 1000;
  const state = {
    wallMs: 1_000, simMs: 0, tick: 0, paused: false, raidUntil: -1,
    /** Single blows outside the periodic raid. */
    hitAt: new Set<number>(),
    feed: [] as Swing[],
  };
  vi.spyOn(performance, 'now').mockImplementation(() => state.wallMs);
  const played: GameAudioCue[] = [];
  const said: string[] = [];
  const controller = createGameAudioController({
    humanPlayerId: 1,
    getCurrentAge: () => 'dark-age',
    getMatchOutcome: () => null,
    getRecentAttacks: () => state.feed,
    getResearchedCount: () => 0,
    getCountdownActive: () => false,
    getTownBellRings: () => 0,
    getOrderAcks: () => 0,
    getPrimarySelection: () => null,
    playCue: (cue) => played.push(cue),
    announce: (text) => said.push(text),
    storage: { getItem: () => null, setItem: () => {} },
  });
  function frame(frameMs = FRAME_MS) {
    state.wallMs += frameMs;
    if (!state.paused) {
      state.simMs += frameMs;
      const next = Math.floor(state.simMs * ticksPerMs);
      for (let tick = state.tick + 1; tick <= next; tick += 1) {
        const periodic = tick <= state.raidUntil && tick % SWING_EVERY_TICKS === 0;
        if (periodic || state.hitAt.has(tick)) state.feed.push(swingAt(tick));
      }
      state.tick = next;
      state.feed = state.feed.filter((swing) => state.tick - swing.tick < 10);
    }
    controller.poll();
    return getAttackWarning(state.tick);
  }
  /** Frames until `tick` is reached; a bounded loop, so a stalled clock fails rather than hangs. */
  function runTo(tick: number) {
    for (let i = 0; i < 1_000_000 && state.tick < tick; i += 1) frame();
    expect(state.tick, 'the simulated clock stalled').toBeGreaterThanOrEqual(tick);
  }
  /** What the audio mount does when a load swaps the bridge: a new world at
   *  `tick`, with an empty attack feed, and the controller told so. */
  function loadSaveAt(tick: number) {
    state.tick = tick;
    state.simMs = tick / ticksPerMs;
    state.feed = [];
    controller.resetForNewWorld();
  }
  return { state, played, said, frame, runTo, loadSaveAt, controller };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the words', () => {
  beforeEach(() => clearAttackWarning());

  it('say "You are under attack!" on the decision that sounds the horn, once per window', () => {
    const match = runMatch('normal');
    match.state.raidUntil = 1_000;
    match.runTo(1_000);
    expect(ATTACK_WARNING_TEXT).toBe('You are under attack!');
    // 1,000 ticks of hits every 20 ticks from tick 20: horns at 20, 220, 420,
    // 620 and 820 — and the words exactly beside each one.
    expect(match.played.filter((cue) => cue === 'town-under-attack')).toHaveLength(5);
    expect(match.said).toEqual(Array(5).fill('You are under attack!'));
  });

  it('are shown when the sound is muted', () => {
    const match = runMatch('normal');
    match.controller.setMuted(true);
    match.state.raidUntil = 100;
    match.runTo(100);
    expect(match.played).toEqual([]);
    expect(match.said).toEqual(['You are under attack!']);
  });
});

describe('the mark during a raid', () => {
  beforeEach(() => clearAttackWarning());

  for (const speed of ['slow', 'normal', 'fast'] as const) {
    it(`never goes dark while a raid keeps hitting, at ${speed} speed (${GAME_SPEEDS[speed]}x)`, () => {
      const match = runMatch(speed);
      match.state.raidUntil = 3 * ATTACK_WARNING_THROTTLE_TICKS;
      match.runTo(SWING_EVERY_TICKS);
      const startMs = match.state.wallMs;
      const dark: number[] = [];
      while (match.state.tick < match.state.raidUntil) {
        if (match.frame() === null) dark.push(match.state.tick);
      }
      // Instrument check: the raid outlasted the old flash on the wall clock
      // AND a whole throttle window after it, so a mark bound to either would
      // have been caught dark here.
      const throttleMs = (ATTACK_WARNING_THROTTLE_TICKS / (TPS * GAME_SPEEDS[speed])) * 1000;
      expect(match.state.wallMs - startMs).toBeGreaterThan(OLD_FLASH_MS + throttleMs);
      expect(dark, `ticks with a raid in progress and a dark minimap: ${dark.slice(0, 5).join(', ')}`).toEqual([]);
    });
  }

  it('stays up for the whole pause, however long, and for no extra tick after', () => {
    const match = runMatch('normal');
    match.state.raidUntil = 60;
    match.runTo(60);
    match.state.paused = true;
    const pausedAt = match.state.tick;
    // Ten minutes of paused frames: the wall clock runs, the tick does not.
    for (let i = 0; i < 36_000; i += 1) {
      expect(match.frame(), `paused frame ${i}`).not.toBeNull();
    }
    expect(match.state.tick).toBe(pausedAt);
    match.state.paused = false;
    // Resumed, it holds exactly one window from the last hit, at tick 60.
    while (match.state.tick < 60 + ATTACK_WARNING_HOLD_TICKS - 1) expect(match.frame()).not.toBeNull();
    match.runTo(60 + ATTACK_WARNING_HOLD_TICKS);
    expect(match.frame()).toBeNull();
  });

  // The independent review of v0.3.229: the throttle was measured from the
  // tick of the POLL that sounded the horn, the hold from the tick of the HIT.
  // A frame that steps several ticks (a slow host, a fast speed) puts the two
  // apart, and a blow landing in the gap lit the mark again with no horn. Here
  // one frame steps ten ticks over the first blow (hit at 20, seen at 25), the
  // mark goes dark at 220, and the next blow lands at 222.
  it('sounds again for the first blow after the mark went dark, however far a frame stepped', () => {
    const match = runMatch('slow');
    match.state.hitAt = new Set([20, 222]);
    match.runTo(15);
    match.frame(1_000);
    expect(match.state.tick, 'the long frame did not step past the first blow').toBe(25);
    expect(match.said).toHaveLength(1);
    let darkFrames = 0;
    while (match.state.tick < 221) if (match.frame() === null) darkFrames += 1;
    expect(darkFrames, 'the mark never went dark before the second blow').toBeGreaterThan(0);
    match.runTo(222);
    expect(match.said, 'the mark went dark and the next blow came with no words').toHaveLength(2);
    expect(match.played).toEqual(['town-under-attack', 'town-under-attack']);
  });

  it('goes dark only when the next hit is sure to sound the horn and say so again', () => {
    const match = runMatch('normal');
    match.state.raidUntil = 40;
    match.runTo(40 + ATTACK_WARNING_HOLD_TICKS + 5);
    expect(getAttackWarning(match.state.tick)).toBeNull();
    const horns = match.played.length;
    const words = match.said.length;
    match.state.raidUntil = 1_000;
    let lit = null;
    for (let i = 0; i < 10_000 && lit === null; i += 1) lit = match.frame();
    expect(lit, 'the raid resumed and the mark never came back').not.toBeNull();
    expect(match.played.length).toBe(horns + 1);
    expect(match.said.length).toBe(words + 1);
  });
});

// v0.3.229: loading an EARLIER save kept the old world's horn tick, so the
// first raid after the load fell inside a "throttle window" measured across
// two worlds and came with no horn and no words, and hits no later than the
// last one seen before the load were dropped outright. Measured in the real
// game by saving at tick 100, taking the tick-1444 raid, and loading.
describe('after a load', () => {
  beforeEach(() => clearAttackWarning());

  it('warns about the first raid in the loaded world, however recent the last horn was', () => {
    const match = runMatch('normal');
    match.state.raidUntil = 400;
    match.runTo(400);
    const words = match.said.length;
    expect(getAttackWarning(match.state.tick)).not.toBeNull();
    match.loadSaveAt(100);
    // The old world's mark does not survive into the new one.
    expect(getAttackWarning(match.state.tick)).toBeNull();
    expect(match.controller.getLastHomeAttackPosition()).toBeNull();
    // The loaded world is raided at tick 120: horn, words and mark at once.
    match.state.raidUntil = 1_000;
    match.runTo(121);
    expect(match.said.length, 'the first raid after the load came with no words').toBe(words + 1);
    expect(match.played.at(-1)).toBe('town-under-attack');
    expect(getAttackWarning(match.state.tick), 'the first raid after the load left the minimap dark').not.toBeNull();
  });
});
