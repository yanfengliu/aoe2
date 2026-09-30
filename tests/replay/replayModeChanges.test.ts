// The replay controller announces a switch of world, and nothing else
// (defect register 2026-09-24, "Coming back from a replay").
//
// The audio mount resets the attack warning on every mode change (spec §14.5,
// the attack warning, point (4)), so this contract is what keeps moving within
// a recording from announcing the replayed raid again: a step, a scrub, a
// marker jump and a fog-owner switch each build a new bridge over the same
// recording and must emit no mode change. Entering and leaving emit one each,
// and only once the bridge cell holds the new world, because the reset reads
// that world's match outcome and countdown. Found missing by the independent
// review of the fix: a mode change added to `setFogOwner`, say to refresh a
// label, would have re-armed the warning on every fog switch with every other
// gate green.
//
// Replacing a recording commits directly to replay and announces it once;
// it never publishes a temporary live world (§15.3, v0.3.241). Failed
// replacement keeps the outgoing recording and emits no mode change.
// BOUNDS: within-recording moves use a stub bridge; replacement uses the
// real replay bridge/adapters over recorded fixtures. That the audio mount
// resets on these changes is `tests/ui/gameAudioMount.test.ts`, and that the
// real page does is `tests/browser/attack-warning-replay-exit.spec.ts`.

import type { Marker } from 'civ-engine';
import { describe, expect, it, vi } from 'vitest';

import { createReplayController, type ReplayBundle } from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { makeReplayBridge, type ReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import { recordCommandReplayFixture } from './replayCommandHelpers';

function stubBridge(world: GameWorld): SimulationBridge {
  return {
    world,
    step: vi.fn(),
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => []),
    select: vi.fn(),
    // enterReplay reads the fog-owner candidates from the economy.
    getEconomyState: vi.fn(() => ({ playerResources: { 1: {}, 2: {} } })),
  } as unknown as SimulationBridge;
}

function setUp() {
  const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
  const marker: Marker = { id: 'raid', tick: bundle.metadata.startTick + 5, kind: 'annotation', provenance: 'game' };
  const recording = { ...bundle, markers: [...bundle.markers, marker] };
  let current: SimulationBridge = liveBridge;
  const controller = createReplayController({
    bridgeCell: { current: () => current, replace: (next) => { current = next; } },
    isLivePaused: () => false,
    makeReplayBridge: stubBridge,
  });
  const heard: Array<{ mode: string; cellHoldsLive: boolean }> = [];
  controller.onModeChange((mode) => heard.push({ mode, cellHoldsLive: current === liveBridge }));
  return { controller, recording, heard, current: () => current };
}

function setUpReplacement(priorPaused = false) {
  const { bridge: liveBridge, bundle: recording } = recordCommandReplayFixture();
  liveBridge.setPaused(priorPaused);
  const livePause = vi.spyOn(liveBridge, 'setPaused');
  let current: SimulationBridge = liveBridge;
  let reject = false;
  const adapters: ReplayBridge[] = [];
  const scheduler = { request: vi.fn(() => 1), cancel: vi.fn() };
  const replace = vi.fn((next: SimulationBridge) => {
    if (reject) throw new Error('incoming presentation rejected');
    current = next;
  });
  const controller = createReplayController({
    bridgeCell: { current: () => current, replace },
    isLivePaused: () => priorPaused,
    scheduler,
    makeReplayBridge(world, options) {
      const bridge = makeReplayBridge(world, options);
      vi.spyOn(bridge, 'disposeReplayRenderAdapter');
      adapters.push(bridge);
      return bridge;
    },
  });
  const notifications: Array<{
    mode: string; bridge: SimulationBridge; world: GameWorld | null; recording: ReplayBundle | null;
  }> = [];
  controller.onModeChange((mode) => notifications.push({
    mode, bridge: current, world: controller.world, recording: controller.bundle,
  }));
  const secondRecording = { ...recording, metadata: {
    ...recording.metadata, sessionId: `${recording.metadata.sessionId}-second`,
  } };
  return { controller, recording, secondRecording, liveBridge, livePause, replace, adapters,
    notifications, scheduler, current: () => current, reject: (value: boolean) => { reject = value; },
    dispose() {
      reject = false;
      controller.exitReplay();
      for (const bridge of adapters) {
        if (!vi.mocked(bridge.disposeReplayRenderAdapter).mock.calls.length) bridge.disposeReplayRenderAdapter();
      }
    },
  };
}

