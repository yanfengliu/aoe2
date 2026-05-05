import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  gathererDropOffStuckSinceTickCodec,
  monkTasksCodec,
  playerResourcesCodec,
  productionQueuesCodec,
  TIER_3_SLOTS,
  unitCommandsCodec,
} from '../../src/game/simulation/bridge/bridgeStateSerialize';
import {
  SAVE_SCHEMA_VERSION,
  type SaveBlob,
  type SaveBlobV1,
} from '../../src/game/simulation/saveSchema';
import type { PendingCommand } from '../../src/game/simulation/dispatcher';
import {
  asSchema2Blob,
  codecSlotValue,
  expectNoLegacyTopLevelFields,
  legacySchema1FromBridge,
  PENDING_COMMANDS_STATE_SLOT,
  stateSlot,
  worldStateOf,
} from './saveBlobTestUtils';

type Bridge = ReturnType<typeof createSimulationBridge>;
type EconomyUnit = ReturnType<Bridge['getEconomyState']>['units'][number];
type EconomyResource = ReturnType<Bridge['getEconomyState']>['resources'][number];

// Pull the bridge state we want to compare across the round trip.
// `playerScores` and `winCondition` come straight off matchState; the
// rest are derived from getEconomyState so combat and gather progress
// both register.
function captureSnapshot(bridge: Bridge): {
  tick: number;
  ages: Record<number, string>;
  playerResources: Record<number, { food: number; wood: number; gold: number; stone: number }>;
  population: Record<number, { current: number; cap: number }>;
  unitIds: number[];
  buildingIds: number[];
  unitHps: Array<{ id: number; unitType: string; owner: number; x: number; y: number }>;
  buildingProgress: Array<{ id: number; isComplete: boolean; buildProgressTicks: number }>;
  matchOutcome: string;
  winCondition: string | null;
  wonderCountdown: number | null;
  relicCountdown: number | null;
} {
  const economy = bridge.getEconomyState();
  const match = bridge.getMatchState();
  return {
    tick: bridge.getHudState().tick,
    ages: { ...economy.ages },
    playerResources: { ...economy.playerResources },
    population: { ...economy.population },
    unitIds: economy.units.map((u) => u.id).sort((a, b) => a - b),
    buildingIds: economy.buildings.map((b) => b.id).sort((a, b) => a - b),
    unitHps: economy.units
      .map((u) => ({ id: u.id, unitType: u.unitType, owner: u.owner, x: u.x, y: u.y }))
      .sort((a, b) => a.id - b.id),
    buildingProgress: economy.buildings
      .map((b) => ({
        id: b.id,
        isComplete: b.isComplete,
        buildProgressTicks: b.buildProgressTicks,
      }))
      .sort((a, b) => a.id - b.id),
    matchOutcome: match.outcome,
    winCondition: match.winCondition,
    wonderCountdown: match.wonderCountdownTicks,
    relicCountdown: match.relicCountdownTicks,
  };
}

function findOwnedUnit(bridge: Bridge, owner: number, unitType: string): EconomyUnit | undefined {
  return bridge.getEconomyState().units.find(
    (unit) => unit.owner === owner && unit.unitType === unitType,
  );
}

function findResource(bridge: Bridge, resourceType: string): EconomyResource | undefined {
  return bridge.getEconomyState().resources.find(
    (resource) => resource.resourceType === resourceType,
  );
}

function stepUntil(bridge: Bridge, predicate: () => boolean, maxSteps: number): boolean {
  for (let step = 0; step < maxSteps; step += 1) {
    if (predicate()) return true;
    bridge.step(100);
  }
  return predicate();
}

