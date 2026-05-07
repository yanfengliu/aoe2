import { describe, expect, it, vi } from 'vitest';

import { createReplayController } from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { recordCommandReplayFixture } from './replayCommandHelpers';

function stubBridge(world: GameWorld): SimulationBridge {
  return {
    world,
    step: vi.fn(),
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => []),
    select: vi.fn(),
  } as unknown as SimulationBridge;
}

function trackPauseState(bridge: SimulationBridge): { isPaused(): boolean } {
  let paused = false;
  const setPaused = bridge.setPaused.bind(bridge);
  bridge.setPaused = vi.fn((next: boolean) => {
    paused = next;
    setPaused(next);
  });
  return { isPaused: () => paused };
}

describe('Phase 3B - ReplayController rollback', () => {
  it('keeps replay state recoverable when exit bridge replacement fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    let failReplace = false;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          if (failReplace) throw new Error('live bridge restore failed');
          currentBridge = next;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const replayBridge = currentBridge;
    const replayWorld = controller.world;
    const replayTick = controller.currentTick;
    failReplace = true;

    expect(() => controller.exitReplay()).toThrow('live bridge restore failed');

    expect(controller.mode).toBe('replay');
    expect(controller.world).toBe(replayWorld);
    expect(controller.currentTick).toBe(replayTick);
    expect(currentBridge).toBe(replayBridge);

    failReplace = false;
    controller.exitReplay();

    expect(controller.mode).toBe('live');
    expect(currentBridge).toBe(liveBridge);
  });

  it('keeps the committed replay state when scrub bridge replacement fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    let failScrubReplace = false;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          if (failScrubReplace) throw new Error('scrub bridge swap failed');
          currentBridge = next;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const replayBridge = currentBridge;
    const replayWorld = controller.world;
    const replayTick = controller.currentTick;
    failScrubReplace = true;

    expect(() => controller.scrubTo(bundle.metadata.endTick)).toThrow('scrub bridge swap failed');

    expect(controller.mode).toBe('replay');
    expect(controller.world).toBe(replayWorld);
    expect(controller.currentTick).toBe(replayTick);
    expect(currentBridge).toBe(replayBridge);

    failScrubReplace = false;
    controller.scrubTo(bundle.metadata.endTick);

    expect(controller.currentTick).toBe(bundle.metadata.endTick);
    expect(currentBridge).not.toBe(replayBridge);
  });

  it('rolls back displayed tick when coalesced scrub commit replacement fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    let failScrubReplace = false;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          if (failScrubReplace) throw new Error('coalesced scrub swap failed');
          currentBridge = next;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
    });

    controller.enterReplay(bundle, bundle.metadata.startTick);
    const replayBridge = currentBridge;
    const replayWorld = controller.world;
    const replayTick = controller.currentTick;
    controller.scrubTo(bundle.metadata.endTick, { coalesce: true });
    expect(controller.currentTick).toBe(bundle.metadata.endTick);
    failScrubReplace = true;

    expect(() => controller.commitPendingScrub()).toThrow('coalesced scrub swap failed');

    expect(controller.mode).toBe('replay');
    expect(controller.world).toBe(replayWorld);
    expect(controller.currentTick).toBe(replayTick);
    expect(currentBridge).toBe(replayBridge);
  });

  it('restores an unpaused live bridge when replay bridge replacement fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const pauseState = trackPauseState(liveBridge);
    const liveTick = liveBridge.world.tick;
    const controller = createReplayController({
      bridgeCell: {
        current: () => liveBridge,
        replace: () => {
          throw new Error('replay bridge swap failed');
        },
      },
      isLivePaused: pauseState.isPaused,
      makeReplayBridge: stubBridge,
    });

    expect(() => controller.enterReplay(bundle)).toThrow('replay bridge swap failed');
    liveBridge.step(1000);

    expect(controller.mode).toBe('live');
    expect(pauseState.isPaused()).toBe(false);
    expect(liveBridge.world.tick).toBeGreaterThan(liveTick);
  });

  it('restores a pre-existing live pause state when replay bridge replacement fails', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    const pauseState = trackPauseState(liveBridge);
    liveBridge.setPaused(true);
    const liveTick = liveBridge.world.tick;
    const controller = createReplayController({
      bridgeCell: {
        current: () => liveBridge,
        replace: () => {
          throw new Error('replay bridge swap failed');
        },
      },
      isLivePaused: pauseState.isPaused,
      makeReplayBridge: stubBridge,
    });

    expect(() => controller.enterReplay(bundle)).toThrow('replay bridge swap failed');
    liveBridge.step(1000);

    expect(controller.mode).toBe('live');
    expect(pauseState.isPaused()).toBe(true);
    expect(liveBridge.world.tick).toBe(liveTick);
  });

  // Slice 4 (replay-load-and-e2e v0.1.11): when the user is already in
  // replay mode and `enterReplay` is called with a bundle that
  // SessionReplayer rejects (e.g., missing `metadata.engineVersion`),
  // the controller must NOT exitReplay before construction. Otherwise
  // an unrelated import attempt with a malformed file would silently
  // drop the user out of their current replay session — a partial
  // apply. This regression locks the transactional-construction
  // guarantee.
  it('preserves an existing replay session when enterReplay throws on a bad bundle', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => { currentBridge = next; },
      },
      isLivePaused: () => false,
      makeReplayBridge: stubBridge,
      // Make replayer construction fail on demand to simulate the
      // engine rejecting a malformed bundle (e.g., missing
      // metadata.engineVersion).
      worldFactory: ((snapshot: unknown) => {
        if ((snapshot as { __failConstruction?: boolean }).__failConstruction) {
          throw new Error('SessionReplayer rejected bundle');
        }
        return liveBridge.world;
      }) as never,
    });

    // First enter replay legitimately so the controller is in 'replay'.
    controller.enterReplay(bundle);
    expect(controller.mode).toBe('replay');
    const beforeTick = controller.currentTick;
    const replayBridge = currentBridge;

    // Now attempt a second enterReplay with a bundle that fails
    // construction. The original replay session must survive intact.
    const badBundle = {
      ...bundle,
      initialSnapshot: {
        ...bundle.initialSnapshot,
        __failConstruction: true,
      } as unknown as typeof bundle.initialSnapshot,
    };
    expect(() => controller.enterReplay(badBundle)).toThrow('SessionReplayer rejected bundle');

    expect(controller.mode).toBe('replay');
    expect(controller.currentTick).toBe(beforeTick);
    expect(currentBridge).toBe(replayBridge);
  });
});
