// replay-fog-owner: controller-level fog perspective API. The toggle
// rebuilds ONLY the replay bridge over the same world (the pattern
// scrub commits already use), preserves mode/tick/selection, and
// resets to player 1 on every enterReplay.

import { describe, expect, it, vi } from 'vitest';

import {
  createReplayController,
  type ReplayBridgeFactory,
  type ReplayControllerConfig,
  type ReplayController,
} from '../../src/game/replay/ReplayController';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { GameWorld } from '../../src/game/simulation/bridge/pureHelpers';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { recordCommandReplayFixture } from './replayCommandHelpers';

function stubBridgeWithEconomy(world: GameWorld): SimulationBridge {
  return {
    world,
    step: vi.fn(),
    setPaused: vi.fn(),
    getSelectedEntityRefs: vi.fn(() => []),
    select: vi.fn(),
    getEconomyState: vi.fn(() => ({
      playerResources: {
        1: { wood: 0, food: 0, gold: 0, stone: 0 },
        2: { wood: 0, food: 0, gold: 0, stone: 0 },
      },
    })),
    // iter-1: outgoing replay bridges get their render adapter disposed.
    disposeReplayRenderAdapter: vi.fn(),
  } as unknown as SimulationBridge;
}

type StubBridge = SimulationBridge & {
  disposeReplayRenderAdapter: ReturnType<typeof vi.fn>;
  getEconomyState: ReturnType<typeof vi.fn>;
};

function setup(): {
  controller: ReplayController;
  factorySpy: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  bundle: ReturnType<typeof recordCommandReplayFixture>['bundle'];
} {
  const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
  let currentBridge: SimulationBridge = liveBridge;
  const replace = vi.fn((next: SimulationBridge) => {
    currentBridge = next;
  });
  const factorySpy = vi.fn(
    (world: GameWorld, options?: Parameters<ReplayBridgeFactory>[1]) => {
      void options;
      return stubBridgeWithEconomy(world);
    },
  );
  const config: ReplayControllerConfig = {
    bridgeCell: { current: () => currentBridge, replace },
    isLivePaused: () => false,
    makeReplayBridge: factorySpy as unknown as ReplayBridgeFactory,
  };
  return { controller: createReplayController(config), factorySpy, replace, bundle };
}

