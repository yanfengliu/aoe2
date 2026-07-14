import { describe, expect, it } from 'vitest';

import {
  createReplayController,
  type ReplayFrameScheduler,
} from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { recordCommandReplayFixture } from './replayCommandHelpers';

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
      if (!callback) throw new Error('Expected a queued replay frame.');
      callback(timestamp);
    },
  };
}

describe('ReplayController interpolation clock', () => {
  it('preserves the displayed sample while replay playback is paused and resumed', () => {
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
      isLivePaused: () => false,
      scheduler,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.pause();
    controller.play();
    scheduler.flushNext(0);
    expect(controller.currentTick).toBe(bundle.metadata.startTick + 1);
    scheduler.flushNext(50);
    const pausedTick = controller.currentTick;

    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    controller.pause();
    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    scheduler.flushNext(75);

    controller.play();
    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    scheduler.flushNext(1000);
    expect(controller.currentTick).toBe(pausedTick);
    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);

    scheduler.flushNext(1050);
    expect(controller.currentTick).toBe(pausedTick + 1);
    expect(currentBridge.getRenderInterpolationAlpha()).toBe(0);
  });

  it('bounds replay catch-up after a long animation-frame gap', () => {
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
      isLivePaused: () => false,
      scheduler,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.play();
    scheduler.flushNext(0);
    const tickBeforeGap = controller.currentTick;

    scheduler.flushNext(10_000);

    expect(controller.currentTick - tickBeforeGap).toBe(2);
    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    expect(controller.isPlaying()).toBe(true);
  });
});
