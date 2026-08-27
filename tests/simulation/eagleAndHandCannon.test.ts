// Two roster gaps that are whole ANSWERS rather than tiers of an existing line.
//
//   Eagle Warrior -> Elite Eagle Warrior (Barracks)  — the Meso-American
//     civilizations have no cavalry at all, so without the Eagle line they had
//     no fast unit to raid or catch siege with.
//   Hand Cannoneer (Archery Range)                   — the Imperial gunpowder
//     answer to massed infantry, and the only archer-role unit whose damage
//     goes through Skirmisher pierce armour.
//
// Ages, costs and stats are units.csv, which spec §1 ranks above the spec text.
// Chemistry gates the Hand Cannoneer the same way it gates the Bombard Cannon:
// units.csv has no prerequisite column, and AoE2 puts every gunpowder unit
// behind it.

import { describe, it, expect } from 'vitest';

import { UNIT_LINE_UPGRADES } from '../../src/game/simulation/bridge/unitLineUpgrades';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import {
  unitAttackDamage,
  unitMaxHp,
  unitMeleeArmor,
  unitPierceArmor,
} from '../../src/game/simulation/prototypeUnitRules';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { TRAINABLE_UNITS_BY_BUILDING } from '../../src/game/simulation/buildingProductionTables';

describe('the Eagle Warrior line', () => {
  it('upgrades to its Elite tier', () => {
    expect(UNIT_LINE_UPGRADES['elite-eagle-warrior-upgrade']).toEqual({
      from: ['eagle-warrior'],
      to: 'elite-eagle-warrior',
    });
  });

  it('carries units.csv stats, and the Elite tier improves on every one', () => {
    expect(unitMaxHp('eagle-warrior')).toBe(50);
    expect(unitAttackDamage('eagle-warrior')).toBe(7);
    expect(unitMeleeArmor('eagle-warrior')).toBe(0);
    expect(unitPierceArmor('eagle-warrior')).toBe(2);
    expect(trainingCost('eagle-warrior')).toEqual({ food: 20, gold: 50 });

    expect(unitMaxHp('elite-eagle-warrior')).toBe(60);
    expect(unitAttackDamage('elite-eagle-warrior')).toBe(9);
    expect(unitPierceArmor('elite-eagle-warrior')).toBe(4);
    // Same price as the base tier — the Elite upgrade is the whole cost.
    expect(trainingCost('elite-eagle-warrior')).toEqual({ food: 20, gold: 50 });
  });

  it('is offered at the Barracks, so a player can actually train one', () => {
    // v0.3.138: the Eagle line belongs to the mesoamericans alone.
    const bridge = createSimulationBridge('conscription-fixture', {
      civilizationsByOwner: new Map([[1, 'Aztecs'], [2, 'Aztecs']]),
    });
    const barracks = bridge
      .getEconomyState()
      .buildings.find((b) => b.owner === 1 && b.buildingType === 'barracks');
    expect(barracks).toBeDefined();
    bridge.selectEntityById(barracks!.id);
    // Imperial Age with the Elite upgrade unresearched: the menu shows the
    // tier the owner actually has, which is the base one.
    expect(bridge.getSelectionState().trainOptions).toContain('eagle-warrior');
  });
});

describe('the Hand Cannoneer', () => {
  it('carries units.csv stats', () => {
    expect(unitMaxHp('hand-cannoneer')).toBe(35);
    expect(unitAttackDamage('hand-cannoneer')).toBe(17);
    expect(unitPierceArmor('hand-cannoneer')).toBe(0);
    expect(trainingCost('hand-cannoneer')).toEqual({ food: 45, gold: 50 });
  });

  it('is validated as an Archery Range unit', () => {
    // The validator is what stops a crafted command training a unit at the
    // wrong building; the menu is a separate list (see buildingProductionTables).
    expect(TRAINABLE_UNITS_BY_BUILDING.get('archery-range')).toContain('hand-cannoneer');
    expect(TRAINABLE_UNITS_BY_BUILDING.get('barracks')).toContain('eagle-warrior');
    expect(TRAINABLE_UNITS_BY_BUILDING.get('barracks')).toContain('elite-eagle-warrior');
  });
});
