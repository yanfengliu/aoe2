// The eagle armor class (spec §10.2, v0.3.129): AoE2's famous inversion. An
// Eagle Warrior is NOT in the infantry vulnerability class — a Hand
// Cannoneer's +10 infantry does nothing to it — while the swordsman line
// carries explicit anti-eagle bonuses that ARE its answer. Eagles still take
// the infantry TECHS (blacksmith, Squires): upgrade scope and vulnerability
// are different taxonomies, the War Wagon lesson applied again.

import { describe, expect, it } from 'vitest';

import { armorClassBonus, UNIT_ARMOR_CLASSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { isInfantryUnit } from '../../src/game/simulation/prototypeUnitRules';

describe('the eagle vulnerability class', () => {
  it('eagles are eagles, not infantry, to incoming fire', () => {
    expect(UNIT_ARMOR_CLASSES['eagle-warrior'].has('eagle')).toBe(true);
    expect(UNIT_ARMOR_CLASSES['eagle-warrior'].has('infantry')).toBe(false);
    expect(UNIT_ARMOR_CLASSES['elite-eagle-warrior'].has('eagle')).toBe(true);
  });

  it('the swordsman line answers eagles; the hand cannoneer famously does not', () => {
    expect(armorClassBonus('champion', 'eagle-warrior')).toBe(6);
    expect(armorClassBonus('two-handed-swordsman', 'eagle-warrior')).toBe(6);
    expect(armorClassBonus('long-swordsman', 'eagle-warrior')).toBe(4);
    expect(armorClassBonus('man-at-arms', 'eagle-warrior')).toBe(2);
    expect(armorClassBonus('halberdier', 'eagle-warrior')).toBe(1);
    // The inversion: +10 infantry no longer lands on an eagle.
    expect(armorClassBonus('hand-cannoneer', 'eagle-warrior')).toBe(0);
    // Jaguar's +12 eagles applies; its +10 infantry does not stack on one.
    expect(armorClassBonus('jaguar-warrior', 'eagle-warrior')).toBe(12);
  });

  it('eagles keep the infantry TECH scope (blacksmith reaches them)', () => {
    expect(isInfantryUnit('eagle-warrior')).toBe(true);
    expect(isInfantryUnit('elite-eagle-warrior')).toBe(true);
  });

  it('the eagle line itself gains its CSV cavalry/camel/ship bonuses', () => {
    expect(armorClassBonus('eagle-warrior', 'knight')).toBe(2);
    expect(armorClassBonus('elite-eagle-warrior', 'knight')).toBe(4);
    expect(armorClassBonus('elite-eagle-warrior', 'camel')).toBeGreaterThanOrEqual(2);
  });
});
