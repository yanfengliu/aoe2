import { SessionReplayer, type SessionBundle } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { createRecordingService } from '../../src/game/recording/RecordingService';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
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
  });
});
