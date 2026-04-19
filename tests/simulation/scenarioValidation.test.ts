import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// Slice 12 Task B: deterministic fixture-validation tests. Each fixture
// seed below is registered in `prototypeScenario.ts` with a known kind
// of invalid spawn, and the expectation is that `createSimulationBridge`
// throws with a scenario-identifying error message before returning.

describe('scenario fixture validation', () => {
  it('accepts the default seed without throwing', () => {
    expect(() => createSimulationBridge()).not.toThrow();
  });

  it('accepts a deliberately-minimal valid fixture', () => {
    expect(() => createSimulationBridge('slice12-validation-ok-fixture')).not.toThrow();
  });

  it('throws when a building spawn extends past the map edge', () => {
    expect(() =>
      createSimulationBridge('slice12-validation-out-of-bounds-fixture'),
    ).toThrowError(/slice12-validation-out-of-bounds-fixture/);
  });

  it('throws when two buildings share a footprint cell', () => {
    expect(() =>
      createSimulationBridge('slice12-validation-overlap-fixture'),
    ).toThrowError(/slice12-validation-overlap-fixture/);
  });

  it('throws when a unit spawn sits inside a building footprint', () => {
    expect(() =>
      createSimulationBridge('slice12-validation-unit-in-building-fixture'),
    ).toThrowError(/slice12-validation-unit-in-building-fixture/);
  });

  it('throws when a resource spawn sits on a building footprint', () => {
    expect(() =>
      createSimulationBridge('slice12-validation-resource-on-building-fixture'),
    ).toThrowError(/slice12-validation-resource-on-building-fixture/);
  });
});
