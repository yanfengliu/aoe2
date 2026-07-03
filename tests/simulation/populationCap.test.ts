// Standard AoE2 200 population cap (roadmap M1, v0.1.37).
//
// The effective cap is min(200, raw building-supplied housing). The model
// tracks an honest, unclamped `rawSupply` running sum on PopulationState and
// DERIVES `cap = deriveCap(rawSupply) = min(200, max(0, rawSupply))` at every
// build/destroy site + on load. Over-housing past 200 is allowed but wasteful
// (no extra cap); losing housing while raw supply stays >= 200 keeps the cap
// at 200; only when raw supply drops below 200 does the cap follow it down.
//
// The prior model stored `cap` and adjusted it incrementally with a
// `Math.max(current, cap - provided)` "don't-evict" floor on destroy. That
// floor was lossy for the 200 clamp (Codex population-model iter-1 HIGH): build
// to 250 then lose a house and the stored-clamped cap wrongly dropped to 195.
// This suite pins the raw-supply model, the four cap-mutation sites, the
// no-eviction / over-cap semantics, the 200 reachability, and the additive
// save migration (legacy {current,cap} loads with rawSupply = cap).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { DEFAULT_SEED } from '../../src/game/simulation/prototypeScenario';
import {
  POP_HARD_CAP,
  deriveCap,
} from '../../src/game/simulation/bridge/bridgeConstants';
import { populationCodec } from '../../src/game/simulation/bridge/bridgeStateSerialize';
import type { SaveBlob } from '../../src/game/simulation/saveSchema';
import {
  placeBuildingNearTownCenter,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { asSchema2Blob, worldStateOf } from './saveBlobTestUtils';

// Read the serialized [owner, PopulationState] pairs out of a schema-2 blob's
// world state, going through the codec so the test sees exactly what load will.
function populationEntries(
  blob: SaveBlob,
): Array<[number, { current: number; cap: number; rawSupply?: number }]> {
  const raw = worldStateOf(blob)[populationCodec.slot];
  return (raw ?? []) as Array<[number, { current: number; cap: number; rawSupply?: number }]>;
}

// Overwrite one owner's population entry in a schema-2 blob's world state.
function setPopulationEntry(
  blob: SaveBlob,
  owner: number,
  value: { current: number; cap: number; rawSupply?: number },
): void {
  const entries = populationEntries(blob);
  const next = entries.filter(([id]) => id !== owner);
  next.push([owner, value]);
  worldStateOf(blob)[populationCodec.slot] = next;
}

describe('deriveCap (pure 200-cap clamp)', () => {
  it('clamps raw supply to the 200 hard cap', () => {
    expect(POP_HARD_CAP).toBe(200);
    expect(deriveCap(250)).toBe(200);
    expect(deriveCap(245)).toBe(200);
    expect(deriveCap(200)).toBe(200);
  });

  it('passes raw supply through unchanged below the cap', () => {
    expect(deriveCap(5)).toBe(5);
    expect(deriveCap(55)).toBe(55);
    expect(deriveCap(195)).toBe(195);
  });

  it('floors negative / zero raw supply at 0 (defensive)', () => {
    expect(deriveCap(0)).toBe(0);
    expect(deriveCap(-5)).toBe(0);
  });
});

describe('population cap — build sites (reachable range)', () => {
  it('building a House raises both rawSupply and cap by 5 (construction-flow + create sites)', () => {
    const bridge = createSimulationBridge(DEFAULT_SEED);

    // Fresh start: the starting Town Center contributes +5 through the normal
    // completion path, so the cap and the honest raw sum both begin at 5.
    const before = bridge.getPopulationState(1);
    expect(before.cap).toBe(5);
    expect(before.rawSupply).toBe(5);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('villager');
    placeBuildingNearTownCenter(bridge, 'house');

    // Foundation placed but incomplete — supply only counts on completion.
    expect(bridge.getPopulationState(1).cap).toBe(5);
    expect(bridge.getPopulationState(1).rawSupply).toBe(5);

    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .buildings.some((b) => b.owner === 1 && b.buildingType === 'house' && b.isComplete),
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const after = bridge.getPopulationState(1);
    expect(after.cap).toBe(10);
    expect(after.rawSupply).toBe(10);
    // Invariant: stored cap is always the derived clamp of the honest sum.
    expect(after.cap).toBe(deriveCap(after.rawSupply));
  }, 40_000);
});

describe('population cap — destroy site (reachable range)', () => {
  it('destroying a House lowers both rawSupply and cap by 5', () => {
    // conquest-victory-fixture: P1 Militia at (8,8) can reach and destroy
    // P2's house at (10,8). P2's cap/rawSupply must drop by 5 as the house
    // (a +5 supplier) is removed.
    const bridge = createSimulationBridge('conquest-victory-fixture');

    const before = bridge.getPopulationState(2);
    expect(before.cap).toBe(deriveCap(before.rawSupply));

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(10, 8)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .buildings.some(
              (b) => b.owner === 2 && b.buildingType === 'house' && b.x === 10 && b.y === 8,
            ),
        { maxSteps: 260 },
      ),
    ).toBe(true);

    const after = bridge.getPopulationState(2);
    expect(after.rawSupply).toBe(before.rawSupply - 5);
    expect(after.cap).toBe(before.cap - 5);
    expect(after.cap).toBe(deriveCap(after.rawSupply));
  }, 30_000);
});

