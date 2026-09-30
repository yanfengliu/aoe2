// @vitest-environment jsdom
// Every switch of world starts the attack warning afresh, and moving within a
// recording does not (defect register 2026-09-24).
//
// THE DEFECT: the audio controller only moves its last-seen attack tick
// forward, and the mount told it to forget the old world only on a load.
// Leaving the replay viewer put the live world back behind the same
// controller, still holding the replayed world's ticks, so every live blow up
// to the replay's last tick was ignored: no mark, no words, no horn, and
// Space still aimed at the replayed blow. Entering the viewer had the mirror
// fault: a replayed raid older than the live match's newest blow was silent.
//
// These cases drive the real mount (`mountGameAudio`) and the real
// controller, with frames run by hand in place of requestAnimationFrame, over
// fake worlds that hold only a tick and a hit feed. The mode source stands in
// for the ReplayController, which emits a mode change on entering and on
// leaving, and never on a step, a scrub, a marker jump or a fog-owner switch.
//
// Two other signals were weighed and each fails a case here. Resetting when
// the bridge object changes fails the step and the scrub back, which build
// new bridges. Resetting when the world's tick goes backwards fails the scrub
// back too, and the replay left at an earlier tick than the live match's,
// whose tick goes forward (docs/architecture/decisions.md).
//
// BOUNDS, so a green run is not read for more than it holds:
//  - The worlds are fakes, and a step is a new fake bridge with no mode
//    change. That the real replay viewer and the real menus reach this is
//    `tests/browser/attack-warning-replay-exit.spec.ts` (leaving) and
//    `tests/browser/attack-warning-replay.spec.ts` (40 real steps).
//  - The fakes answer both feeds, the swing feed (`getRecentUnitAttacks`)
//    and the hit feed the mount reads since v0.3.235 (`getRecentPlayerHits`),
//    so these cases hold whichever the mount reads.
//  - That the replay controller emits no mode change on a step, a scrub, a
//    marker jump or a fog-owner switch is `tests/replay/ReplayController.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mountGameAudio, WORLD_LOADED_EVENT, type MountedGameAudio } from '../../src/audio/mountGameAudio';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { ATTACK_WARNING_TEXT, clearAttackWarning, getAttackWarning } from '../../src/ui/hud/attackWarning';

type Mode = 'live' | 'replay';

interface Blow {
  tick: number;
  targetId: number;
  attackerId: number;
  targetX: number;
  targetY: number;
  participants: { attackerOwner: number; targetOwner: number; targetIsEconomy: boolean };
}

/** A blow by owner 2 on a villager or building of the human's. */
function blowAt(tick: number, x: number, y: number): Blow {
  return {
    tick, targetId: 7, attackerId: 9, targetX: x, targetY: y,
    participants: { attackerOwner: 2, targetOwner: 1, targetIsEconomy: true },
  };
}

/** A world that holds only what the mount reads: its tick, its hit feed, and
 *  quiet answers for every other cue. The tick is on both places a bridge
 *  offers one, so a reset keyed on either is caught by the cases below. */
function world(tick: number, feed: Blow[]): SimulationBridge {
  return {
    getHudState: () => ({ currentAge: 'dark', tick }),
    getMatchState: () => ({ outcome: null, wonderCountdownTicks: null, relicCountdownTicks: null }),
    getRecentUnitAttacks: () => feed,
    getRecentPlayerHits: () => feed,
    world: { tick, getState: () => [] },
    getTownBellRings: () => 0,
    getOrderAcks: () => 0,
    getSelectionState: () => ({ selectedEntityId: null, selectedKind: null, selectedEntityType: null }),
  } as unknown as SimulationBridge;
}

/** The replay controller's mode notifications, emitted by hand. */
function modeSource() {
  const listeners = new Set<(mode: Mode) => void>();
  return {
    onModeChange(listener: (mode: Mode) => void): () => void {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    emit(mode: Mode): void {
      for (const listener of listeners) listener(mode);
    },
    listeners: () => listeners.size,
  };
}

let frames: FrameRequestCallback[] = [];
/** One animation frame: the mount's loop polls the controller and re-queues. */
function frame(): void {
  const due = frames;
  frames = [];
  for (const callback of due) callback(0);
}

let mounted: MountedGameAudio | null = null;

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  window.localStorage.clear();
  clearAttackWarning();
});

afterEach(() => {
  mounted?.dispose();
  mounted = null;
  document.body.innerHTML = '';
  clearAttackWarning();
  vi.unstubAllGlobals();
});

function mount(first: SimulationBridge) {
  let current = first;
  const words: Array<{ text: string; hitTick: number }> = [];
  const replay = modeSource();
  const hudRoot = document.createElement('div');
  document.body.appendChild(hudRoot);
  mounted = mountGameAudio(() => current, hudRoot, (text, hitTick) => words.push({ text, hitTick }), replay);
  const audio = mounted;
  return {
    words,
    replay,
    hudRoot,
    audio,
    /** What the bridge cell does: the next frame reads this world. */
    show(next: SimulationBridge): void { current = next; },
  };
}

