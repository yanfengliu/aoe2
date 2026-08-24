// Phase 2G — snapshot equivalence test for migrated Tier-1 slots.
//
// Per DESIGN v17 §5.6: a `world.serialize()` snapshot followed by
// `World.deserialize` should reconstruct the bridge's Tier-1 slots
// exactly. Phase 2F closed the final bridge-owned Tier-1 exception, so
// this test now iterates the authoritative `TIER_1_CODECS` registry.
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
  marketExchangeRatesCodec,
  projectilesCodec,
  monkTasksCodec,
  TIER_1_CODECS,
  TIER_3_SLOTS,
  unitCommandsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type {
  GameCommands,
  GameComponents,
  GameEvents,
  GameWorld,
} from '../../src/game/simulation/bridge/pureHelpers';

const EXPECTED_TIER_1_SLOTS = [
  'aoe2.playerAges',
  'aoe2.playerCivilizations',
  'aoe2.playerResources',
  'aoe2.population',
  'aoe2.trackedVisibilitySources',
  'aoe2.villagerOrdinals',
  'aoe2.researchedTechnologies',
  'aoe2.marketExchangeRates',
  'aoe2.townCenterRefs',
  'aoe2.playerScoreCounters',
  'aoe2.aiStates',
  'aoe2.unitCommands',
  'aoe2.unitStances',
  'aoe2.unitFormations',
  'aoe2.patrolRoutes',
  'aoe2.sheepMoveOrders',
  'aoe2.monkTasks',
  'aoe2.monkCarriedRelic',
  'aoe2.monkHealCounters',
  'aoe2.monkFaith',
  'aoe2.conversionState',
  'aoe2.trebuchetPackStates',
  'aoe2.garrisonedUnitToBuilding',
  'aoe2.garrisonedUnitVisionSources',
  'aoe2.gathererDropOffStuckSinceTick',
  'aoe2.rallyPoints',
  'aoe2.relicsInMonastery',
  'aoe2.productionQueues',
  'aoe2.constructionStates',
  'aoe2.buildingHealthStates',
  'aoe2.buildingCombatStates',
  'aoe2.wonderCountdowns',
  'aoe2.wonderCountdownOverrides',
  'aoe2.relicCountdowns',
  'aoe2.relicCountdownOverrides',
  'aoe2.garrisonedByBuilding',
  'aoe2.combatStates',
  'aoe2.wildlifeStates',
  'aoe2.lastSeenStatic',
  'aoe2.projectiles',
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

describe('Phase 2G — Tier-1/Tier-3 snapshot equivalence', () => {
  it('pins the expected Phase 2G Tier-1 slot inventory', () => {
    expect(TIER_1_CODECS.map((codec) => codec.slot)).toEqual(EXPECTED_TIER_1_SLOTS);
  });

  it('every registered Tier-1 slot round-trips through world.serialize / World.deserialize', () => {
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
    const live = TIER_1_CODECS.map(
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

  it('Tier-3 slots round-trip through serialize/deserialize', () => {
    const bridge = createSimulationBridge('feudal-age-fixture');
    bridge.step(100);

    const liveMeta = bridge.world.getState(TIER_3_SLOTS.bridgeMeta);
    const liveMatchState = bridge.world.getState(TIER_3_SLOTS.matchState);
    const livePendingCommands = bridge.world.getState(TIER_3_SLOTS.pendingCommands);
    expect(liveMeta).toBeDefined();
    expect(liveMatchState).toBeDefined();
    expect(Array.isArray(livePendingCommands)).toBe(true);

    const snapshot = bridge.world.serialize();
    const restored = World.deserialize<GameEvents, GameCommands, GameComponents>(snapshot);

    expect(restored.getState(TIER_3_SLOTS.bridgeMeta)).toEqual(liveMeta);
    expect(restored.getState(TIER_3_SLOTS.matchState)).toEqual(liveMatchState);
    expect(restored.getState(TIER_3_SLOTS.pendingCommands)).toEqual(livePendingCommands);
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

    // Two codecs are record-shaped rather than Map-shaped: market rates, and
    // the projectile slot (an id counter plus the in-flight list).
    const RECORD_CODECS = new Set<unknown>([marketExchangeRatesCodec, projectilesCodec]);

    type AnyCodec = Parameters<BridgeStateAccessor['get']>[0];
    for (const codec of TIER_1_CODECS) {
      const value = accessor.get(codec as unknown as AnyCodec);
      if (RECORD_CODECS.has(codec)) {
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
