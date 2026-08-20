import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  UNIQUE_UNITS_BY_CIVILIZATION,
  uniqueUnitsFor,
} from '../../src/game/simulation/uniqueUnits';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function castleTrainOptions(civilization: string): readonly string[] {
  const bridge = createSimulationBridge('castle-unique-fixture', {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
  expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
  return bridge.getSelectionState().trainOptions;
}

describe('the unique-unit roster', () => {
  it('gives every listed civilization a unit with real stats', () => {
    expect(UNIQUE_UNITS_BY_CIVILIZATION.length).toBeGreaterThanOrEqual(17);
    for (const entry of UNIQUE_UNITS_BY_CIVILIZATION) {
      expect(UNIT_MAX_HP[entry.unitType], entry.unitType).toBeGreaterThan(0);
    }
  });

  it('never gives two civilizations the same unique unit', () => {
    const seen = UNIQUE_UNITS_BY_CIVILIZATION.map((entry) => entry.unitType);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('a Castle trains only its own civilization unique unit', () => {
  it('offers the Jaguar Warrior to the Aztecs', () => {
    expect(castleTrainOptions('Aztecs')).toContain('jaguar-warrior');
  });

  it('does not offer the Jaguar Warrior to the Teutons', () => {
    const teutonOptions = castleTrainOptions('Teutons');
    expect(teutonOptions).not.toContain('jaguar-warrior');
    expect(teutonOptions).toContain('teutonic-knight');
  });

  it('offers each Castle-trained unique unit to exactly one civilization', () => {
    const castleUnits = UNIQUE_UNITS_BY_CIVILIZATION
      .filter((entry) => entry.trainedAt === 'castle');
    expect(castleUnits.length).toBeGreaterThanOrEqual(17);
    for (const entry of castleUnits) {
      expect(castleTrainOptions(entry.civilization), entry.civilization)
        .toContain(entry.unitType);
    }
  });
});

describe('a Dock trains the naval unique units', () => {
  it('offers the Longboat to the Vikings and the Turtle Ship to the Koreans', () => {
    expect(uniqueUnitsFor('Vikings').map((e) => e.unitType)).toContain('longboat');
    expect(uniqueUnitsFor('Koreans').map((e) => e.unitType)).toContain('turtle-ship');
  });

  it('keeps the Longboat out of a Korean dock', () => {
    const bridge: Bridge = createSimulationBridge('naval-castle-age-fixture', {
      civilizationsByOwner: new Map([[1, 'Koreans']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    const options = bridge.getSelectionState().trainOptions;
    expect(options).toContain('turtle-ship');
    expect(options).not.toContain('longboat');
  });
});
