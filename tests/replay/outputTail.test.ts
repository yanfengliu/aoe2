import { describe, expect, it } from 'vitest';
import { World, VisibilityMap } from 'civ-engine';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  combatStatesCodec,
  TIER_3_SLOTS,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { VisibilityCell } from '../../src/game/simulation/bridge/visibilityCell';
import { registerOutputTail } from '../../src/game/simulation/bridge/registerOutputTail';
import { createBridgeState } from '../../src/game/simulation/bridge/bridgeState';
import {
  flushReplayUnitAttacksState,
} from '../../src/game/simulation/bridge/tier3SyncSystem';
import {
  markUnitAttackMovementStarted,
  upsertUnitAttack,
} from '../../src/game/simulation/bridge/unitAttackAnimationFeed';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';
import type { MatchState } from '../../src/game/simulation/types';

function makeWorld(): GameWorld {
  return new World<GameEvents, GameCommands, GameComponents>({
    gridWidth: 20,
    gridHeight: 20,
    tps: 10,
    seed: 'tail-test',
  });
}

function makeMatchState(): MatchState {
  return {
    outcome: 'running',
    summary: '',
    winCondition: null,
    scores: null,
    wonderCountdownTicks: null,
    relicCountdownTicks: null,
  };
}

describe('registerOutputTail', () => {
  it('publishes attack feed only on bootstrap, change, and expiry', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();
    const feed = createBridgeState().unitAttackFeed;
    const attackDiffs: Array<{ tick: number; value: unknown }> = [];

    world.runMaintenance(() => {
      flushReplayUnitAttacksState(world, feed, world.tick, true);
    });
    registerOutputTail({
      world,
      accessor,
      visibilityCell,
      matchState,
      pendingCommands: [],
      unitAttackFeed: feed,
    });
    world.onDiff((diff) => {
      if (Object.hasOwn(diff.state.set, TIER_3_SLOTS.replayUnitAttacks)) {
        attackDiffs.push({
          tick: diff.tick,
          value: diff.state.set[TIER_3_SLOTS.replayUnitAttacks],
        });
      }
    });

    world.step();
    expect(attackDiffs).toEqual([]);

    upsertUnitAttack(feed, {
      attackerId: 7,
      attackerGeneration: 0,
      tick: 2,
      sourceX: 3,
      sourceY: 4,
      targetX: 4,
      targetY: 4,
      witnessedBy: [1],
    }, 2);
    world.step();
    expect(attackDiffs).toEqual([{ tick: 2, value: [{
      attackerId: 7,
      attackerGeneration: 0,
      tick: 2,
      sourceX: 3,
      sourceY: 4,
      targetX: 4,
      targetY: 4,
      witnessedBy: [1],
    }] }]);

    for (let tick = 3; tick <= 12; tick += 1) world.step();
    expect(attackDiffs).toHaveLength(1);

    world.step();
    expect(attackDiffs).toEqual([
      expect.objectContaining({ tick: 2 }),
      { tick: 13, value: [] },
    ]);
  });

  it('publishes a movement cancellation once and prunes it on the next tick', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const feed = createBridgeState().unitAttackFeed;
    const values: unknown[] = [];
    world.runMaintenance(() => flushReplayUnitAttacksState(world, feed, 0, true));
    registerOutputTail({
      world,
      accessor,
      visibilityCell: new VisibilityCell(new VisibilityMap(20, 20)),
      matchState: makeMatchState(),
      pendingCommands: [],
      unitAttackFeed: feed,
    });
    world.onDiff((diff) => {
      if (Object.hasOwn(diff.state.set, TIER_3_SLOTS.replayUnitAttacks)) {
        values.push(diff.state.set[TIER_3_SLOTS.replayUnitAttacks]);
      }
    });
    upsertUnitAttack(feed, {
      attackerId: 7,
      attackerGeneration: 0,
      tick: 1,
      sourceX: 3,
      sourceY: 4,
      targetX: 4,
      targetY: 4,
      witnessedBy: [1],
    }, 1);

    world.step();
    expect(markUnitAttackMovementStarted(feed, 7, 0, 2)).toBe(true);
    world.step();
    world.step();
    world.step();

    expect(values).toHaveLength(3);
    expect(values[1]).toEqual([expect.objectContaining({ cancelTick: 2 })]);
    expect(values[2]).toEqual([]);
  });

  it('flushes dirty Tier-1 slots to world.state on tick', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], unitAttackFeed: createBridgeState().unitAttackFeed });

    accessor.mutate(combatStatesCodec, (m) =>
      m.set(42, {
        currentHp: 50,
        maxHp: 60,
        armor: 1,
        attackDamage: 5,
        attackRange: 1,
        reloadTicks: 10,
        cooldownTicks: 0,
        pierceArmorBonus: 0,
      }),
    );
    expect(accessor.dirtySize).toBe(1);

    world.step();

    // After tick, accessor should have been flushed: dirty set is empty,
    // and world.state has the serialized Tier-1 slot.
    expect(accessor.dirtySize).toBe(0);
    const serialized = world.getState(combatStatesCodec.slot);
    expect(serialized).toBeDefined();
  });

  it('writes serializedMatchState to world.state every tick', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();
    matchState.outcome = 'victory';
    matchState.winCondition = 'wonder';

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], unitAttackFeed: createBridgeState().unitAttackFeed });
    world.step();

    const persisted = world.getState(TIER_3_SLOTS.matchState) as
      | { outcome: string; winCondition: string | null }
      | undefined;
    expect(persisted).toBeDefined();
    expect(persisted?.outcome).toBe('victory');
    expect(persisted?.winCondition).toBe('wonder');
    // Derived per-tick fields stripped.
    expect((persisted as Record<string, unknown> | undefined)?.wonderCountdownTicks).toBeUndefined();
    expect((persisted as Record<string, unknown> | undefined)?.relicCountdownTicks).toBeUndefined();
  });

  it('writes visibility state ONLY when cell is dirty', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], unitAttackFeed: createBridgeState().unitAttackFeed });

    // First tick: cell starts dirty → visibility WRITTEN.
    expect(visibilityCell.isDirty).toBe(true);
    world.step();
    const after1 = world.getState(TIER_3_SLOTS.visibility);
    expect(after1).toBeDefined();
    expect(visibilityCell.isDirty).toBe(false);

    // Second tick: cell is clean (no markDirty called) → visibility NOT
    // re-written. Verify by reference identity — if a fresh setState had
    // run, world.getState would return a different reference (since
    // VisibilityMap.getState() returns a fresh object each call).
    world.step();
    expect(visibilityCell.isDirty).toBe(false);
    expect(world.getState(TIER_3_SLOTS.visibility)).toBe(after1);

    // Third tick: mark dirty before tick → cell is dirty BEFORE step,
    // but tier3SyncSystem clears it during step. Reference should
    // change because a fresh setState ran.
    visibilityCell.markDirty();
    expect(visibilityCell.isDirty).toBe(true);
    world.step();
    expect(visibilityCell.isDirty).toBe(false);
    expect(world.getState(TIER_3_SLOTS.visibility)).not.toBe(after1);
  });

  it('registers BOTH systems in the output phase, with snapshot LAST', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();

    // Trace EVERY output-phase system by name. Wrap `accessor.flush` and
    // `visibilityCell.consumeIfDirty` so both tail systems push to the
    // trace from inside their `execute` body. This pins the ordering
    // invariant: any future output-phase system inserted after either
    // tail system flips the trace and fails the assertion.
    const trace: string[] = [];
    const originalFlush = accessor.flush.bind(accessor);
    accessor.flush = (): void => {
      trace.push('aoe2BridgeSnapshot');
      originalFlush();
    };
    const originalConsumeIfDirty = visibilityCell.consumeIfDirty.bind(visibilityCell);
    visibilityCell.consumeIfDirty = (): boolean => {
      trace.push('aoe2Tier3Sync');
      return originalConsumeIfDirty();
    };

    // Register a "control" output-phase system BEFORE the tail to
    // confirm that user systems registered before registerOutputTail
    // run BEFORE the tail (registration-order tiebreaker).
    world.registerSystem({
      name: 'controlOutput',
      phase: 'output',
      execute: () => trace.push('controlOutput'),
    });

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], unitAttackFeed: createBridgeState().unitAttackFeed });

    world.step();

    // Strict ordering: control → aoe2Tier3Sync → aoe2BridgeSnapshot.
    // No system in the output phase may slot between or after the tail.
    expect(trace).toEqual(['controlOutput', 'aoe2Tier3Sync', 'aoe2BridgeSnapshot']);
  });
});
