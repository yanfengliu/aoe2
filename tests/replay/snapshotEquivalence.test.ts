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
//
// Coverage is extended with each slot migration: codex slot-19 review
// caught that omitted codecs let a silent dirty-bit regression in
// `trebuchetState.ts` slip through. Add new codecs here AT THE SAME TIME
// as the slot migration commit so the cross-check fires immediately.

import { describe, expect, it } from 'vitest';
import { World, VisibilityMap } from 'civ-engine';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { BridgeStateAccessor } from '../../src/game/simulation/bridge/bridgeStateAccessor';
import {
  conversionStateCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  gathererDropOffStuckSinceTickCodec,
  lastSeenStaticCodec,
  marketExchangeRatesCodec,
  monkCarriedRelicCodec,
  monkHealCountersCodec,
  monkTasksCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  playerScoreCountersCodec,
  productionQueuesCodec,
  rallyPointsCodec,
  relicCountdownOverridesCodec,
  relicCountdownsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  TIER_3_SLOTS,
  townCenterRefsCodec,
  trackedVisibilitySourcesCodec,
  trebuchetPackStatesCodec,
  unitCommandsCodec,
  villagerOrdinalsCodec,
  wonderCountdownOverridesCodec,
  wonderCountdownsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

// Single source of truth for the migrated codec set. Adding a slot →
// add an entry here and both the round-trip test and the Map-instance
// sanity check pick it up automatically.
const MIGRATED_CODECS = [
  villagerOrdinalsCodec,
  gathererDropOffStuckSinceTickCodec,
  monkHealCountersCodec,
  playerAgesCodec,
  playerCivilizationsCodec,
  wonderCountdownOverridesCodec,
  relicCountdownOverridesCodec,
  marketExchangeRatesCodec,
  trackedVisibilitySourcesCodec,
  playerScoreCountersCodec,
  rallyPointsCodec,
  unitCommandsCodec,
  wonderCountdownsCodec,
  relicCountdownsCodec,
  townCenterRefsCodec,
  relicsInMonasteryCodec,
  sheepMoveOrdersCodec,
  conversionStateCodec,
  monkCarriedRelicCodec,
  monkTasksCodec,
  trebuchetPackStatesCodec,
  lastSeenStaticCodec,
  garrisonedByBuildingCodec,
  garrisonedUnitToBuildingCodec,
  garrisonedUnitVisionSourcesCodec,
  productionQueuesCodec,
] as const;

type EconomyUnit = ReturnType<ReturnType<typeof createSimulationBridge>['getEconomyState']>['units'][number];
type EconomyResource = ReturnType<ReturnType<typeof createSimulationBridge>['getEconomyState']>['resources'][number];

function findOwnedUnit(
  bridge: ReturnType<typeof createSimulationBridge>,
  owner: number,
  unitType: string,
): EconomyUnit | undefined {
  return bridge.getEconomyState().units.find(
    (unit) => unit.owner === owner && unit.unitType === unitType,
  );
}

function findResource(
  bridge: ReturnType<typeof createSimulationBridge>,
  resourceType: string,
): EconomyResource | undefined {
  return bridge.getEconomyState().resources.find(
    (resource) => resource.resourceType === resourceType,
  );
}

function stepUntil(
  bridge: ReturnType<typeof createSimulationBridge>,
  predicate: () => boolean,
  maxSteps: number,
): boolean {
  for (let step = 0; step < maxSteps; step += 1) {
    if (predicate()) return true;
    bridge.step(100);
  }
  return predicate();
}

describe('Phase 2G — Tier-1 snapshot equivalence (incremental)', () => {
  it('migrated slots round-trip through world.serialize / World.deserialize', () => {
    // Live bridge — runs scenario seed, runs a tick, then we snapshot.
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100); // one tick — flushes any dirty Tier-1 slots

    const liveWorld = bridge.world;

    // Force bridgeSnapshotSystem to flush the cache to world.state.
    // bridge.step calls registerOutputTail's snapshot system, but we
    // also flush explicitly here so the test is independent of when
    // the last flush ran.
    bridge.step(100);

    // Capture per-slot snapshots from the live accessor (via codec).
    // Capture AFTER the explicit flush step so per-tick mutating slots
    // (lastSeenStatic, playerScoreCounters, etc) match what serialize
    // sees — capturing before the second step would race with the
    // tick's writes and produce a stale comparison.
    type AnyCodec = Parameters<BridgeStateAccessor['get']>[0];
    const liveAccessor = new BridgeStateAccessor(() => liveWorld);
    const live = MIGRATED_CODECS.map(
      (codec) =>
        [codec, liveAccessor.get(codec as unknown as AnyCodec)] as const,
    );

    // Serialize the world and deserialize into a fresh World — this
    // simulates the save/load (or replay snapshot/restore) round trip.
    const snapshot = liveWorld.serialize();
    const restoredWorld = World.deserialize<GameEvents, GameCommands, GameComponents>(
      snapshot,
    ) as unknown as GameWorld;
    const restoredAccessor = new BridgeStateAccessor(() => restoredWorld);

    // Read each migrated slot from the restored world via the same
    // codec; verify content equality.
    for (const [codec, liveValue] of live) {
      expect(restoredAccessor.get(codec as unknown as AnyCodec)).toEqual(liveValue);
    }
  });

  it('active Monk tasks flush into world.state for snapshots', () => {
    const bridge = createSimulationBridge('monk-relic-fixture');
    const initialMonk = findOwnedUnit(bridge, 1, 'monk');
    expect(initialMonk).toBeDefined();

    const moveResult = bridge.world.submitWithResult('unit.move', {
      unitId: initialMonk!.id,
      target: { x: 14, y: 14 },
    });
    expect(moveResult.accepted).toBe(true);
    expect(
      stepUntil(
        bridge,
        () => {
          const monk = findOwnedUnit(bridge, 1, 'monk');
          return monk !== undefined && monk.x === 14 && monk.y === 14;
        },
        200,
      ),
    ).toBe(true);

    const relic = findResource(bridge, 'relic');
    expect(relic).toBeDefined();
    const taskResult = bridge.world.submitWithResult('monk.contextAtEntity', {
      unitId: initialMonk!.id,
      targetEntityId: relic!.id,
    });
    expect(taskResult.accepted).toBe(true);

    bridge.step(100);

    const serialized = bridge.world.getState(monkTasksCodec.slot) as
      | Array<[number, { kind: string; targetEntityRef: { id: number; generation: number } }]>
      | undefined;
    expect(serialized).toEqual([
      [
        initialMonk!.id,
        {
          kind: 'pickup',
          targetEntityRef: { id: relic!.id, generation: 0 },
        },
      ],
    ]);
  });

  it('active unit commands flush into world.state for snapshots', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    const initialVillager = findOwnedUnit(bridge, 1, 'villager');
    expect(initialVillager).toBeDefined();

    const result = bridge.world.submitWithResult('unit.move', {
      unitId: initialVillager!.id,
      target: { x: 0, y: 0 },
    });
    expect(result.accepted).toBe(true);

    bridge.step(100);

    const serialized = bridge.world.getState(unitCommandsCodec.slot) as
      | Array<[number, { type: string; target: { x: number; y: number } }]>
      | undefined;
    expect(serialized).toEqual([
      [
        initialVillager!.id,
        {
          type: 'move',
          target: { x: 0, y: 0 },
        },
      ],
    ]);
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

  it('reading migrated slots from a fresh deserialized world via accessor codecs returns codec-shaped values', () => {
    // Sanity check that codec.deserialize is invoked correctly by the
    // accessor lazy-read path on a serialized→deserialized world (not
    // the original live world). Most codecs return Map (flatMap, mapOfMap,
    // mapOfSet); a small minority return a plain Record (e.g.
    // marketExchangeRates). Per slot-21 Claude review iter-1: assert the
    // RIGHT shape per codec instead of a too-lax `instanceof Object`.
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100);
    const snapshot = bridge.world.serialize();
    const restoredWorld = World.deserialize<GameEvents, GameCommands, GameComponents>(
      snapshot,
    ) as unknown as GameWorld;
    const accessor = new BridgeStateAccessor(() => restoredWorld);

    // marketExchangeRatesCodec is the ONE record-shaped codec — its
    // serialize/deserialize uses a plain object, not a Map.
    const RECORD_CODECS = new Set([marketExchangeRatesCodec]);

    type AnyCodec = Parameters<BridgeStateAccessor['get']>[0];
    for (const codec of MIGRATED_CODECS) {
      const value = accessor.get(codec as unknown as AnyCodec);
      if (RECORD_CODECS.has(codec as unknown as typeof marketExchangeRatesCodec)) {
        expect(value).not.toBeInstanceOf(Map);
        expect(typeof value).toBe('object');
        expect(value).not.toBeNull();
      } else {
        expect(value).toBeInstanceOf(Map);
      }
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