describe('leaving the replay viewer', () => {
  it('announces and marks the first live blow after a replay watched past the live tick', () => {
    const game = mount(world(95, [blowAt(90, 10, 10)]));
    frame();
    expect(game.words).toEqual([{ text: ATTACK_WARNING_TEXT, hitTick: 90 }]);

    // The viewer opens a recording and plays it on to a blow at tick 900.
    game.show(world(905, [blowAt(900, 30, 30)]));
    game.replay.emit('replay');
    frame();
    expect(game.audio.getLastHomeAttackPosition()).toEqual({ x: 30, y: 30 });

    // Back to the live match, paused at tick 150 with nothing in its feed.
    game.show(world(150, []));
    game.replay.emit('live');
    frame();
    expect(game.audio.getLastHomeAttackPosition(), "Space still aims at the replayed world's blow").toBeNull();

    // The live match's next blow, at tick 158.
    game.show(world(160, [blowAt(158, 12, 12)]));
    frame();
    expect(game.words.at(-1), 'the first live blow after the replay came with no words').toEqual({ text: ATTACK_WARNING_TEXT, hitTick: 158 });
    expect(getAttackWarning(160), 'the first live blow after the replay left no mark').toMatchObject({ x: 12, y: 12 });
    expect(game.audio.getLastHomeAttackPosition()).toEqual({ x: 12, y: 12 });
  });

  it("announces the first live blow after a replay left at an earlier tick, inside the throttle window of the replay's last blow", () => {
    // The live match at tick 1000; its last blow was long ago.
    const game = mount(world(105, [blowAt(100, 10, 10)]));
    frame();
    game.show(world(1000, []));
    frame();
    // The replay's last announced blow is at 950, 50 ticks before the live
    // match's tick. Leaving moves the tick FORWARD, from 955 to 1000.
    game.show(world(955, [blowAt(950, 30, 30)]));
    game.replay.emit('replay');
    frame();
    expect(game.words.map((word) => word.hitTick)).toEqual([100, 950]);
    game.show(world(1000, []));
    game.replay.emit('live');
    frame();
    game.show(world(1010, [blowAt(1010, 12, 12)]));
    frame();
    expect(game.words.at(-1), "the live blow at 1010 was throttled by the replay's blow at 950").toEqual({ text: ATTACK_WARNING_TEXT, hitTick: 1010 });
  });
});

describe('entering the replay viewer', () => {
  it("announces and marks a replayed raid older than the live match's newest blow", () => {
    const game = mount(world(405, [blowAt(400, 10, 10)]));
    frame();
    expect(game.words.map((word) => word.hitTick)).toEqual([400]);

    game.show(world(35, [blowAt(30, 30, 30)]));
    game.replay.emit('replay');
    frame();
    expect(game.words.at(-1), 'the replayed blow at tick 30 was taken as already seen').toEqual({ text: ATTACK_WARNING_TEXT, hitTick: 30 });
    expect(getAttackWarning(35)).toMatchObject({ x: 30, y: 30 });
  });
});

describe('moving within a recording', () => {
  it('keeps the memory across a step and a scrub back, which build new bridges and change no mode', () => {
    const game = mount(world(0, []));
    frame();
    game.show(world(30, [blowAt(30, 30, 30)]));
    game.replay.emit('replay');
    frame();
    expect(game.words.map((word) => word.hitTick)).toEqual([30]);

    // A step: a new bridge over the same recording, one tick on.
    game.show(world(31, [blowAt(30, 30, 30), blowAt(31, 30, 30)]));
    frame();
    // A scrub back: another new bridge, and the tick goes BACKWARDS, to
    // before the blow already announced.
    game.show(world(22, [blowAt(20, 30, 30)]));
    frame();
    expect(game.words.map((word) => word.hitTick), 'a step or a scrub back re-announced the replayed raid').toEqual([30]);
  });
});

describe('a load', () => {
  it('still starts the warning afresh', () => {
    const game = mount(world(905, [blowAt(900, 10, 10)]));
    frame();
    game.show(world(105, [blowAt(104, 12, 12)]));
    game.hudRoot.dispatchEvent(new Event(WORLD_LOADED_EVENT));
    frame();
    expect(game.words.map((word) => word.hitTick)).toEqual([900, 104]);
  });
});

describe('dispose', () => {
  it('stops listening for mode changes', () => {
    const game = mount(world(0, []));
    expect(game.replay.listeners()).toBe(1);
    game.audio.dispose();
    mounted = null;
    expect(game.replay.listeners()).toBe(0);
  });
});
