// Incas "Villagers affected by Blacksmith upgrades" (civilizations.csv): the
// infantry ARMOR line reaches Inca villagers. (The melee ATTACK line already
// reaches every civ's villagers - villagers are melee units, as in AoE2.)

import { describe, it, expect } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { civVillagersTakeInfantryArmor } from '../../src/game/simulation/civBonusEffects';

describe('Inca villager armor (creation via the factory)', () => {
  it('gives an Inca villager the infantry armor line; nobody else', () => {
    expect(civVillagersTakeInfantryArmor('Incas')).toBe(true);
    expect(civVillagersTakeInfantryArmor('Britons')).toBe(false);
    const armorOf = (civ: string): number => {
      const set = new Set(['scale-mail-armor', 'chain-mail-armor']);
      const factory = createCombatStateFactory({
        hasTechnology: (_owner, tech) => set.has(tech),
        getCivilization: () => civ,
        getAge: () => 'castle-age',
      });
      return factory(1, 'villager').armor;
    };
    expect(armorOf('Incas')).toBe(2);
    expect(armorOf('Britons')).toBe(0);
  });
});

describe('Inca villager armor (research sweep, in the world)', () => {
  it('sweeps an existing Inca villager to armor 1 on Scale Mail; a generic villager stays 0', () => {
    for (const [civ, expected] of [['Incas', 1], [undefined, 0]] as const) {
      const bridge = createSimulationBridge('civ-incas-armor-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      const unitOf = (unitType: string) => bridge
        .getEconomyState()
        .units.find((u) => u.owner === 1 && u.unitType === unitType);
      expect(selectOwnedBuildingDirect(bridge, 1, 'blacksmith')).toBe(true);
      expect(bridge.queueResearch('scale-mail-armor')).toBe(true);
      // The owned militia is infantry: its armor flips for every civ when the
      // research lands — the positive completion signal for both runs.
      expect(
        stepBridgeUntil(bridge, () => unitOf('militia')?.armor === 1, { maxSteps: 900 }),
      ).toBe(true);
      expect(unitOf('villager')?.armor).toBe(expected);
    }
  });
});
