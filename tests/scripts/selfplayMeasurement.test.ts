// Measurement tools count successful StepReport ticks, not calls or a
// poisoned world's advanced tick counter. Short controlled bridges expose
// both clocks independently; one real failing world checks the refusal path.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceMeasuredTicks, profileTickLabel, profileWorldSeed, requireSampleTicks } from '../../scripts/selfplayMeasurement.mjs';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

type Step = { ticks: number; refusedBecause: string | null; tickDelta: number };
function controlled(reports: Step[], initialTick = 30000, resolved = false) {
  const world = { tick: initialTick };
  let calls = 0;
  return {
    world,
    get calls() { return calls; },
    getMatchState: () => ({ outcome: resolved ? 'won' : 'running' }),
    step() {
      const report = reports[calls++] ?? { ticks: 0, refusedBecause: 'halted', tickDelta: 0 };
      world.tick += report.tickDelta;
      if (report.refusedBecause === 'match-over') resolved = true;
      return { ticks: report.ticks, refusedBecause: report.refusedBecause };
    },
  };
}
afterEach(() => vi.restoreAllMocks());

describe('successful ticks are the measurement denominator', () => {
  it('labels a loaded profile with the saved world seed instead of the CLI default', () => {
    const saved = createSimulationBridge('arena').saveGame();
    const loaded = createSimulationBridge('aoe2-prototype', { savedGame: saved });
    expect(saved.seed).toBe('arena');
    expect(loaded.saveGame().seed).toBe(saved.seed);
    expect(profileWorldSeed(loaded)).toBe('arena');
  });

  it('counts reported successful ticks and returns the actual loaded-world bounds', () => {
    const bridge = controlled(Array.from({ length: 3 }, () => ({ ticks: 1, refusedBecause: null, tickDelta: 1 })));
    const range = advanceMeasuredTicks(bridge, 3);
    expect(range).toMatchObject({ startTick: 30000, endTick: 30003, ticks: 3 });
    expect(profileTickLabel(range)).toBe('ticks 30000..30003');
  });

  for (const reason of ['halted', 'paused', 'replay']) {
    it(`rejects a refused ${reason} step even while the match outcome is running`, () => {
      const bridge = controlled([{ ticks: 0, refusedBecause: reason, tickDelta: 0 }]);
      expect(() => advanceMeasuredTicks(bridge, 5)).toThrow(reason);
      expect(bridge.calls).toBe(1);
    });
  }

  it('does not count a failed tick even when the engine consumed its tick number', () => {
    const bridge = controlled([{ ticks: 0, refusedBecause: 'halted', tickDelta: 1 }]);
    expect(() => advanceMeasuredTicks(bridge, 5)).toThrow('halted');
    expect(bridge.world.tick).toBe(30001);
    expect(bridge.calls).toBe(1);
  });

  it('rejects a report that claims a successful tick without advancing the world', () => {
    const bridge = controlled([{ ticks: 1, refusedBecause: null, tickDelta: 0 }]);
    expect(() => advanceMeasuredTicks(bridge, 1)).toThrow('did not advance exactly one successful tick');
  });

  it('rejects a zero-tick non-refusal instead of looping on it', () => {
    const bridge = controlled([{ ticks: 0, refusedBecause: null, tickDelta: 0 }]);
    expect(() => advanceMeasuredTicks(bridge, 5)).toThrow('did not advance exactly one successful tick');
    expect(bridge.calls).toBe(1);
  });

  it('keeps the successful tick that resolves a match and stops before another call', () => {
    const bridge = controlled([{ ticks: 1, refusedBecause: 'match-over', tickDelta: 1 }]);
    expect(advanceMeasuredTicks(bridge, 5)).toMatchObject({ ticks: 1, startTick: 30000, endTick: 30001 });
    expect(bridge.calls).toBe(1);
  });

  it('rejects an empty profile sample, including a match already resolved by warm-up', () => {
    expect(() => requireSampleTicks(advanceMeasuredTicks(controlled([], 30000, true), 5)))
      .toThrow('did not run any successful ticks');
    expect(() => requireSampleTicks(advanceMeasuredTicks(controlled([]), 0)))
      .toThrow('did not run any successful ticks');
  });

  it('rejects the real bridge after an engine system fails and its outcome remains running', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const bridge = createSimulationBridge('aoe2-prototype');
    bridge.world.registerSystem({ name: 'measurementFailure', phase: 'update', execute() { throw new Error('failed measurement tick'); } });
    expect(() => advanceMeasuredTicks(bridge, 5)).toThrow('halted');
    expect(bridge.getMatchState().outcome).toBe('running');
    expect(bridge.world.tick).toBe(1);
  });
});
