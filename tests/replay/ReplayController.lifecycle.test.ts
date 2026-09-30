// Failed incoming adapters are released; the committed bridge remains usable.
import { describe, expect, it, vi } from 'vitest';
import type { Marker } from 'civ-engine';

import { createReplayController, type ReplayBridgeFactory } from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { recordCommandReplayFixture } from './replayCommandHelpers';

function replayBridge(world: GameWorld) {
  return {
    world,
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => [world.getEntityRef([...world.query('unit')][0]!)]),
    select: vi.fn(),
    getEconomyState: vi.fn(() => ({ playerResources: { 1: {}, 2: {} } })),
    disposeReplayRenderAdapter: vi.fn(),
  };
}

describe('ReplayController incoming adapter ownership', () => {
  it.each(['scrub', 'step-forward', 'step-back', 'marker'] as const)('notifies once after %s commits its paused state, and never after failed replacement', (operation) => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const recorded = { ...bundle, markers: [{
      id: 'seek', tick: 50, kind: 'annotation', provenance: 'game',
      createdAt: new Date(0).toISOString(), text: 'Seek here', data: {},
    } as Marker] };
    let current: SimulationBridge = liveBridge;
    let fail = false;
    let nextHandle = 1;
    const frames = new Map<number, FrameRequestCallback>();
    const scheduler = {
      request: vi.fn((callback: FrameRequestCallback) => {
        const handle = nextHandle++;
        frames.set(handle, callback);
        return handle;
      }),
      cancel: vi.fn((handle: number) => { frames.delete(handle); }),
    };
    const flush = (timestamp: number) => {
      const [handle, callback] = [...frames][0]!;
      frames.delete(handle);
      callback(timestamp);
    };
    const controller = createReplayController({
      bridgeCell: { current: () => current, replace: (incoming) => {
        if (fail) throw new Error('presentation failed');
        current = incoming;
      } },
      isLivePaused: () => false,
      scheduler,
    });
    controller.enterReplay(recorded, 10);
    controller.play();
    flush(0);
    flush(50);
    const committed = current;
    const committedFrame = [...frames.keys()];
    expect(committed.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    const onTick = vi.fn((tick: number) => ({
      tick, worldTick: controller.world!.tick, currentTick: controller.currentTick,
      playing: controller.isPlaying(), frames: frames.size,
      cancelled: scheduler.cancel.mock.calls.length, alpha: current.getRenderInterpolationAlpha(),
    }));
    const unsubscribe = controller.onTickChange(onTick);
    scheduler.cancel.mockClear();
    const target = operation === 'scrub' ? 20 : operation === 'step-forward' ? 11 : operation === 'step-back' ? 9 : 50;
    const seek = () => {
      if (operation === 'scrub') controller.scrubTo(target);
      else if (operation === 'step-forward') controller.stepForward();
      else if (operation === 'step-back') controller.stepBackward();
      else controller.jumpToMarker('seek');
    };
    try {
      fail = true;
      expect(seek).toThrow('presentation failed');
      expect(onTick).not.toHaveBeenCalled();
      expect(current).toBe(committed);
      expect(controller.currentTick).toBe(10);
      expect(controller.isPlaying()).toBe(true);
      expect(current.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
      expect([...frames.keys()]).toEqual(committedFrame);
      expect(scheduler.cancel).not.toHaveBeenCalled();
      fail = false;
      seek();
      expect(onTick).toHaveBeenCalledTimes(1);
      expect(onTick.mock.results[0]!.value).toEqual({
        tick: target, worldTick: target, currentTick: target,
        playing: false, frames: 0, cancelled: 1, alpha: 0,
      });
      controller.play();
      flush(1000);
      expect(controller.currentTick).toBe(target);
      flush(1050);
      expect(current.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    } finally {
      unsubscribe();
      fail = false;
      controller.exitReplay();
    }
  });

  it.each(['scrub', 'exit'] as const)('keeps active playback when a %s replacement fails, then pauses after successful retry', (operation) => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let current: SimulationBridge = liveBridge;
    let fail = false;
    const scheduler = { request: vi.fn(() => 1), cancel: vi.fn() };
    const controller = createReplayController({
      bridgeCell: {
        current: () => current,
        replace: (incoming) => {
          if (fail) throw new Error('presentation failed');
          current = incoming;
        },
      },
      isLivePaused: () => false,
      scheduler,
      makeReplayBridge: ((world: GameWorld) => replayBridge(world)) as unknown as ReplayBridgeFactory,
    });
    controller.enterReplay(bundle);
    controller.play();
    const committed = current;
    const tick = controller.currentTick;
    scheduler.cancel.mockClear();
    fail = true;
    const replace = () => operation === 'scrub' ? controller.scrubTo(bundle.metadata.endTick) : controller.exitReplay();
    expect(replace).toThrow('presentation failed');
    expect(controller.isPlaying()).toBe(true);
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(current).toBe(committed);
    expect(controller.currentTick).toBe(tick);
    fail = false;
    replace();
    expect(controller.isPlaying()).toBe(false);
    expect(scheduler.cancel).toHaveBeenCalledTimes(1);
    if (operation === 'scrub') controller.exitReplay();
    expect(current).toBe(liveBridge);
  });

  it.each([false, true])('retains an active replay after incoming replacement fails with saved live pause %s', (priorPaused) => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    liveBridge.setPaused(priorPaused);
    const setLivePaused = vi.spyOn(liveBridge, 'setPaused');
    const bridges: ReturnType<typeof replayBridge>[] = [];
    let current: SimulationBridge = liveBridge;
    let failIncoming = false;
    const scheduler = { request: vi.fn(() => 1), cancel: vi.fn() };
    const controller = createReplayController({
      bridgeCell: {
        current: () => current,
        replace: (incoming) => {
          if (failIncoming && incoming !== liveBridge) throw new Error('incoming replacement failed');
          current = incoming;
        },
      },
      isLivePaused: () => priorPaused,
      scheduler,
      makeReplayBridge: ((world: GameWorld) => {
        const incoming = replayBridge(world);
        bridges.push(incoming);
        return incoming;
      }) as unknown as ReplayBridgeFactory,
    });
    controller.enterReplay(bundle);
    controller.setFogOwner(2);
    controller.play();
    const committed = current;
    const committedWorld = controller.world;
    const committedTick = controller.currentTick;
    const committedAdapter = bridges.at(-1)!;
    const onMode = vi.fn();
    const onTick = vi.fn();
    controller.onModeChange(onMode);
    controller.onTickChange(onTick);
    scheduler.cancel.mockClear();
    setLivePaused.mockClear();
    failIncoming = true;
    expect(() => controller.enterReplay(bundle, bundle.metadata.endTick)).toThrow('incoming replacement failed');
    expect(current).toBe(committed);
    expect(controller.mode).toBe('replay');
    expect(controller.world).toBe(committedWorld);
    expect(controller.currentTick).toBe(committedTick);
    expect(controller.bundle).toBe(bundle);
    expect(controller.fogOwner).toBe(2);
    expect(controller.isPlaying()).toBe(true);
    expect(committedAdapter.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    expect(bridges.at(-1)!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(onMode).not.toHaveBeenCalled();
    expect(onTick).not.toHaveBeenCalled();
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(setLivePaused).not.toHaveBeenCalled();
    failIncoming = false;
    controller.enterReplay(bundle, bundle.metadata.endTick);
    expect(committedAdapter.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(controller.fogOwner).toBe(1);
    expect(controller.isPlaying()).toBe(false);
    expect(controller.currentTick).toBe(bundle.metadata.endTick);
    controller.exitReplay();
    expect(current).toBe(liveBridge);
    expect(setLivePaused).toHaveBeenLastCalledWith(priorPaused);
    expect(bridges.at(-1)!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
  });

  it.each(['selection', 'replacement'] as const)('disposes a failed scrub %s without disposing the committed bridge', (failure) => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const bridges: ReturnType<typeof replayBridge>[] = [];
    let current: SimulationBridge = liveBridge;
    let fail = false;
    const controller = createReplayController({
      bridgeCell: {
        current: () => current,
        replace: (incoming) => {
          if (fail && failure === 'replacement') throw new Error('replacement failed');
          current = incoming;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: ((world: GameWorld) => {
        const incoming = replayBridge(world);
        incoming.select.mockImplementation(() => {
          if (fail && failure === 'selection') throw new Error('selection failed');
        });
        bridges.push(incoming);
        return incoming;
      }) as unknown as ReplayBridgeFactory,
    });
    controller.enterReplay(bundle);
    const committed = current;
    const committedWorld = controller.world;
    const committedTick = controller.currentTick;
    expect(bridges[0]!.getSelectedEntityRefs()[0]).not.toBeNull();
    fail = true;
    expect(() => controller.scrubTo(bundle.metadata.endTick)).toThrow(`${failure} failed`);
    expect(bridges[1]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(bridges[0]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    expect(current).toBe(committed);
    expect(controller.world).toBe(committedWorld);
    expect(controller.currentTick).toBe(committedTick);
    fail = false;
    controller.scrubTo(bundle.metadata.endTick);
    expect(bridges[0]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(current).not.toBe(committed);
    expect(controller.currentTick).toBe(bundle.metadata.endTick);
    controller.exitReplay();
    expect(bridges[2]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(current).toBe(liveBridge);
  });

  it.each(['economy', 'replacement', 'replay replacement'] as const)('disposes a failed replay entry at %s while preserving the current owner', (failure) => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const bridges: ReturnType<typeof replayBridge>[] = [];
    let current: SimulationBridge = liveBridge;
    let fail = false;
    const controller = createReplayController({
      bridgeCell: {
        current: () => current,
        replace: (incoming) => {
          if (fail && (failure === 'replacement' || failure === 'replay replacement')) throw new Error(`${failure} failed`);
          current = incoming;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: ((world: GameWorld) => {
        const incoming = replayBridge(world);
        incoming.getEconomyState.mockImplementation(() => {
          if (fail && failure === 'economy') throw new Error('economy failed');
          return { playerResources: { 1: {}, 2: {} } };
        });
        bridges.push(incoming);
        return incoming;
      }) as unknown as ReplayBridgeFactory,
    });
    if (failure !== 'replacement') controller.enterReplay(bundle);
    const committed = current;
    const committedWorld = controller.world;
    const committedTick = controller.currentTick;
    fail = true;
    expect(() => controller.enterReplay(bundle)).toThrow(`${failure} failed`);
    expect(bridges.at(-1)!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    if (failure !== 'replacement') expect(bridges[0]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    expect(current).toBe(committed);
    expect(controller.world).toBe(committedWorld);
    expect(controller.currentTick).toBe(committedTick);
    expect(controller.mode).toBe(failure === 'replacement' ? 'live' : 'replay');
    fail = false;
    controller.exitReplay();
    expect(current).toBe(liveBridge);
  });
});
