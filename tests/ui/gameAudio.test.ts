// Procedural audio cues (spec north-star "distinct alert, economy, combat,
// and age-up audio cues", first slice v0.3.109): a horn when your town takes
// a hit, a fanfare when you age up, a sting when the match ends — all
// synthesized, all observing projections, never touching the simulation.

import { describe, expect, it, beforeEach } from 'vitest';

import { createGameAudioController } from '../../src/audio/gameAudioController';
import type { GameAudioCue } from '../../src/audio/gameAudioController';
import { clearAttackWarning, getAttackWarning } from '../../src/ui/hud/attackWarning';

function mapStorage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

// v0.3.217: the feed carries WHO was hit, so the horn no longer guesses from
// proximity. `hit` is an enemy unit swinging at something of the human's
// economy — the reproduced defect's shape; `graze` is the same swing landing
// on one of the human's SOLDIERS, which must stay silent.
function hit(tick: number, targetX: number, targetY: number) {
  return {
    tick, targetX, targetY,
    participants: { attackerOwner: 2, targetOwner: 1, targetIsEconomy: true },
  };
}
function graze(tick: number, targetX: number, targetY: number) {
  return {
    tick, targetX, targetY,
    participants: { attackerOwner: 2, targetOwner: 1, targetIsEconomy: false },
  };
}

interface Deps {
  attacks: {
    tick: number;
    targetX: number;
    targetY: number;
    participants?: { attackerOwner: number; targetOwner: number; targetIsEconomy: boolean };
  }[];
  age: string;
  outcome: string | null;
  tick: number;
  researched: number;
  countdownActive: boolean;
  bellRings: number;
  orderAcks: number;
  selection: { id: number; role: string } | null;
}

function makeController(state: Deps) {
  const played: GameAudioCue[] = [];
  const controller = createGameAudioController({
    humanPlayerId: 1,
    getTick: () => state.tick,
    getCurrentAge: () => state.age,
    getMatchOutcome: () => state.outcome,
    getRecentAttacks: () => state.attacks,
    getResearchedCount: () => state.researched,
    getCountdownActive: () => state.countdownActive,
    getTownBellRings: () => state.bellRings,
    getOrderAcks: () => state.orderAcks,
    getPrimarySelection: () => state.selection,
    playCue: (cue) => played.push(cue),
    storage: mapStorage(new Map<string, string>()),
  });
  return { controller, played, state };
}

describe('the attack horn', () => {
  let harness: ReturnType<typeof makeController>;
  beforeEach(() => {
    harness = makeController({ attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
  });

  it('sounds when an attack lands on your town, once per throttle window', () => {
    harness.state.attacks = [hit(1, 10, 10)];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack']);

    // A second hit inside the throttle window stays silent.
    harness.state.attacks = [hit(30, 10, 10)];
    harness.state.tick = 30;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack']);

    // Past the window it sounds again.
    harness.state.attacks = [hit(500, 10, 10)];
    harness.state.tick = 500;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack', 'town-under-attack']);
  });

  it('ignores attacks that hit nothing of yours', () => {
    harness.state.attacks = [
      // Your army trading blows: the target is a soldier, not the economy.
      graze(1, 30, 30),
      // A boar biting back carries no participants at all.
      { tick: 1, targetX: 31, targetY: 31 },
      // Somebody else's villager, and your own unit doing the hitting.
      { tick: 1, targetX: 32, targetY: 32, participants: { attackerOwner: 1, targetOwner: 2, targetIsEconomy: true } },
    ];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.played).toEqual([]);
  });

  it('does not storm: a raid landing every tick sounds once per window', () => {
    // The case the throttle exists for. Twelve hits over 120 ticks — one horn,
    // because a warning that fires on every blow is worse than none.
    for (let tick = 1; tick <= 120; tick += 10) {
      harness.state.attacks = [hit(tick, 10, 10), hit(tick, 11, 11)];
      harness.state.tick = tick;
      harness.controller.poll();
    }
    expect(harness.played).toEqual(['town-under-attack']);
    harness.state.attacks = [hit(500, 10, 10)];
    harness.state.tick = 500;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack', 'town-under-attack']);
  });

  it("remembers WHERE the last home hit landed, for Space's camera jump (v0.3.156)", () => {
    expect(harness.controller.getLastHomeAttackPosition()).toBeNull();
    harness.state.attacks = [hit(1, 10, 10)];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.controller.getLastHomeAttackPosition()).toEqual({ x: 10, y: 10 });
    // A fight elsewhere that is not on your economy does not move the marker.
    harness.state.attacks = [graze(600, 30, 30)];
    harness.state.tick = 600;
    harness.controller.poll();
    expect(harness.controller.getLastHomeAttackPosition()).toEqual({ x: 10, y: 10 });
  });

  it('marks the minimap even when the sound is muted', () => {
    // The reported defect is a player who was told NOTHING. A warning that
    // only exists as a horn is lost by a muted tab or a moment of noise, so
    // the mark is raised outside `playCue`.
    clearAttackWarning();
    harness.controller.setMuted(true);
    harness.state.attacks = [hit(1, 6.25, 8.75)];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    expect(getAttackWarning()).toMatchObject({ x: 6.25, y: 8.75 });
  });
});

