import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { UNIQUE_UNITS_BY_CIVILIZATION } from '../../src/game/simulation/uniqueUnits';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { UNIT_ATTACK_DAMAGE } from '../../src/game/simulation/prototypeUnitRules/statTables';
import {
  UNIT_MELEE_ARMOR,
  UNIT_PIERCE_ARMOR,
} from '../../src/game/simulation/prototypeUnitRules/unitArmorTables';
import { selectOwnedBuildingDirect } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

function castleOptions(civilization: string, scenario: string) {
  const bridge: Bridge = createSimulationBridge(scenario, {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
  expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
  const state = bridge.getSelectionState();
  return { bridge, train: state.trainOptions, research: state.researchOptions };
}

describe('the elite tier', () => {
  it('gives every unique unit an elite version, except the one AoE2 does not', () => {
    for (const entry of UNIQUE_UNITS_BY_CIVILIZATION) {
      // The Missionary is the roster's one elite-less unique unit — AoE2 has
      // no Elite Missionary, so demanding one here would demand an invention.
      if (entry.unitType === 'missionary') {
        expect(entry.elite).toBeUndefined();
        continue;
      }
      expect(entry.elite, entry.unitType).toBeDefined();
    }
  });

  it('never makes an elite worse than its base, and always better somewhere', () => {
    // An upgrade the player pays 1000+ resources for has to be worth it, but
    // "strictly tougher AND harder-hitting" is the wrong claim: the Elite
    // Mangudai keeps 60 HP and buys attack and pierce armour instead, which is
    // faithful. So: no axis regresses, and at least one improves. This still
    // catches a transcription slip that swapped a base and an elite row.
    for (const entry of UNIQUE_UNITS_BY_CIVILIZATION) {
      if (!entry.elite) continue; // The Missionary has no elite tier.
      const [elite] = entry.elite;
      const base = entry.unitType;
      const axes = [
        [UNIT_MAX_HP[elite], UNIT_MAX_HP[base]],
        [UNIT_ATTACK_DAMAGE[elite], UNIT_ATTACK_DAMAGE[base]],
        [UNIT_MELEE_ARMOR[elite], UNIT_MELEE_ARMOR[base]],
        [UNIT_PIERCE_ARMOR[elite], UNIT_PIERCE_ARMOR[base]],
      ];
      for (const [upgraded, original] of axes) {
        expect(upgraded, elite).toBeGreaterThanOrEqual(original);
      }
      expect(axes.some(([upgraded, original]) => upgraded > original), elite).toBe(true);
    }
  });
});

describe('a Castle offers its own elite upgrade', () => {
  it('offers the Elite Jaguar Warrior to the Aztecs in Imperial Age', () => {
    const { research } = castleOptions('Aztecs', 'imperial-castle-fixture');
    expect(research).toContain('elite-jaguar-warrior-upgrade');
  });

  it('never offers another civilization elite upgrade', () => {
    const { research } = castleOptions('Teutons', 'imperial-castle-fixture');
    expect(research).toContain('elite-teutonic-knight-upgrade');
    expect(research).not.toContain('elite-jaguar-warrior-upgrade');
  });

  it('withholds the elite upgrade until Imperial Age', () => {
    const { research } = castleOptions('Aztecs', 'castle-unique-fixture');
    expect(research).not.toContain('elite-jaguar-warrior-upgrade');
  });
});

describe('researching an elite upgrade', () => {
  it('replaces the trainable unit and converts the ones already standing', () => {
    const bridge: Bridge = createSimulationBridge('imperial-castle-fixture', {
      civilizationsByOwner: new Map([[1, 'Aztecs']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.getSelectionState().trainOptions).toContain('jaguar-warrior');
    expect(bridge.queueResearch('elite-jaguar-warrior-upgrade')).toBe(true);

    for (let step = 0; step < 900; step += 1) {
      bridge.step(100);
      if (bridge.getSelectionState().trainOptions.includes('elite-jaguar-warrior')) break;
    }
    const options = bridge.getSelectionState().trainOptions;
    expect(options).toContain('elite-jaguar-warrior');
    expect(options).not.toContain('jaguar-warrior');
  }, 60_000);
});

describe('a naval elite upgrade belongs to the Dock', () => {
  it('offers the Elite Longboat at a Viking Dock, not at their Castle', () => {
    const bridge: Bridge = createSimulationBridge('naval-imperial-fixture', {
      civilizationsByOwner: new Map([[1, 'Vikings']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    expect(bridge.getSelectionState().researchOptions).toContain('elite-longboat-upgrade');

    // The Vikings' OTHER unique unit is the Castle-trained Berserk, so their
    // Castle offers that elite and never the Longboat's.
    const castle = castleOptions('Vikings', 'imperial-castle-fixture');
    expect(castle.research).toContain('elite-berserk-upgrade');
    expect(castle.research).not.toContain('elite-longboat-upgrade');
  });

  it('keeps the Dock elite out of a civilization that has no naval unique unit', () => {
    const bridge: Bridge = createSimulationBridge('naval-imperial-fixture', {
      civilizationsByOwner: new Map([[1, 'Franks']]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
    const options = bridge.getSelectionState().researchOptions;
    expect(options).not.toContain('elite-longboat-upgrade');
    expect(options).not.toContain('elite-turtle-ship-upgrade');
    // The ordinary ship upgrades are still there. Galleon is NOT, because it
    // needs War Galley first and nothing in this fixture has researched it.
    expect(options).toContain('war-galley-upgrade');
    expect(options).not.toContain('galleon-upgrade');
  });
});