describe('Slice 9 — save/load round-trip', () => {
  it('produces a JSON-serializable save blob with the current schema version', () => {
    const bridge = createSimulationBridge();
    bridge.step(1000);

    const blob = bridge.saveGame();

    expect(blob.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(blob.seed).toBe('aoe2-prototype');
    const json = JSON.stringify(blob);
    const parsed: SaveBlob = JSON.parse(json) as SaveBlob;
    expect(parsed.schema).toBe(SAVE_SCHEMA_VERSION);
    expect(parsed.worldSnapshot.tick).toBeGreaterThan(0);
    expectNoLegacyTopLevelFields(parsed);
    const state = worldStateOf(parsed);
    expect(Array.isArray(state[playerResourcesCodec.slot])).toBe(true);
    expect(stateSlot(parsed, TIER_3_SLOTS.matchState)).toMatchObject({ outcome: 'running' });
    expect(stateSlot(parsed, TIER_3_SLOTS.visibility)).toMatchObject({
      width: expect.any(Number),
      height: expect.any(Number),
    });
  });

  it('rehydrates economy + match state on the conquest-victory fixture', () => {
    const bridge1 = createSimulationBridge('conquest-victory-fixture');
    // Run long enough that resources, scores, and building states all
    // diverge from the bootstrap snapshot.
    for (let i = 0; i < 200; i += 1) {
      bridge1.step(100);
    }
    const before = captureSnapshot(bridge1);

    const blob = bridge1.saveGame();
    // Round-trip through JSON to prove nothing in the blob relies on
    // non-serializable runtime references.
    const json = JSON.stringify(blob);
    const parsed: SaveBlob = JSON.parse(json) as SaveBlob;

    const bridge2 = createSimulationBridge('conquest-victory-fixture', { savedGame: parsed });
    const afterLoad = captureSnapshot(bridge2);

    expect(afterLoad.tick).toBe(before.tick);
    expect(afterLoad.ages).toEqual(before.ages);
    expect(afterLoad.playerResources).toEqual(before.playerResources);
    expect(afterLoad.population).toEqual(before.population);
    expect(afterLoad.unitIds).toEqual(before.unitIds);
    expect(afterLoad.buildingIds).toEqual(before.buildingIds);
    expect(afterLoad.matchOutcome).toBe(before.matchOutcome);
    expect(afterLoad.winCondition).toBe(before.winCondition);
  });

  it('produces matching state after stepping both saved and loaded bridges 100 more ticks', () => {
    const bridge1 = createSimulationBridge('conquest-victory-fixture');
    for (let i = 0; i < 150; i += 1) {
      bridge1.step(100);
    }

    const blob = bridge1.saveGame();
    const bridge2 = createSimulationBridge('conquest-victory-fixture', { savedGame: blob });

    // Step both forward and compare again. If determinism holds, the
    // two bridges should produce byte-for-byte identical state.
    for (let i = 0; i < 100; i += 1) {
      bridge1.step(100);
      bridge2.step(100);
    }

    const afterStep1 = captureSnapshot(bridge1);
    const afterStep2 = captureSnapshot(bridge2);

    expect(afterStep2.tick).toBe(afterStep1.tick);
    expect(afterStep2.playerResources).toEqual(afterStep1.playerResources);
    expect(afterStep2.unitIds).toEqual(afterStep1.unitIds);
    expect(afterStep2.buildingIds).toEqual(afterStep1.buildingIds);
    expect(afterStep2.unitHps).toEqual(afterStep1.unitHps);
    expect(afterStep2.matchOutcome).toBe(afterStep1.matchOutcome);
  });

  it('throws on schema mismatch', () => {
    const bridge = createSimulationBridge();
    const blob = bridge.saveGame();
    const corrupt = { ...blob, schema: 999 } as unknown as SaveBlob;
    expect(() => createSimulationBridge('aoe2-prototype', { savedGame: corrupt })).toThrow(
      /schema mismatch/i,
    );
  });

  it('preserves a Wonder countdown — load resumes the timer at the saved value', () => {
    // Wonder countdown override is 10 ticks; the human player wins
    // when it hits zero. Save mid-countdown, load, and verify the
    // load-side bridge resolves the victory at the same total tick.
    const bridge1 = createSimulationBridge('wonder-short-countdown-fixture');
    // Step a little — Wonder must be standing for the countdown to
    // start (the construction-complete hook seeds it).
    for (let i = 0; i < 5; i += 1) {
      bridge1.step(100);
    }
    const blob = bridge1.saveGame();
    const bridge2 = createSimulationBridge('wonder-short-countdown-fixture', {
      savedGame: blob,
    });

    // Both should report the same Wonder countdown right after load.
    const matchAfter1 = bridge1.getMatchState();
    const matchAfter2 = bridge2.getMatchState();
    expect(matchAfter2.wonderCountdownTicks).toBe(matchAfter1.wonderCountdownTicks);

    // Step both forward the same amount; they must finalize at the
    // same tick.
    for (let i = 0; i < 30; i += 1) {
      bridge1.step(100);
      bridge2.step(100);
    }

    const final1 = bridge1.getMatchState();
    const final2 = bridge2.getMatchState();
    expect(final2.outcome).toBe(final1.outcome);
    expect(final2.winCondition).toBe(final1.winCondition);
  });

  it('projects render frames with the saved-game seed, not the outer constructor seed (review H-1)', () => {
    // The world replays on `savedGame.seed` so the deterministic rng
    // matches byte-for-byte. The render projector must use the same
    // seed — otherwise the projected frame advertises a seed that does
    // not correspond to the simulation it is observing.
    const savedSeed = 'conquest-victory-fixture';
    const otherSeed = 'aoe2-prototype';
    expect(savedSeed).not.toBe(otherSeed);
    const bridge1 = createSimulationBridge(savedSeed);
    bridge1.step(1000);
    const blob = bridge1.saveGame();

    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: blob });
    const frame = loadedBridge.getRenderState().frame;
    expect(frame).not.toBeNull();
    expect(frame!.seed).toBe(savedSeed);
  });

  it('preserves researched technologies and player ages across save/load', () => {
    // The conquest-victory fixture starts both players in Castle Age,
    // so the researched-techs side map carries the player ages right
    // after bootstrap.
    const bridge1 = createSimulationBridge('conquest-victory-fixture');
    for (let i = 0; i < 50; i += 1) {
      bridge1.step(100);
    }

    const economy1 = bridge1.getEconomyState();
    const blob = bridge1.saveGame();
    const bridge2 = createSimulationBridge('conquest-victory-fixture', { savedGame: blob });
    const economy2 = bridge2.getEconomyState();

    expect(economy2.ages).toEqual(economy1.ages);
  });

  it('reports the saved-game seed via getHudState() after load (review V2-1 follow-up)', () => {
    // Companion to the H-1 projector-seed test above: getHudState().seed
    // is the seed surface the HUD + browser test snapshot consume. After
    // load it must equal `savedGame.seed`, not the outer constructor seed.
    const savedSeed = 'conquest-victory-fixture';
    const otherSeed = 'aoe2-prototype';
    expect(savedSeed).not.toBe(otherSeed);
    const bridge1 = createSimulationBridge(savedSeed);
    bridge1.step(1000);
    const blob = bridge1.saveGame();

    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: blob });
    expect(loadedBridge.getHudState().seed).toBe(savedSeed);
  });

  it('writes the saved-game seed (not the outer constructor seed) when re-saving a loaded match (review V2-1 follow-up)', () => {
    // Re-saving a loaded match must not silently rebrand the blob with
    // the outer constructor seed; that breaks the determinism contract
    // for the load → re-save round-trip.
    const savedSeed = 'conquest-victory-fixture';
    const otherSeed = 'aoe2-prototype';
    expect(savedSeed).not.toBe(otherSeed);
    const bridge1 = createSimulationBridge(savedSeed);
    bridge1.step(1000);
    const firstBlob = bridge1.saveGame();
    expect(firstBlob.seed).toBe(savedSeed);

    const loadedBridge = createSimulationBridge(otherSeed, { savedGame: firstBlob });
    const secondBlob = loadedBridge.saveGame();
    expect(secondBlob.seed).toBe(savedSeed);
  });

  it('treats schema-1 sideMaps.monkTasks as authoritative over stale world snapshot state', () => {
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

    const blob = legacySchema1FromBridge(bridge);
    expect(blob.sideMaps.monkTasks).toHaveLength(1);
    expect(
      'state' in blob.worldSnapshot
        ? blob.worldSnapshot.state[monkTasksCodec.slot]
        : undefined,
    ).toEqual(blob.sideMaps.monkTasks);

    const divergent = JSON.parse(JSON.stringify(blob)) as SaveBlobV1;
    divergent.sideMaps.monkTasks = [];

    const loadedBridge = createSimulationBridge('monk-relic-fixture', { savedGame: divergent });
    const reSaved = loadedBridge.saveGame();
    expect(
      'state' in reSaved.worldSnapshot
        ? reSaved.worldSnapshot.state[monkTasksCodec.slot]
        : undefined,
    ).toEqual([]);
  });

  it('treats schema-1 sideMaps.unitCommands as authoritative over stale world snapshot state', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    const initialVillager = findOwnedUnit(bridge, 1, 'villager');
    expect(initialVillager).toBeDefined();
    const moveResult = bridge.world.submitWithResult('unit.move', {
      unitId: initialVillager!.id,
      target: { x: 0, y: 0 },
    });
    expect(moveResult.accepted).toBe(true);
    bridge.step(100);

    const blob = legacySchema1FromBridge(bridge);
    expect(blob.sideMaps.unitCommands).toHaveLength(1);

    const divergent = JSON.parse(JSON.stringify(blob)) as SaveBlobV1;
    expect('state' in divergent.worldSnapshot).toBe(true);
    (
      divergent.worldSnapshot as {
        state: Record<string, unknown>;
      }
    ).state[unitCommandsCodec.slot] = blob.sideMaps.unitCommands;
    divergent.sideMaps.unitCommands = [];

    const loadedBridge = createSimulationBridge('unit-move-facade', { savedGame: divergent });
    const reSaved = loadedBridge.saveGame();
    expect(
      'state' in reSaved.worldSnapshot
        ? reSaved.worldSnapshot.state[unitCommandsCodec.slot]
        : undefined,
    ).toEqual([]);
  });

  it('treats schema-1 sideMaps.productionQueues as authoritative over stale world snapshot state', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    const building = bridge.getEconomyState().buildings[0];
    expect(building).toBeDefined();

    const blob = legacySchema1FromBridge(bridge);
    const divergent = JSON.parse(JSON.stringify(blob)) as SaveBlobV1;
    expect('state' in divergent.worldSnapshot).toBe(true);
    (
      divergent.worldSnapshot as {
        state: Record<string, unknown>;
      }
    ).state[productionQueuesCodec.slot] = [
      [
        building!.id,
        [
          {
            kind: 'unit',
            label: 'Militia',
            unitType: 'militia',
            remainingTicks: 1,
            totalTicks: 1,
            isBlocked: false,
          },
        ],
      ],
    ];
    divergent.sideMaps.productionQueues = [];

    const loadedBridge = createSimulationBridge('unit-move-facade', { savedGame: divergent });
    expect(codecSlotValue(loadedBridge.saveGame(), productionQueuesCodec)).toEqual([]);
  });

  it('treats schema-1 sideMaps.pendingCommands as authoritative for immediate post-load snapshots', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    const villager = findOwnedUnit(bridge, 1, 'villager');
    const building = bridge.getEconomyState().buildings[0];
    expect(villager).toBeDefined();
    expect(building).toBeDefined();

    const blob = legacySchema1FromBridge(bridge);
    const queued: PendingCommand = {
      type: 'unit.move',
      data: { unitId: villager!.id, target: { x: 1, y: 1 } },
    };
    const stale: PendingCommand = {
      type: 'queue.train',
      data: { buildingId: building!.id, unitType: 'villager' },
    };
    const divergent = JSON.parse(JSON.stringify(blob)) as SaveBlobV1;
    (
      divergent.worldSnapshot as {
        state: Record<string, unknown>;
      }
    ).state[PENDING_COMMANDS_STATE_SLOT] = [stale];
    divergent.sideMaps.pendingCommands = [queued];

    const loadedBridge = createSimulationBridge('unit-move-facade', { savedGame: divergent });
    expect(
      stateSlot<PendingCommand[]>(
        { worldSnapshot: loadedBridge.world.serialize() },
        PENDING_COMMANDS_STATE_SLOT,
      ),
    ).toEqual([queued]);
  });

  it('hydrates schema-2 active unit commands from world snapshot state', () => {
    const bridge = createSimulationBridge('unit-move-facade');
    const initialVillager = findOwnedUnit(bridge, 1, 'villager');
    expect(initialVillager).toBeDefined();

    const moveResult = bridge.world.submitWithResult('unit.move', {
      unitId: initialVillager!.id,
      target: { x: 0, y: 0 },
    });
    expect(moveResult.accepted).toBe(true);
    bridge.step(100);

    const schema2 = asSchema2Blob(bridge.saveGame());
    const savedCommands = stateSlot<Array<[number, unknown]>>(schema2, unitCommandsCodec.slot);
    expect(savedCommands).toHaveLength(1);

    const loadedBridge = createSimulationBridge('unit-move-facade', { savedGame: schema2 });
    expect(stateSlot(loadedBridge.saveGame(), unitCommandsCodec.slot)).toEqual(savedCommands);
  });

  it('throws when a schema-2 world snapshot is missing match state', () => {
    const bridge = createSimulationBridge('aoe2-prototype');
    const schema2 = asSchema2Blob(bridge.saveGame());
    delete worldStateOf(schema2)[TIER_3_SLOTS.matchState];

    expect(() => createSimulationBridge('aoe2-prototype', { savedGame: schema2 })).toThrow(
      /aoe2\.matchState/,
    );
  });

  it('persists the gatherer drop-off retry throttle field (review V4-7)', () => {
    // Iter-2 V5-6 strengthening: prior version of this test used a
    // synthetic id that the V3-8 orphan-prune deleted on load, so the
    // assertion proved only schema presence, not the round-trip
    // contract. Pick a real villager id so the prune leaves the entry
    // alone and the post-load throttle map preserves the real entry.
    const bridge = createSimulationBridge('aoe2-prototype');
    bridge.step(1000);
    const blob = bridge.saveGame();
    expect(stateSlot(blob, gathererDropOffStuckSinceTickCodec.slot)).toBeDefined();
    expect(Array.isArray(stateSlot(blob, gathererDropOffStuckSinceTickCodec.slot))).toBe(true);

    // Find a real villager id in the saved economy state. The throttle
    // map is keyed on entity id; using a real id means the post-load
    // orphan-prune leaves the entry intact.
    const realVillager = bridge
      .getEconomyState()
      .units.find((unit) => unit.unitType === 'villager');
    expect(realVillager).toBeDefined();
    const realVillagerId = realVillager!.id;
    const stuckSinceTick = blob.worldSnapshot.tick - 10;

    // Inject the throttle entry for the real villager.
    worldStateOf(blob)[gathererDropOffStuckSinceTickCodec.slot] = [[realVillagerId, stuckSinceTick]];
    const json = JSON.parse(JSON.stringify(asSchema2Blob(blob))) as SaveBlob;
    expect(stateSlot(json, gathererDropOffStuckSinceTickCodec.slot)).toEqual([
      [realVillagerId, stuckSinceTick],
    ]);

    // Post-load: the real villager id resolves via world.getEntityRef so
    // the V3-8 orphan-prune leaves it. The throttle entry survives the
    // round trip — that's the V4-7 contract.
    const loaded = createSimulationBridge('aoe2-prototype', { savedGame: json });
    const postLoadThrottle = stateSlot(
      loaded.saveGame(),
      gathererDropOffStuckSinceTickCodec.slot,
    );
    expect(postLoadThrottle).toEqual([[realVillagerId, stuckSinceTick]]);
  });
});