describe('the replay controller mode changes', () => {
  it('announce entering and leaving, each with the new world in the bridge cell, and nothing in between', () => {
    const { controller, recording, heard, current } = setUp();
    controller.enterReplay(recording, recording.metadata.startTick);
    expect(heard).toEqual([{ mode: 'replay', cellHoldsLive: false }]);

    const bridges = new Set([current()]);
    const moves: Array<[string, () => void]> = [
      ['step forward', () => controller.stepForward()],
      ['step forward', () => controller.stepForward()],
      ['step back', () => controller.stepBackward()],
      ['scrub', () => controller.scrubTo(recording.metadata.endTick)],
      ['drag scrub', () => {
        controller.scrubTo(recording.metadata.startTick + 2, { coalesce: true });
        controller.commitPendingScrub();
      }],
      ['marker jump', () => controller.jumpToMarker('raid')],
      ['fog-owner switch', () => controller.setFogOwner(2)],
      ['fog-owner cycle', () => controller.cycleFogOwner()],
    ];
    for (const [name, move] of moves) {
      move();
      // Instrument check: every move built a new bridge, which is what a
      // reset keyed on the bridge's identity would have fired on.
      expect(bridges.has(current()), `the ${name} built no new bridge`).toBe(false);
      bridges.add(current());
      expect(heard, `the ${name} announced a mode change`).toHaveLength(1);
    }

    controller.exitReplay();
    expect(heard).toEqual([
      { mode: 'replay', cellHoldsLive: false },
      { mode: 'live', cellHoldsLive: true },
    ]);
  });

  it.each([false, true])('announces only the committed new recording, then restores the real live pause state %s', (priorPaused) => {
    const h = setUpReplacement(priorPaused);
    try {
      h.controller.enterReplay(h.recording, h.recording.metadata.startTick);
      const first = h.current();
      const firstWorld = h.controller.world;
      expect(h.notifications).toHaveLength(1);
      expect(h.notifications).toEqual([{ mode: 'replay', bridge: first, world: firstWorld, recording: h.recording }]);
      expect(first).toBe(h.adapters[0]);
      expect(h.replace).toHaveBeenCalledTimes(1);
      expect(h.livePause).toHaveBeenCalledTimes(1);
      expect(h.livePause).toHaveBeenLastCalledWith(true);
      const targetTick = h.secondRecording.metadata.startTick + 3;
      h.controller.enterReplay(h.secondRecording, targetTick);
      const second = h.current();
      expect(second).toBe(h.adapters[1]);
      expect(second).not.toBe(first);
      expect(second.world).not.toBe(firstWorld);
      expect(second.world.tick).toBe(targetTick);
      expect(h.notifications).toHaveLength(2);
      expect(h.notifications).toEqual([
        { mode: 'replay', bridge: first, world: firstWorld, recording: h.recording },
        { mode: 'replay', bridge: second, world: second.world, recording: h.secondRecording },
      ]);
      expect(h.replace.mock.calls.map(([bridge]) => bridge)).toEqual([first, second]);
      expect(h.livePause).toHaveBeenCalledTimes(1);
      expect(h.adapters[0]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      expect(h.adapters[1]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
      h.controller.exitReplay();
      expect(h.replace.mock.calls.map(([bridge]) => bridge)).toEqual([first, second, h.liveBridge]);
      expect(h.notifications.at(-1)).toEqual({ mode: 'live', bridge: h.liveBridge, world: null, recording: null });
      expect(h.notifications).toHaveLength(3);
      expect(h.current()).toBe(h.liveBridge);
      expect(h.livePause.mock.calls).toEqual([[true], [priorPaused]]);
      expect(h.adapters[0]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      expect(h.adapters[1]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      const liveTick = h.liveBridge.world.tick;
      h.liveBridge.step(100);
      expect(h.liveBridge.world.tick).toBe(liveTick + (priorPaused ? 0 : 1));
    } finally {
      h.dispose();
    }
  });

  it('publishes nothing on failed second-recording replacement and retains the outgoing owner until retry commits', () => {
    const h = setUpReplacement();
    try {
      h.controller.enterReplay(h.recording, h.recording.metadata.startTick);
      h.controller.play();
      const first = h.current();
      const world = h.controller.world;
      const tick = h.controller.currentTick;
      const onTick = vi.fn();
      h.controller.onTickChange(onTick);
      h.reject(true);
      expect(() => h.controller.enterReplay(h.secondRecording, h.secondRecording.metadata.startTick + 3)).toThrow('incoming presentation rejected');
      expect(h.notifications).toHaveLength(1);
      expect(h.notifications).toEqual([{ mode: 'replay', bridge: first, world, recording: h.recording }]);
      expect(h.current()).toBe(first);
      expect(h.controller.world).toBe(world);
      expect(h.controller.bundle).toBe(h.recording);
      expect(h.controller.currentTick).toBe(tick);
      expect(h.controller.isPlaying()).toBe(true);
      expect(h.scheduler.cancel).not.toHaveBeenCalled();
      expect(onTick).not.toHaveBeenCalled();
      expect(h.livePause.mock.calls).toEqual([[true]]);
      expect(h.replace.mock.calls.map(([bridge]) => bridge)).not.toContain(h.liveBridge);
      expect(h.adapters[0]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
      expect(h.adapters[1]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      expect(() => first.getRenderState()).not.toThrow();
      h.reject(false);
      h.controller.enterReplay(h.secondRecording, h.secondRecording.metadata.startTick + 3);
      expect(h.notifications).toHaveLength(2);
      expect(h.notifications[1]).toEqual({ mode: 'replay', bridge: h.current(), world: h.current().world, recording: h.secondRecording });
      expect(h.adapters[0]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      expect(h.adapters[1]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
      expect(h.adapters[2]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    } finally {
      h.dispose();
    }
  });
});