describe('ReplayController fog owner', () => {
  it('defaults to player 1 and lists candidates from the replay economy state', () => {
    const { controller, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    expect(controller.fogOwner).toBe(1);
    expect(controller.fogOwnerCandidates()).toEqual([1, 2]);
  });

  it('setFogOwner rebuilds the replay bridge in place with the new perspective', () => {
    const { controller, factorySpy, replace, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    const tickBefore = controller.currentTick;
    expect(factorySpy).toHaveBeenCalledTimes(1);
    expect(factorySpy.mock.calls[0]![1]).toMatchObject({ fogOwner: 1 });

    controller.setFogOwner(2);

    expect(controller.fogOwner).toBe(2);
    expect(factorySpy).toHaveBeenCalledTimes(2);
    expect(factorySpy.mock.calls[1]![1]).toMatchObject({ fogOwner: 2 });
    // bridge cell swapped (enterReplay + fog rebuild), world identical,
    // playback position untouched.
    expect(replace).toHaveBeenCalledTimes(2);
    expect(factorySpy.mock.calls[1]![0]).toBe(factorySpy.mock.calls[0]![0]);
    expect(controller.mode).toBe('replay');
    expect(controller.currentTick).toBe(tickBefore);
  });

  it('setFogOwner is a no-op for the current owner and throws for unknown owners', () => {
    const { controller, factorySpy, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);

    controller.setFogOwner(1);
    expect(factorySpy).toHaveBeenCalledTimes(1);

    expect(() => controller.setFogOwner(99)).toThrow(/not a player in this replay/);
    expect(controller.fogOwner).toBe(1);
  });

  it('cycleFogOwner wraps through the candidates', () => {
    const { controller, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.cycleFogOwner();
    expect(controller.fogOwner).toBe(2);
    controller.cycleFogOwner();
    expect(controller.fogOwner).toBe(1);
  });

  it('resets to player 1 on every enterReplay', () => {
    const { controller, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    controller.setFogOwner(2);
    controller.exitReplay();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    expect(controller.fogOwner).toBe(1);
  });

  it('throws outside replay mode', () => {
    const { controller } = setup();
    expect(() => controller.setFogOwner(2)).toThrow(/not in replay mode/);
    expect(controller.fogOwnerCandidates()).toEqual([]);
  });

  it('disposes the outgoing bridge render adapter on fog switch (iter-1 leak fix)', () => {
    const { controller, factorySpy, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    const firstBridge = factorySpy.mock.results[0]!.value as StubBridge;

    controller.setFogOwner(2);

    expect(firstBridge.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    const secondBridge = factorySpy.mock.results[1]!.value as StubBridge;
    expect(secondBridge.disposeReplayRenderAdapter).not.toHaveBeenCalled();

    controller.exitReplay();
    expect(secondBridge.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
  });

  it('keeps fogOwner consistent with the active bridge when the cell swap throws (iter-1)', () => {
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    let failNextReplace = false;
    const made: StubBridge[] = [];
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          if (failNextReplace) {
            failNextReplace = false;
            throw new Error('cell replace failed');
          }
          currentBridge = next;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: ((world: GameWorld) => {
        const bridge = stubBridgeWithEconomy(world) as StubBridge;
        made.push(bridge);
        return bridge;
      }) as unknown as ReplayBridgeFactory,
    });
    controller.enterReplay(bundle, bundle.metadata.startTick);

    failNextReplace = true;
    expect(() => controller.setFogOwner(2)).toThrow('cell replace failed');

    // The active bridge still renders P1, so fogOwner must still say 1 —
    // and a retry must not be swallowed by the same-owner no-op guard.
    expect(controller.fogOwner).toBe(1);
    // iter-2: the INCOMING bridge connected an adapter to the surviving
    // world before the swap threw — it must be disposed on the way out,
    // and the still-active session bridge must not be.
    expect(made[1]!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    expect(made[0]!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    controller.setFogOwner(2);
    expect(controller.fogOwner).toBe(2);
  });

  it('caches fog owner candidates per session instead of re-projecting the economy (iter-1)', () => {
    const { controller, factorySpy, bundle } = setup();
    controller.enterReplay(bundle, bundle.metadata.startTick);
    const bridge = factorySpy.mock.results[0]!.value as StubBridge;
    const callsAfterEnter = bridge.getEconomyState.mock.calls.length;

    controller.fogOwnerCandidates();
    controller.fogOwnerCandidates();
    controller.fogOwnerCandidates();

    expect(bridge.getEconomyState.mock.calls.length).toBe(callsAfterEnter);
  });

  it('keeps the existing session fog owner when enterReplay throws on a bad bundle', () => {
    // Mirrors the rollback suite's transactional-enterReplay contract:
    // a throwing bad bundle must leave the current session fully
    // intact, INCLUDING its chosen fog perspective.
    const { bridge: liveBridge, bundle } = recordCommandReplayFixture();
    let currentBridge: SimulationBridge = liveBridge;
    const controller = createReplayController({
      bridgeCell: {
        current: () => currentBridge,
        replace: (next) => {
          currentBridge = next;
        },
      },
      isLivePaused: () => false,
      makeReplayBridge: stubBridgeWithEconomy as unknown as ReplayBridgeFactory,
      // Legit path honors the engine-1.0.1 factory contract
      // (applySnapshot, no stepping) via the real replay factory.
      worldFactory: ((snapshot: unknown) => {
        if ((snapshot as { __failConstruction?: boolean }).__failConstruction) {
          throw new Error('SessionReplayer rejected bundle');
        }
        return createReplayWorldOnly(snapshot as Parameters<typeof createReplayWorldOnly>[0]);
      }) as never,
    });

    controller.enterReplay(bundle);
    controller.setFogOwner(2);

    const badBundle = {
      ...bundle,
      initialSnapshot: { ...bundle.initialSnapshot, __failConstruction: true },
    } as unknown as typeof bundle;
    expect(() => controller.enterReplay(badBundle)).toThrow('SessionReplayer rejected bundle');

    expect(controller.mode).toBe('replay');
    expect(controller.fogOwner).toBe(2);
  });
});
