// The off-roster-comment audit's harvest (v0.3.130): three more stat families
// that comments had declared absent while the roster carried the units.
// War elephants take BOTH cavalry and their own class (AoE2 stacks them);
// conquistadors ride, so the Stable rider techs reach them; the scout line's
// anti-monk bonus — its CSV identity — finally lands.

import { describe, expect, it } from 'vitest';

import { armorClassBonus, UNIT_ARMOR_CLASSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { MOUNTED_UNITS } from '../../src/game/simulation/prototypeUnitRules/unitClassSets';

describe('the war-elephant class', () => {
  it('stacks with cavalry under the spear line, as AoE2 does', () => {
    expect(UNIT_ARMOR_CLASSES['war-elephant'].has('war-elephant')).toBe(true);
    expect(UNIT_ARMOR_CLASSES['war-elephant'].has('cavalry')).toBe(true);
    // Halberdier: +32 cavalry + +60 war elephant = +92 on one swing.
    expect(armorClassBonus('halberdier', 'war-elephant')).toBe(92);
    expect(armorClassBonus('pikeman', 'elite-war-elephant')).toBe(69);
    expect(armorClassBonus('spearman', 'war-elephant')).toBe(45);
    expect(armorClassBonus('scorpion', 'war-elephant')).toBe(6);
  });
});

describe('the conquistador rides', () => {
  it('is a mounted unit, so Bloodlines and Husbandry reach it', () => {
    expect(MOUNTED_UNITS.has('conquistador')).toBe(true);
    expect(MOUNTED_UNITS.has('elite-conquistador')).toBe(true);
  });
});

describe('the scout line hunts monks', () => {
  it('carries its CSV anti-monk ladder', () => {
    expect(armorClassBonus('scout', 'monk')).toBe(6);
    expect(armorClassBonus('light-cavalry', 'monk')).toBe(10);
    expect(armorClassBonus('hussar', 'monk')).toBe(12);
  });
});