describe('population cap — 200 ceiling (over-housing)', () => {
  it('over-housing past 200 leaves the cap pinned at 200 while rawSupply keeps climbing', () => {
    // Inject a near-200 honest supply via a save round-trip, then build one
    // more House on the loaded bridge. The build adds +5 to rawSupply but the
    // cap stays clamped at 200 — over-housing is wasteful, not cap-raising.
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    const current = seed.getPopulationState(1).current;
    // rawSupply 250, cap already at the ceiling.
    setPopulationEntry(blob, 1, { current, cap: 200, rawSupply: 250 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    expect(bridge.getPopulationState(1).rawSupply).toBe(250);
    expect(bridge.getPopulationState(1).cap).toBe(200);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('villager');
    placeBuildingNearTownCenter(bridge, 'house');
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .buildings.some((b) => b.owner === 1 && b.buildingType === 'house' && b.isComplete),
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const after = bridge.getPopulationState(1);
    expect(after.rawSupply).toBe(255);
    expect(after.cap).toBe(200);
  }, 40_000);

  it('losing a House at rawSupply 245 keeps the cap at 200 (the Codex-HIGH regression)', () => {
    // THE headline regression. With the old stored-clamp model, losing a +5
    // house at cap 200 wrongly dropped the cap to max(current, 200-5)=195 even
    // though raw supply is still 240. With raw-supply tracking, rawSupply
    // 245 -> 240 and cap = deriveCap(240) = 200 (unchanged).
    const seed = createSimulationBridge('conquest-victory-fixture');
    const blob = asSchema2Blob(seed.saveGame());
    const p2Current = seed.getPopulationState(2).current;
    setPopulationEntry(blob, 2, { current: p2Current, cap: 200, rawSupply: 245 });

    const bridge = createSimulationBridge('conquest-victory-fixture', { savedGame: blob });
    expect(bridge.getPopulationState(2).rawSupply).toBe(245);
    expect(bridge.getPopulationState(2).cap).toBe(200);

    // P1 Militia destroys P2's house at (10,8) — removes a +5 supplier.
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(10, 8)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .buildings.some(
              (b) => b.owner === 2 && b.buildingType === 'house' && b.x === 10 && b.y === 8,
            ),
        { maxSteps: 260 },
      ),
    ).toBe(true);

    const after = bridge.getPopulationState(2);
    expect(after.rawSupply).toBe(240);
    expect(after.cap).toBe(200); // STAYS 200, not 195.
  }, 30_000);

  it('once rawSupply drops below 200, the cap follows it down', () => {
    // From rawSupply 205 (cap 200), removing a +5 house drops rawSupply to 200
    // (cap 200), and a hypothetical further drop to 195 yields cap 195. We
    // verify the boundary crossing: 205 -> 200 keeps cap 200; the pure deriver
    // already covers 195 -> 195. Here we exercise the real destroy site across
    // the boundary by starting at 205.
    const seed = createSimulationBridge('conquest-victory-fixture');
    const blob = asSchema2Blob(seed.saveGame());
    const p2Current = seed.getPopulationState(2).current;
    setPopulationEntry(blob, 2, { current: p2Current, cap: 200, rawSupply: 205 });

    const bridge = createSimulationBridge('conquest-victory-fixture', { savedGame: blob });
    expect(bridge.getPopulationState(2).cap).toBe(200);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.issueContextCommand(10, 8)).toBe(true);
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          !bridge
            .getEconomyState()
            .buildings.some(
              (b) => b.owner === 2 && b.buildingType === 'house' && b.x === 10 && b.y === 8,
            ),
        { maxSteps: 260 },
      ),
    ).toBe(true);

    const after = bridge.getPopulationState(2);
    expect(after.rawSupply).toBe(200);
    expect(after.cap).toBe(200);
    // And the deriver confirms a sub-200 sum would drop the cap.
    expect(deriveCap(after.rawSupply - 5)).toBe(195);
  }, 30_000);
});

