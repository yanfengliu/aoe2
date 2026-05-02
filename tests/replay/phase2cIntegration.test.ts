// Phase 2C integration test: the live bridge constructed via
// `createSimulationBridge` actually writes the three Tier-3 slots
// (`aoe2.bridgeMeta`, `aoe2.matchState`, `aoe2.visibility`) into
// `world.state` via `bootstrapFlush` + the `tier3SyncSystem` that runs
// every output phase.

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TIER_3_SLOTS } from '../../src/game/simulation/bridge/bridgeStateSerialize';

describe('Phase 2C integration — live bridge writes Tier-3 slots', () => {
  it('bootstrapFlush populates aoe2.bridgeMeta before tick 1', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const meta = bridge.world.getState(TIER_3_SLOTS.bridgeMeta) as
      | { mapWidth: number; mapHeight: number }
      | undefined;
    expect(meta).toBeDefined();
    expect(meta?.mapWidth).toBeGreaterThan(0);
    expect(meta?.mapHeight).toBeGreaterThan(0);
  });

  it('bootstrapFlush populates aoe2.matchState before tick 1', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const persisted = bridge.world.getState(TIER_3_SLOTS.matchState) as
      | { outcome: string; summary: string; winCondition: string | null; scores: unknown }
      | undefined;
    expect(persisted).toBeDefined();
    expect(persisted?.outcome).toBe('running');
    // Per-tick derived fields stripped.
    expect((persisted as Record<string, unknown> | undefined)?.wonderCountdownTicks).toBeUndefined();
    expect((persisted as Record<string, unknown> | undefined)?.relicCountdownTicks).toBeUndefined();
  });

  it('bootstrapFlush populates aoe2.visibility before tick 1', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const visState = bridge.world.getState(TIER_3_SLOTS.visibility);
    expect(visState).toBeDefined();
  });

  it('tier3SyncSystem updates aoe2.matchState every tick with current outcome', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const before = bridge.world.getState(TIER_3_SLOTS.matchState);
    bridge.step(100); // one tick
    const after = bridge.world.getState(TIER_3_SLOTS.matchState) as
      | { outcome: string }
      | undefined;
    // Reference change proves a fresh setState ran (not a cache).
    expect(after).not.toBe(before);
    // Content equality with live API proves it was specifically the
    // tier3SyncSystem output that ran (not some other writer).
    expect(after?.outcome).toBe(bridge.getMatchState().outcome);
  });

  it('aoe2.visibility reference is stable across clean ticks (no markDirty between)', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    const initial = bridge.world.getState(TIER_3_SLOTS.visibility);
    expect(initial).toBeDefined();
    // Step a few clean ticks. Without Phase 2E's syncVisibilitySources
    // fingerprint cache, no caller marks the visibility cell dirty, so
    // tier3SyncSystem's `consumeIfDirty()` returns false → visibility
    // slot is NOT re-written → reference identity is preserved.
    // This pins the dirty-flag optimization until Phase 2E lands.
    bridge.step(100);
    bridge.step(100);
    bridge.step(100);
    expect(bridge.world.getState(TIER_3_SLOTS.visibility)).toBe(initial);
  });
});
