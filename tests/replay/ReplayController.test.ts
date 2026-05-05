import { describe, expect, it, vi } from 'vitest';
import { SessionReplayer } from 'civ-engine';

import {
  createReplayController,
  type ReplayFrameScheduler,
} from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import {
  findOwnedUnit,
  recordCommandReplayFixture,
} from './replayCommandHelpers';

function createFrameScheduler(): ReplayFrameScheduler & {
  flushNext(timestamp?: number): void;
} {
  const callbacks: FrameRequestCallback[] = [];
  let nextHandle = 1;
  return {
    request(callback) {
      callbacks.push(callback);
      return nextHandle++;
    },
    cancel(handle) {
      void handle;
    },
    flushNext(timestamp = 0) {
      const callback = callbacks.shift();
      if (!callback) {
        throw new Error('Expected a queued replay frame.');
      }
      callback(timestamp);
    },
  };
}

function stubBridge(world: GameWorld): SimulationBridge {
  return {
    world,
    step: vi.fn(),
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => []),
    select: vi.fn(),
  } as unknown as SimulationBridge;
}

describe('Phase 3B - ReplayController', () => {
  it('enters and exits replay mode by pausing live simulation and replacing the bridge cell', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const replace = vi.fn((next: SimulationBridge) => {
      currentBridge = next;
    });
    const modeChanges: string[] = [];
    const tickChanges: number[] = [];
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace,
      },
      makeReplayBridge: stubBridge,
    });

    controller.onModeChange((mode) => modeChanges.push(mode));
    controller.onTickChange((tick) => tickChanges.push(tick));
    const liveTick = liveBridge.world.tick;
    controller.enterReplay(bundle, bundle.metadata.startTick);
    liveBridge.step(1000);

    expect(controller.mode).toBe('replay');
    expect(controller.currentTick).toBe(bundle.metadata.startTick);
    expect(liveBridge.world.tick).toBe(liveTick);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(currentBridge).not.toBe(liveBridge);
    expect(currentBridge.world.tick).toBe(bundle.metadata.startTick);
    expect(modeChanges).toEqual(['replay']);
    expect(tickChanges).toEqual([bundle.metadata.startTick]);

    controller.exitReplay();
    liveBridge.step(1000);

    expect(controller.mode).toBe('live');
    expect(liveBridge.world.tick).toBeGreaterThan(liveTick);
    expect(controller.currentTick).toBe(liveBridge.world.tick);
    expect(currentBridge).toBe(liveBridge);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(modeChanges).toEqual(['replay', 'live']);
  });

  it('coalesces drag scrubs until a non-coalesced scrub commits the replay world', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const makeReplayBridgeSpy = vi.fn(stubBridge);
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: makeReplayBridgeSpy,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const enteredBridge = currentBridge;

    controller.scrubTo(bundle.metadata.endTick, { coalesce: true });

    expect(controller.currentTick).toBe(bundle.metadata.endTick);
    expect(currentBridge).toBe(enteredBridge);
    expect(makeReplayBridgeSpy).toHaveBeenCalledTimes(1);

    controller.scrubTo(bundle.metadata.endTick);

    expect(currentBridge).not.toBe(enteredBridge);
    expect(currentBridge.world.tick).toBe(bundle.metadata.endTick);
    expect(makeReplayBridgeSpy).toHaveBeenCalledTimes(2);
  });

  it('does not leave the live bridge paused when replay entry construction fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const liveTick = liveBridge.world.tick;
    const controller = createReplayController({
      bridgeCell: {
        current: () => liveBridge,
        replace: () => {},
      },
      makeReplayBridge: () => {
        throw new Error('replay bridge failed');
      },
    });

    expect(() => controller.enterReplay(bundle)).toThrow('replay bridge failed');
    liveBridge.step(1000);

    expect(controller.mode).toBe('live');
    expect(liveBridge.world.tick).toBeGreaterThan(liveTick);
  });

  it('plays forward by submitting recorded commands before stepping the replay world', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const scheduler = createFrameScheduler();
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: stubBridge,
      scheduler,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.play();
    scheduler.flushNext();
    const expectedWorld = SessionReplayer.fromBundle(
      bundle,
      { worldFactory: createReplayWorldOnly },
    ).openAt(bundle.metadata.startTick + 1);

    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);
    expect(currentBridge.world.serialize()).toEqual(expectedWorld.serialize());

    controller.pause();
    expect(controller.isPlaying()).toBe(false);
  });

  it('paces playback by simulation tick duration rather than display frame count', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const scheduler = createFrameScheduler();
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: stubBridge,
      scheduler,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.play();
    scheduler.flushNext(0);
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);

    scheduler.flushNext(50);
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);

    scheduler.flushNext(100);
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 2);
  });

  it('stops playback before recorded failed ticks', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const scheduler = createFrameScheduler();
    const failedBundle = {
      ...bundle,
      metadata: {
        ...bundle.metadata,
        failedTicks: [bundle.metadata.startTick + 2],
      },
    };
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: stubBridge,
      scheduler,
    });

    controller.enterReplay(failedBundle, failedBundle.metadata.startTick);
    controller.play();
    scheduler.flushNext(0);

    expect(controller.currentTick).toBe(failedBundle.metadata.startTick + 1);
    expect(controller.isPlaying()).toBe(false);
  });

  it('refuses to play forward when a bundle has no recorded command payloads', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const noPayloadBundle = {
      ...bundle,
      commands: [],
      executions: [],
      metadata: {
        ...bundle.metadata,
        endTick: bundle.metadata.startTick + 1,
        persistedEndTick: bundle.metadata.startTick + 1,
        durationTicks: 1,
      },
    };
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(noPayloadBundle, noPayloadBundle.metadata.startTick);

    expect(() => controller.play()).toThrow(/no command payloads/);
    expect(currentBridge.world.tick).toBe(noPayloadBundle.metadata.startTick);
  });

  it('keeps controller methods safe to pass as callbacks', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const { stepForward, stepBackward, scrubTo } = controller;

    stepForward();
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);
    stepBackward();
    expect(controller.currentTick).toBe(bundle.metadata.startTick);
    scrubTo(bundle.metadata.startTick + 1);
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);
  });

  it('preserves still-live replay selection across committed scrubs', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const villager = findOwnedUnit(currentBridge, 1, 'villager');
    const ref = currentBridge.world.getEntityRef(villager.id);
    expect(ref).not.toBeNull();
    currentBridge.select([ref!]);

    controller.scrubTo(bundle.metadata.endTick);

    expect(currentBridge.getSelectedEntityRefs()).toEqual([ref]);
  });

  it('creates a renderable replay bridge that scene frames cannot advance', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const controller = createReplayController({
      bridgeCell: {
        current: () => liveBridge,
        replace: () => {},
      },
    });
    controller.enterReplay(bundle, bundle.metadata.startTick);
    const bridge = makeReplayBridge(controller.world!, {
      getRenderInterpolationAlpha: () => 0.42,
    });
    const tick = bridge.world.tick;

    bridge.step(1000);

    expect(bridge.world.tick).toBe(tick);
    expect(bridge.getHudState().tick).toBe(tick);
    expect(bridge.getHudState().seed).toBe('ai-rush-fixture');
    expect(bridge.getRenderState().tick).toBe(tick);
    expect(bridge.getRenderInterpolationAlpha()).toBe(0.42);
  });
});
