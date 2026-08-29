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
import { getReplayWorldContext } from '../../src/game/simulation/replay/replayWorldContext';
import {
  combatStatesCodec,
  TIER_3_SLOTS,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';
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

  it('does not resurrect a persisted fog-suppressed cue in a fresh replay bridge', () => {
    const live = createSimulationBridge('boar-hunt-fixture');
    const villager = live
      .getRenderState()
      .entities.find(
        (entity) =>
          entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager',
      );
    expect(villager?.generation).toBeDefined();
    const snapshot = structuredClone(live.world.serialize());
    const state = (snapshot as { state?: Record<string, unknown> }).state;
    expect(state).toBeDefined();
    state![TIER_3_SLOTS.replayUnitAttacks] = [
      {
        attackerId: villager!.id,
        attackerGeneration: villager!.generation,
        tick: snapshot.tick,
        sourceX: villager!.x,
        sourceY: villager!.y,
        targetX: villager!.x + 1,
        targetY: villager!.y,
        witnessedBy: [1],
        suppressedFor: [1],
      },
    ];

    const replayWorld = createReplayWorldOnly(snapshot);
    const replay = makeReplayBridge(replayWorld);
    try {
      expect(
        replay.getRenderState().entities.find((entity) => entity.id === villager!.id)
          ?.attackAnimation,
      ).toBeUndefined();
    } finally {
      replay.disposeReplayRenderAdapter();
    }
  });

  it('persists suppression when tower fire removes the final local witness source', () => {
    const base = createSimulationBridge('castle-garrison-fixture');
    const attacker = base
      .getEconomyState()
      .units.find(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'villager'
          && unit.x === 20
          && unit.y === 10,
      );
    expect(attacker).toBeDefined();

    const seeded = createReplayWorldOnly(structuredClone(base.world.serialize()));
    const victim = seeded.runMaintenance(() => {
      const id = seeded.createEntity();
      // Spec §10.4 made Castle arrows fly. The witness sits close to the
      // Castle at (14, 6) so the shot lands in a few ticks — well inside the
      // 10-tick attack-feed window this test asserts on — and carries a wider
      // vision radius so it still covers the attack's source and target cells.
      // It stands two cells OUT from the Castle's 4x4 footprint (14,6)-(17,9):
      // defensive buildings gained a minimum range, so a witness inside or
      // against the footprint is under the arrow slits and never gets shot at
      // all, which is the event this test is about.
      seeded.setPosition(id, { x: 19, y: 7 });
      seeded.addComponent(id, 'unit', { owner: 2, unitType: 'spearman' });
      seeded.addComponent(id, 'unitTransform', {
        fineX: 78,
        fineY: 28,
        occupancySlotX: 0.5,
        occupancySlotY: 0,
      });
      seeded.addComponent(id, 'renderable', {
        kind: 'unit',
        layer: 'unit',
        tint: 0x123456,
        size: 0.45,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
      });
      seeded.addComponent(id, 'visionSource', { playerId: 2, radius: 6 });
      return id;
    });
    const combatStates = structuredClone(
      seeded.getState(combatStatesCodec.slot) ?? [],
    ) as Array<[number, CombatState]>;
    combatStates.push([
      victim,
      {
        currentHp: 1,
        maxHp: 45,
        armor: 0,
        attackDamage: 3,
        attackRange: 1,
        reloadTicks: 10,
        cooldownTicks: 0,
        pierceArmorBonus: 0,
      },
    ]);
    seeded.setState(
      combatStatesCodec.slot,
      combatStates as unknown as Parameters<typeof seeded.setState>[1],
    );
    const attackerRef = seeded.getEntityRef(attacker!.id);
    expect(attackerRef).not.toBeNull();
    seeded.setState(
      TIER_3_SLOTS.replayUnitAttacks,
      [{
        attackerId: attacker!.id,
        attackerGeneration: attackerRef!.generation,
        tick: seeded.tick,
        sourceX: attacker!.x,
        sourceY: attacker!.y,
        targetX: 20,
        targetY: 8,
        witnessedBy: [2],
      }] as unknown as Parameters<typeof seeded.setState>[1],
    );

    const hiddenTickWorld = createReplayWorldOnly(seeded.serialize());
    expect(
      getReplayWorldContext(hiddenTickWorld)?.visibility.isVisible(2, 20, 10),
    ).toBe(true);
    // Spec §10.4: the tower launches an arrow and the kill lands a few ticks
    // later, still well inside the 10-tick attack-feed window this asserts on.
    let victimGone = false;
    for (let step = 0; step < 30 && !victimGone; step += 1) {
      hiddenTickWorld.step();
      victimGone = hiddenTickWorld.getEntityRef(victim) === null;
    }
    expect(victimGone).toBe(true);
    expect(
      getReplayWorldContext(hiddenTickWorld)?.visibility.isVisible(2, 20, 10),
    ).toBe(false);
    expect(hiddenTickWorld.getState(TIER_3_SLOTS.replayUnitAttacks)).toEqual([
      expect.objectContaining({ suppressedFor: [2] }),
    ]);

    const revealedTickWorld = createReplayWorldOnly(hiddenTickWorld.serialize());
    revealedTickWorld.runMaintenance(() => {
      const revealer = revealedTickWorld.createEntity();
      revealedTickWorld.setPosition(revealer, { x: 20, y: 10 });
      revealedTickWorld.addComponent(revealer, 'visionSource', {
        playerId: 2,
        radius: 1,
      });
    });
    revealedTickWorld.step();
    const scrubbedWorld = createReplayWorldOnly(revealedTickWorld.serialize());
    const replay = makeReplayBridge(scrubbedWorld, { fogOwner: 2 });
    try {
      const projectedAttacker = replay
        .getRenderState()
        .entities.find((entity) => entity.id === attacker!.id);
      expect(projectedAttacker).toBeDefined();
      expect(projectedAttacker?.attackAnimation).toBeUndefined();
    } finally {
      replay.disposeReplayRenderAdapter();
    }
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
      const restored = renderState.entities.filter(
        (entity) => entity.attackAnimation?.tick === attackTick,
      );
      // Every attacker the live run recorded at that tick restores — and
      // since v0.2.8 wildlife retaliation shares this feed, so the boar's
      // own strike is legitimately part of the set (spec §14.5).
      expect(restored).toHaveLength(expectedAttacks.length);
      expect(restored.filter((entity) => entity.kind === 'unit')).toHaveLength(2);
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
    // §12.4.2 clock: the cancel publishes on the attacker's first MOVING tick
    // (a villager banks 32 hundredths a tick — tick +4, not +1).
    let cancellationTick: number | undefined;
    for (let step = 0; step < 8 && cancellationTick === undefined; step += 1) {
      live.step(100);
      cancellationTick = live.getRenderState().entities
        .find((entity) => entity.id === attackerId)?.attackAnimation?.cancelTick;
    }
    expect(cancellationTick).toBe(live.getRenderState().tick);
    if (cancellationTick === undefined) throw new Error('no cancellation tick found');
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
