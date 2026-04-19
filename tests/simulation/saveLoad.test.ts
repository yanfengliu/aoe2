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
});
