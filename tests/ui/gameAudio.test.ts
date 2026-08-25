// Procedural audio cues (spec north-star "distinct alert, economy, combat,
// and age-up audio cues", first slice v0.3.109): a horn when your town takes
// a hit, a fanfare when you age up, a sting when the match ends — all
// synthesized, all observing projections, never touching the simulation.

import { describe, expect, it, beforeEach } from 'vitest';

import { createGameAudioController } from '../../src/audio/gameAudioController';
import type { GameAudioCue } from '../../src/audio/gameAudioController';

function mapStorage(map: Map<string, string>) {
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

interface Deps {
  attacks: { tick: number; targetX: number; targetY: number }[];
  own: { x: number; y: number; owner: number; kind: string; entityType: string }[];
  age: string;
  outcome: string | null;
  tick: number;
}

function makeController(state: Deps) {
  const played: GameAudioCue[] = [];
  const controller = createGameAudioController({
    humanPlayerId: 1,
    getTick: () => state.tick,
    getCurrentAge: () => state.age,
    getMatchOutcome: () => state.outcome,
    getRecentAttacks: () => state.attacks,
    getOwnTownEntities: () => state.own,
    playCue: (cue) => played.push(cue),
    storage: mapStorage(new Map<string, string>()),
  });
  return { controller, played, state };
}

const HOME = { x: 10, y: 10, owner: 1, kind: 'building', entityType: 'town-center' };

describe('the attack horn', () => {
  let harness: ReturnType<typeof makeController>;
  beforeEach(() => {
    harness = makeController({ attacks: [], own: [HOME], age: 'dark-age', outcome: null, tick: 0 });
  });

  it('sounds when an attack lands on your town, once per throttle window', () => {
    harness.state.attacks = [{ tick: 1, targetX: 10, targetY: 10 }];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack']);

    // A second hit inside the throttle window stays silent.
    harness.state.attacks = [{ tick: 30, targetX: 10, targetY: 10 }];
    harness.state.tick = 30;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack']);

    // Past the window it sounds again.
    harness.state.attacks = [{ tick: 500, targetX: 10, targetY: 10 }];
    harness.state.tick = 500;
    harness.controller.poll();
    expect(harness.played).toEqual(['town-under-attack', 'town-under-attack']);
  });

  it('ignores attacks that hit nothing of yours', () => {
    harness.state.attacks = [{ tick: 1, targetX: 30, targetY: 30 }];
    harness.state.tick = 1;
    harness.controller.poll();
    expect(harness.played).toEqual([]);
  });
});

describe('the age-up fanfare and the match stings', () => {
  it('sounds once per age transition, never for the starting age', () => {
    const harness = makeController({ attacks: [], own: [], age: 'dark-age', outcome: null, tick: 0 });
    harness.controller.poll();
    expect(harness.played).toEqual([]);
    harness.state.age = 'feudal-age';
    harness.controller.poll();
    harness.controller.poll();
    expect(harness.played).toEqual(['age-up']);
  });

  it('plays victory or defeat exactly once', () => {
    const harness = makeController({ attacks: [], own: [], age: 'dark-age', outcome: null, tick: 0 });
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
    const state: Deps = { attacks: [], own: [HOME], age: 'dark-age', outcome: null, tick: 0 };
    const controller = createGameAudioController({
      humanPlayerId: 1,
      getTick: () => state.tick,
      getCurrentAge: () => state.age,
      getMatchOutcome: () => state.outcome,
      getRecentAttacks: () => state.attacks,
      getOwnTownEntities: () => state.own,
      playCue: (cue) => played.push(cue),
      storage: mapStorage(storage),
    });
    controller.setMuted(true);
    state.attacks = [{ tick: 1, targetX: 10, targetY: 10 }];
    state.tick = 1;
    controller.poll();
    expect(played).toEqual([]);
    expect(storage.get('aoe2.audio.muted')).toBe('1');
    // Mute silences the speaker, not the state machine: unmuting does not
    // replay the missed horn, but a fresh attack past the throttle sounds.
    controller.setMuted(false);
    controller.poll();
    expect(played).toEqual([]);
    state.attacks = [{ tick: 900, targetX: 10, targetY: 10 }];
    state.tick = 900;
    controller.poll();
    expect(played).toEqual(['town-under-attack']);
  });
});
