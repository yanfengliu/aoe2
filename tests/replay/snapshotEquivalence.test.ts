// Phase 2G partial — snapshot equivalence test for migrated Tier-1 slots.
//
// Per DESIGN v17 §5.6: a `world.serialize()` snapshot followed by
// `World.deserialize` should reconstruct the bridge's Tier-1 slots
// exactly. Until ALL 35 slots are migrated, this test only verifies the
// slots that HAVE been migrated. Each new Phase 2D commit can extend the
// expected list.
//
// The test exercises the full Phase 2C pipeline: bridge construction →
// bootstrapFlush populates Tier-3 + dirty Tier-1 slots → tier3SyncSystem
// + bridgeSnapshotSystem flush per tick → world.serialize captures
// `world.state.aoe2.*` → World.deserialize restores it → second bridge
// reads the same values via codecs.

import { describe, expect, it } from 'vitest';
import { World, VisibilityMap } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  gathererDropOffStuckSinceTickCodec,
  monkHealCountersCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  relicCountdownOverridesCodec,
  TIER_3_SLOTS,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

describe('Phase 2G — Tier-1 snapshot equivalence (incremental)', () => {
  it('migrated slots round-trip through world.serialize / World.deserialize', () => {
    // Live bridge — runs scenario seed, runs a tick, then we snapshot.
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100); // one tick — flushes any dirty Tier-1 slots

    const liveWorld = bridge.world;
    const liveAccessor = new BridgeStateAccessor(() => liveWorld);

    // Capture per-slot snapshots from the live accessor (via codec).
    const live = {
      villagerOrdinals: liveAccessor.get(villagerOrdinalsCodec),
      gathererDropOffStuckSinceTick: liveAccessor.get(gathererDropOffStuckSinceTickCodec),
      monkHealCounters: liveAccessor.get(monkHealCountersCodec),
      playerAges: liveAccessor.get(playerAgesCodec),
      playerCivilizations: liveAccessor.get(playerCivilizationsCodec),
      wonderCountdownOverrides: liveAccessor.get(wonderCountdownOverridesCodec),
      relicCountdownOverrides: liveAccessor.get(relicCountdownOverridesCodec),
    };

    // Force bridgeSnapshotSystem to flush the cache to world.state.
    // bridge.step calls registerOutputTail's snapshot system, but we
    // also flush explicitly here so the test is independent of when
    // the last flush ran.
    bridge.step(100);

    // Serialize the world and deserialize into a fresh World — this
    // simulates the save/load (or replay snapshot/restore) round trip.
    const snapshot = liveWorld.serialize();
    const restoredWorld = World.deserialize<GameEvents, GameCommands, GameComponents>(
      snapshot,
    ) as unknown as GameWorld;
    const restoredAccessor = new BridgeStateAccessor(() => restoredWorld);

    // Read each migrated slot from the restored world via the same
    // codec; verify content equality.
    expect(restoredAccessor.get(villagerOrdinalsCodec)).toEqual(live.villagerOrdinals);
    expect(restoredAccessor.get(gathererDropOffStuckSinceTickCodec)).toEqual(
      live.gathererDropOffStuckSinceTick,
    );
    expect(restoredAccessor.get(monkHealCountersCodec)).toEqual(live.monkHealCounters);
    expect(restoredAccessor.get(playerAgesCodec)).toEqual(live.playerAges);
    expect(restoredAccessor.get(playerCivilizationsCodec)).toEqual(live.playerCivilizations);
    expect(restoredAccessor.get(wonderCountdownOverridesCodec)).toEqual(
      live.wonderCountdownOverrides,
    );
    expect(restoredAccessor.get(relicCountdownOverridesCodec)).toEqual(
      live.relicCountdownOverrides,
    );
  });

  it('Tier-3 slots (matchState, bridgeMeta) round-trip through serialize/deserialize', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100);

    const liveMeta = bridge.world.getState(TIER_3_SLOTS.bridgeMeta);
    const liveMatchState = bridge.world.getState(TIER_3_SLOTS.matchState);
    expect(liveMeta).toBeDefined();
    expect(liveMatchState).toBeDefined();

    const snapshot = bridge.world.serialize();
    const restored = World.deserialize<GameEvents, GameCommands, GameComponents>(snapshot);

    expect(restored.getState(TIER_3_SLOTS.bridgeMeta)).toEqual(liveMeta);
    expect(restored.getState(TIER_3_SLOTS.matchState)).toEqual(liveMatchState);
  });

  it('reading migrated slots from a fresh deserialized world via accessor codecs returns Map instances', () => {
    // Sanity check that codec.deserialize is invoked correctly by the
    // accessor lazy-read path on a serialized→deserialized world (not
    // the original live world).
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100);
    const snapshot = bridge.world.serialize();
    const restoredWorld = World.deserialize<GameEvents, GameCommands, GameComponents>(
      snapshot,
    ) as unknown as GameWorld;
    const accessor = new BridgeStateAccessor(() => restoredWorld);

    type AnyCodec = Parameters<BridgeStateAccessor['get']>[0];
    const codecs: AnyCodec[] = [
      villagerOrdinalsCodec as unknown as AnyCodec,
      gathererDropOffStuckSinceTickCodec as unknown as AnyCodec,
      monkHealCountersCodec as unknown as AnyCodec,
      playerAgesCodec as unknown as AnyCodec,
      playerCivilizationsCodec as unknown as AnyCodec,
      wonderCountdownOverridesCodec as unknown as AnyCodec,
      relicCountdownOverridesCodec as unknown as AnyCodec,
    ];
    for (const codec of codecs) {
      const m = accessor.get(codec);
      expect(m).toBeInstanceOf(Map);
    }
  });

  it('VisibilityMap state round-trips (Tier-3)', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100);
    const visState = bridge.world.getState(TIER_3_SLOTS.visibility) as
      | { width: number; height: number; players: unknown[] }
      | undefined;
    expect(visState).toBeDefined();
    expect(visState?.width).toBeGreaterThan(0);
    expect(visState?.height).toBeGreaterThan(0);

    const snapshot = bridge.world.serialize();
    const restored = World.deserialize<GameEvents, GameCommands, GameComponents>(snapshot);
    expect(restored.getState(TIER_3_SLOTS.visibility)).toEqual(visState);

    // Sanity: VisibilityMap.fromState (if present in the engine) should
    // accept the restored state back.
    const map = VisibilityMap.fromState(
      restored.getState(TIER_3_SLOTS.visibility) as Parameters<typeof VisibilityMap.fromState>[0],
    );
    expect(map).toBeDefined();
  });
});
