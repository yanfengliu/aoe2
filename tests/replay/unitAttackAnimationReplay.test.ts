import { SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createRecordingService } from '../../src/game/recording/RecordingService';
import {
  createSimulationBridge,
  type SimulationBridge,
} from '../../src/game/simulation/createSimulationBridge';
import {
  createReplayController,
  type ReplayFrameScheduler,
} from '../../src/game/replay/ReplayController';
import { createReplayWorldOnly } from '../../src/game/simulation/replay/createReplayWorldOnly';
import { makeReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameEvents,
} from '../../src/game/simulation/bridge/pureHelpers';

describe('unit attack animation replay snapshots', () => {
  it('preserves the absent attack-feed slot in legacy replay snapshots', () => {
    const live = createSimulationBridge('boar-hunt-fixture');
    const legacySnapshot = structuredClone(live.world.serialize());
    const state = (legacySnapshot as { state?: Record<string, unknown> }).state;
    expect(state).toBeDefined();
    delete state![TIER_3_SLOTS.replayUnitAttacks];

    const replayWorld = createReplayWorldOnly(legacySnapshot);
    expect(replayWorld.getState(TIER_3_SLOTS.replayUnitAttacks)).toBeUndefined();

    replayWorld.step();
    expect(replayWorld.getState(TIER_3_SLOTS.replayUnitAttacks)).toBeUndefined();
  });

  it('restores a hit when openAt starts exactly on its snapshot tick', async () => {
    const live = createSimulationBridge('boar-hunt-fixture');
    const recording = createRecordingService({
      world: live.world,
      inMemoryOnly: true,
      snapshotInterval: 1,
    });
    await recording.start();

    const boar = live
      .getRenderState()
      .entities.find((entity) => entity.entityType === 'boar');
    expect(boar).toBeDefined();
    expect(live.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(live.issueContextCommandAtEntity(boar!.id)).toBe(true);

    let attackTick: number | null = null;
    for (let step = 0; step < 100 && attackTick === null; step += 1) {
      live.step(100);
      const renderState = live.getRenderState();
      if (renderState.entities.some((entity) => entity.attackAnimation?.tick === renderState.tick)) {
        attackTick = renderState.tick;
      }
    }

    expect(attackTick, 'villagers never landed a recorded hit').not.toBeNull();
    const expectedAttacks = live.getRenderState().entities
      .filter((entity) => entity.attackAnimation?.tick === attackTick)
      .map((entity) => ({ id: entity.id, attack: entity.attackAnimation }));
    for (let tick = 0; tick < 7; tick += 1) live.step(100);
    const bundle = recording.bundle() as SessionBundle<
      GameEvents,
      GameCommands
    > | null;
    expect(bundle).not.toBeNull();
    expect(bundle!.snapshots.some((snapshot) => snapshot.tick === attackTick)).toBe(true);
    await recording.stop();

    const replayWorld = SessionReplayer.fromBundle(bundle!, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    }).openAt(attackTick!);
    const replay = makeReplayBridge(replayWorld);
    try {
      const renderState = replay.getRenderState();
      expect(
        renderState.entities.filter(
          (entity) => entity.attackAnimation?.tick === attackTick,
        ),
      ).toHaveLength(2);
    } finally {
      replay.disposeReplayRenderAdapter();
    }

    const retainedWorld = SessionReplayer.fromBundle(bundle!, {
      worldFactory: (snapshot) => createReplayWorldOnly(snapshot),
      skipRegistrationCheck: true,
    }).openAt(attackTick! + 7);
    const retainedReplay = makeReplayBridge(retainedWorld);
    try {
      for (const expected of expectedAttacks) {
        expect(
          retainedReplay.getRenderState().entities.find((entity) => entity.id === expected.id)
            ?.attackAnimation,
        ).toEqual(expected.attack);
      }
    } finally {
      retainedReplay.disposeReplayRenderAdapter();
    }
  });

  it('plays through a persisted movement-cancellation handoff before pruning it', async () => {
    const live = createSimulationBridge('boar-hunt-fixture');
    const recording = createRecordingService({
      world: live.world,
      inMemoryOnly: true,
      snapshotInterval: 1,
    });
    await recording.start();
    const boar = live.getRenderState().entities.find((entity) => entity.entityType === 'boar')!;
    live.selectUnitsInBox(12, 7, 14, 9);
    live.issueContextCommandAtEntity(boar.id);
    let attackerId: number | null = null;
    for (let step = 0; step < 100 && attackerId === null; step += 1) {
      live.step(100);
      const state = live.getRenderState();
      attackerId = state.entities.find((entity) => (
        entity.owner === 1 && entity.attackAnimation?.tick === state.tick
      ))?.id ?? null;
    }
    expect(attackerId).not.toBeNull();
    live.clearSelection();
    live.selectEntityById(attackerId!);
    live.issueMoveCommand(0, 0);
    live.step(100);
    const cancellationTick = live.getRenderState().tick;
    expect(
      live.getRenderState().entities.find((entity) => entity.id === attackerId)
        ?.attackAnimation?.cancelTick,
    ).toBe(cancellationTick);
    live.step(100);
    const bundle = recording.bundle() as SessionBundle<
      GameEvents,
      GameCommands
    > | null;
    expect(bundle).not.toBeNull();
    await recording.stop();

    const callbacks: FrameRequestCallback[] = [];
    const scheduler: ReplayFrameScheduler = {
      request(callback) {
        callbacks.push(callback);
        return callbacks.length;
      },
      cancel() {},
    };
    let currentBridge: SimulationBridge = live;
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
    const frame = (timestamp: number): void => callbacks.shift()!(timestamp);

    controller.enterReplay(bundle!, cancellationTick);
    controller.play();
    frame(0);
    expect(controller.currentTick).toBe(cancellationTick);
    expect(currentBridge.getRenderInterpolationAlpha()).toBe(0);
    frame(50);
    expect(controller.currentTick).toBe(cancellationTick);
    expect(currentBridge.getRenderInterpolationAlpha()).toBeCloseTo(0.5);
    frame(100);
    expect(controller.currentTick).toBe(cancellationTick + 1);
    expect(
      currentBridge.getRenderState().entities.find((entity) => entity.id === attackerId)
        ?.attackAnimation,
    ).toBeUndefined();
    controller.exitReplay();
  });
});