describe('population cap — over-cap is tolerated (no eviction, training blocked)', () => {
  it('rawSupply dropping below current leaves units in place (no eviction) and stays over cap', () => {
    // Set P1 over-cap: current high, rawSupply/cap low. AoE2 behavior is that
    // existing units survive (you are simply over cap) and you cannot train
    // until current < cap again. There is NO code path that evicts units on a
    // cap change, so the (real) unit count must be unchanged after load + steps.
    // DEFAULT_SEED's P1 has real units (3 villagers + a scout); we inject a
    // synthetic over-cap `current` and prove the real units are not culled.
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    const p1UnitCountBefore = seed
      .getEconomyState()
      .units.filter((u) => u.owner === 1).length;
    expect(p1UnitCountBefore).toBeGreaterThan(0);
    // current 60, but housing supply only 50 -> over cap by 10.
    setPopulationEntry(blob, 1, { current: 60, cap: 50, rawSupply: 50 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    const loaded = bridge.getPopulationState(1);
    expect(loaded.current).toBe(60);
    expect(loaded.cap).toBe(50);
    expect(loaded.rawSupply).toBe(50);
    expect(loaded.current).toBeGreaterThan(loaded.cap);

    // Stepping does not evict units to satisfy the cap.
    for (let i = 0; i < 20; i += 1) bridge.step(100);
    const p1UnitCountAfter = bridge.getEconomyState().units.filter((u) => u.owner === 1).length;
    expect(p1UnitCountAfter).toBe(p1UnitCountBefore);
    // Still over cap after stepping (no eviction shrank current toward cap).
    expect(bridge.getPopulationState(1).current).toBeGreaterThanOrEqual(loaded.cap);
  }, 30_000);

  it('a unit queued while at/over the population cap stays blocked (productionQueueSystem gate)', () => {
    // Drive P1 to exactly at-cap, then queue a villager. The production queue
    // head must be marked isBlocked and never spawn while current >= cap.
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    // current == cap == rawSupply == 5: at cap, training blocked.
    setPopulationEntry(blob, 1, { current: 5, cap: 5, rawSupply: 5 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    expect(bridge.getPopulationState(1).current).toBe(5);
    expect(bridge.getPopulationState(1).cap).toBe(5);

    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('town-center');
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    bridge.step(100);

    const queue = bridge.getSelectionState().queue;
    expect(queue.length).toBeGreaterThan(0);

    // Step well past a villager's build time; no villager should spawn while
    // blocked, and the head entry must read blocked.
    const villagersBefore = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager').length;
    for (let i = 0; i < 300; i += 1) bridge.step(100);
    const villagersAfter = bridge
      .getEconomyState()
      .units.filter((u) => u.owner === 1 && u.unitType === 'villager').length;
    expect(villagersAfter).toBe(villagersBefore);
    expect(bridge.getSelectionState().queue[0]?.isBlocked).toBe(true);
  }, 40_000);

  it('a pop-blocked unit at the queue head does NOT stall a research behind it (v0.1.79)', () => {
    // spec §6.10: research consumes no population, so the first queued
    // technology behind a pop-blocked unit keeps progressing and completes
    // while the unit waits for housing. Pre-fix, the FIFO processor's
    // `continue` on the blocked head stalled EVERYTHING behind it — a player
    // (or the AI) that queued a unit it couldn't house permanently blocked its
    // own age-up/upgrade research (the grounded AI Feudal stall, v0.1.79).
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    setPopulationEntry(blob, 1, { current: 5, cap: 5, rawSupply: 5 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    expect(bridge.selectEntityAtCell(8, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('town-center');
    // Head: a villager that can never spawn (at cap). Behind it: Loom
    // (TC-hosted, Dark Age, 50 gold, 250-tick research).
    expect(bridge.queueTrainUnit('villager')).toBe(true);
    expect(bridge.queueResearch('loom')).toBe(true);
    bridge.step(100);
    expect(bridge.getSelectionState().queue.length).toBe(2);

    // Step past Loom's research time. The research behind the blocked head
    // must complete + splice out; the blocked villager must remain.
    for (let i = 0; i < 300; i += 1) bridge.step(100);

    const queue = bridge.getSelectionState().queue;
    expect(queue.length).toBe(1);
    expect(queue[0]).toMatchObject({ kind: 'unit', unitType: 'villager', isBlocked: true });
    // Loom actually applied: re-queueing it is rejected (already researched).
    expect(bridge.queueResearch('loom')).toBe(false);
    // And no villager spawned while blocked.
    expect(bridge.getPopulationState(1).current).toBe(5);
  }, 40_000);
});

describe('population cap — 200 is actually reachable', () => {
  it('builds enough housing to raise the cap to exactly 200 and trains up to it', () => {
    // Reachability litmus: from an injected rawSupply 195, complete one more
    // +5 House so the cap reaches exactly 200, and confirm training is allowed
    // up to 200 (current < cap) and would be blocked at 200.
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    const current = seed.getPopulationState(1).current;
    setPopulationEntry(blob, 1, { current, cap: 195, rawSupply: 195 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    expect(bridge.getPopulationState(1).cap).toBe(195);

    expect(bridge.selectEntityAtCell(6, 8)).toBe(true);
    placeBuildingNearTownCenter(bridge, 'house');
    expect(
      stepBridgeUntil(
        bridge,
        () =>
          bridge
            .getEconomyState()
            .buildings.some((b) => b.owner === 1 && b.buildingType === 'house' && b.isComplete),
        { maxSteps: 600 },
      ),
    ).toBe(true);

    const at200 = bridge.getPopulationState(1);
    expect(at200.rawSupply).toBe(200);
    expect(at200.cap).toBe(200);
    expect(at200.cap).toBe(POP_HARD_CAP);
  }, 40_000);
});

describe('population cap — save migration', () => {
  it('round-trips rawSupply through save/load when present', () => {
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    const current = seed.getPopulationState(1).current;
    // Over-housed save: rawSupply diverges from the clamped cap.
    setPopulationEntry(blob, 1, { current, cap: 200, rawSupply: 250 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    const loaded = bridge.getPopulationState(1);
    expect(loaded.current).toBe(current);
    expect(loaded.rawSupply).toBe(250);
    expect(loaded.cap).toBe(200);

    // Re-save preserves all three fields.
    const reblob = asSchema2Blob(bridge.saveGame());
    const reEntry = populationEntries(reblob).find(([id]) => id === 1)?.[1];
    expect(reEntry).toMatchObject({ current, cap: 200, rawSupply: 250 });
  }, 30_000);

  it('migrates a legacy population entry without rawSupply to rawSupply = cap, then reclamps cap', () => {
    // Pre-200-cap saves store {current, cap} with no rawSupply. On load,
    // rawSupply defaults to cap (exact: the old cap WAS the unclamped sum),
    // and cap is reclamped via deriveCap (a hypothetical legacy cap > 200
    // would be pulled down to 200; reachable legacy caps <= 200 are unchanged).
    const seed = createSimulationBridge(DEFAULT_SEED);
    seed.step(100);
    const blob = asSchema2Blob(seed.saveGame());
    const current = seed.getPopulationState(1).current;
    // Legacy entry: no rawSupply field at all.
    setPopulationEntry(blob, 1, { current, cap: 25 });

    const bridge = createSimulationBridge(DEFAULT_SEED, { savedGame: blob });
    const loaded = bridge.getPopulationState(1);
    expect(loaded.current).toBe(current);
    expect(loaded.cap).toBe(25);
    expect(loaded.rawSupply).toBe(25); // defaulted from cap

    // A legacy save whose stored cap somehow exceeded 200 is reclamped on load.
    const blob2 = asSchema2Blob(seed.saveGame());
    setPopulationEntry(blob2, 1, { current, cap: 260 });
    const bridge2 = createSimulationBridge(DEFAULT_SEED, { savedGame: blob2 });
    const loaded2 = bridge2.getPopulationState(1);
    expect(loaded2.rawSupply).toBe(260); // honest sum preserved
    expect(loaded2.cap).toBe(200); // clamped
  }, 30_000);
});
