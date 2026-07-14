import { describe, expect, it } from 'vitest';
import { World, VisibilityMap } from 'civ-engine';

import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  combatStatesCodec,
  TIER_3_SLOTS,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import { VisibilityCell } from '../../src/game/simulation/bridge/visibilityCell';
import { registerOutputTail } from '../../src/game/simulation/bridge/registerOutputTail';
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
  it('flushes dirty Tier-1 slots to world.state on tick', () => {
    const world = makeWorld();
    const accessor = new BridgeStateAccessor(() => world);
    const visibilityCell = new VisibilityCell(new VisibilityMap(20, 20));
    const matchState = makeMatchState();

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], recentUnitAttacks: [] });

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

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], recentUnitAttacks: [] });
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

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], recentUnitAttacks: [] });

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

    registerOutputTail({ world, accessor, visibilityCell, matchState, pendingCommands: [], recentUnitAttacks: [] });

    world.step();

    // Strict ordering: control → aoe2Tier3Sync → aoe2BridgeSnapshot.
    // No system in the output phase may slot between or after the tail.
    expect(trace).toEqual(['controlOutput', 'aoe2Tier3Sync', 'aoe2BridgeSnapshot']);
  });
});
