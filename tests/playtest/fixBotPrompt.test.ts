import { describe, expect, it } from 'vitest';
import { buildFixPrompt, sourceFilesForOracle } from '../../src/game/playtest/fixBotPrompt';

describe('fixBotPrompt', () => {
  it('returns the documented heuristic source files for no-pinned-or-oscillating-units', () => {
    const files = sourceFilesForOracle('no-pinned-or-oscillating-units');
    expect(files).toContain('src/game/simulation/bridge/systems/playerCommandsSystem.ts');
    expect(files).toContain('src/game/simulation/worldOccupancy.ts');
    expect(files).toContain('src/game/simulation/worldOccupancyAllocators.ts');
  });

  it('returns the documented heuristic source files for no-tick-failures', () => {
    const files = sourceFilesForOracle('no-tick-failures');
    expect(files).toContain('src/game/simulation/createSimulationBridge.ts');
    expect(files).toContain('src/game/simulation/bridge/systems/aiSystem.ts');
  });

  it('returns an empty list for unknown oracles', () => {
    expect(sourceFilesForOracle('unknown-oracle')).toEqual([]);
  });

  it('builds a prompt with violation, envelope, tick neighborhood, and source files', () => {
    const prompt = buildFixPrompt({
      violation: {
        oracle: 'no-tick-failures',
        severity: 'high',
        tick: 42,
        message: 'boom',
      },
      envelopeJson: '{"stopReason":"engineHalt","seed":"x"}',
      tickNeighborhoodJson: '{}',
      sourceFiles: [{ path: 'a.ts', content: 'export const x = 1;\n' }],
    });
    expect(prompt).toContain('no-tick-failures');
    expect(prompt).toContain('boom');
    expect(prompt).toContain('engineHalt');
    expect(prompt).toContain('a.ts');
    expect(prompt).toContain('export const x = 1;');
    expect(prompt).toMatch(/```diff/);
    expect(prompt).toMatch(/```why/);
  });
});