describe('the age-up fanfare and the match stings', () => {
  it('sounds once per age transition, never for the starting age', () => {
    const harness = makeController({ attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    harness.state.age = 'feudal-age';
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['age-up']);
  });

  it('plays victory or defeat exactly once', () => {
    const harness = makeController({ attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
    harness.state.outcome = 'victory';
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['victory']);
  });
});

describe('the mute switch', () => {
  it('silences every cue and persists the choice', () => {
    const storage = new Map<string, string>();
    const played: GameAudioCue[] = [];
    const state: Deps = { attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null };
    const controller = createGameAudioController({
      humanPlayerId: 1,
      getTick: () => state.tick,
      getCurrentAge: () => state.age,
      getMatchOutcome: () => state.outcome,
      getRecentAttacks: () => state.attacks,
      getResearchedCount: () => state.researched,
      getCountdownActive: () => state.countdownActive,
      getTownBellRings: () => state.bellRings,
      getOrderAcks: () => state.orderAcks,
      getPrimarySelection: () => state.selection,
      playCue: (cue) => played.push(cue),
      storage: mapStorage(storage),
    });
    controller.setMuted(true);
    state.attacks = [hit(1, 10, 10)];
    state.tick = 1;
    controller.poll();
    expect(played).toEqual([]);
    expect(storage.get('aoe2.audio.muted')).toBe('1');
    // Mute silences the speaker, not the state machine: unmuting does not
    // replay the missed horn, but a fresh attack past the throttle sounds.
    controller.setMuted(false);
    controller.poll();
    expect(played).toEqual([]);
    state.attacks = [hit(900, 10, 10)];
    state.tick = 900;
    controller.poll();
    expect(played).toEqual(['town-under-attack']);
  });
});

describe('the research chime and the countdown bell', () => {
  it('dings once per completed research, never for pre-seeded techs', () => {
    const harness = makeController({ attacks: [], age: 'castle-age', outcome: null, tick: 0, researched: 12, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    harness.state.researched = 13;
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['research-complete']);
    harness.state.researched = 15;
    harness.controller.poll();
    expect(harness.played).toEqual(['research-complete', 'research-complete']);
  });

  it('rings when a wonder or relic countdown begins, once per activation', () => {
    const harness = makeController({ attacks: [], age: 'imperial-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
    harness.controller.poll();
    harness.state.countdownActive = true;
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['countdown-started']);
    harness.state.countdownActive = false;
    harness.controller.poll();
    harness.state.countdownActive = true;
    harness.controller.poll();
    expect(harness.played).toEqual(['countdown-started', 'countdown-started']);
  });
});

describe('the town bell peal', () => {
  it('rings once per successful ring, never on boot', () => {
    const harness = makeController({ attacks: [], age: 'feudal-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 2, orderAcks: 0, selection: null });
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    harness.state.bellRings = 3;
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['town-bell']);
  });
});

describe('the order ack', () => {
  it('clicks once per gesture batch, never on boot', () => {
    const harness = makeController({ attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 5, selection: null });
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    harness.state.orderAcks = 8;
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['order-ack']);
  });
});

describe('selection chirps', () => {
  it('chirps the role once per NEW selection, silent on reselect and on clear', () => {
    const harness = makeController({ attacks: [], age: 'dark-age', outcome: null, tick: 0, researched: 0, countdownActive: false, bellRings: 0, orderAcks: 0, selection: null });
    harness.controller.poll();
    harness.state.selection = { id: 5, role: 'villager' };
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['select-villager']);
    harness.state.selection = { id: 9, role: 'cavalry' };
    harness.controller.poll();
    expect(harness.played).toEqual(['select-villager', 'select-military']);
    harness.state.selection = null;
    harness.controller.poll();
    harness.state.selection = { id: 9, role: 'monk' };
    harness.controller.poll();
    expect(harness.played).toEqual(['select-villager', 'select-military', 'select-monk']);
  });
});

describe('the birdsong scheduler', () => {
  it('spaces chirps 6-14 seconds apart, reproducibly', async () => {
    const { nextBirdTimeMs } = await import('../../src/audio/proceduralAmbience');
    let at = 0;
    for (let i = 0; i < 20; i += 1) {
      const next = nextBirdTimeMs(at);
      expect(next - at).toBeGreaterThanOrEqual(6000);
      expect(next - at).toBeLessThanOrEqual(14000);
      expect(nextBirdTimeMs(at)).toBe(next);
      at = next;
    }
  });
});
