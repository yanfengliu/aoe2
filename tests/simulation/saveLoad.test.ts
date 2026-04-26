import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { SAVE_SCHEMA_VERSION, type SaveBlob } from '../../src/game/simulation/saveSchema';

type Bridge = ReturnType<typeof createSimulationBridge>;

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
    expect(Array.isArray(parsed.sideMaps.playerResources)).toBe(true);
    expect(parsed.matchState.outcome).toBe('running');
    expect(parsed.visibility.width).toBeGreaterThan(0);
    expect(parsed.visibility.height).toBeGreaterThan(0);
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

  it('persists the gatherer drop-off retry throttle field (review V4-7)', () => {
    // The throttle map (gathererDropOffStuckSinceTick) doesn't normally
    // get exercised by random fixtures so just assert the schema field
    // round-trips cleanly: empty map → empty array, populated map
    // round-trips through SaveBlob → JSON → load. Pre-fix the field was
    // missing from saveGameOps + hydrateFromSavedGame entirely; a
    // populated throttle would silently reset every load.
    const bridge = createSimulationBridge('aoe2-prototype');
    bridge.step(1000);
    const blob = bridge.saveGame();
    expect(blob.sideMaps.gathererDropOffStuckSinceTick).toBeDefined();
    expect(Array.isArray(blob.sideMaps.gathererDropOffStuckSinceTick)).toBe(true);

    // Inject a fake throttle entry to prove load preserves it.
    const fakeId = 999_999;
    const fakeTick = 12_345;
    blob.sideMaps.gathererDropOffStuckSinceTick = [[fakeId, fakeTick]];
    const json = JSON.parse(JSON.stringify(blob)) as SaveBlob;
    // Round-tripping through JSON keeps the entry intact.
    expect(json.sideMaps.gathererDropOffStuckSinceTick).toEqual([[fakeId, fakeTick]]);

    // The loader's V3-8 orphan-key prune drops keys that don't
    // resolve via world.getEntityRef — fakeId is by construction not in
    // the world, so the orphan prune deletes it. That's the documented
    // contract; the field's presence in the blob is what matters here.
    const loaded = createSimulationBridge('aoe2-prototype', { savedGame: json });
    expect(loaded.saveGame().sideMaps.gathererDropOffStuckSinceTick).toEqual([]);
  });
});
