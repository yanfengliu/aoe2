// Class-specific ARMOR (units.csv `armor_bonus`, v0.3.135): the defensive
// half of the bonus system. A Cataphract shrugs +12/+16 of incoming
// anti-cavalry (the unit's whole identity), a Turtle Ship's +8/+11 vs ships
// nearly cancels galley-line bonuses, fire/demolition hulls resist +3..+7,
// upgraded rams add +1/+2 ram-class armor — and rams' famous NEGATIVE melee
// armor (-3) makes swordsmen the answer to them. Bonus damage per class is
// max(0, bonus − class armor), summed over matching classes, AoE2's model.

import { describe, expect, it } from 'vitest';

import { armorClassBonus } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { unitMeleeArmor } from '../../src/game/simulation/prototypeUnitRules';

describe('class armor resists class bonuses', () => {
  it('the cataphract shrugs anti-cavalry', () => {
    // Halberdier +32 cavalry vs elite cataphract's +16 cavalry armor = +16.
    expect(armorClassBonus('halberdier', 'elite-cataphract')).toBe(16);
    expect(armorClassBonus('halberdier', 'cataphract')).toBe(20);
    // A plain knight still takes the whole +32.
    expect(armorClassBonus('halberdier', 'knight')).toBe(32);
    // The camel's +18 barely dents an elite cataphract.
    expect(armorClassBonus('heavy-camel', 'elite-cataphract')).toBe(2);
  });

  it('the turtle shell nearly cancels the galley line', () => {
    // Galleon +11 ship vs elite turtle's +11 ship armor (+1 turtle armor
    // with nothing targeting the class) = 0.
    expect(armorClassBonus('galleon', 'elite-turtle-ship')).toBe(0);
    expect(armorClassBonus('galleon', 'turtle-ship')).toBe(3);
    // Fire ships' turtle-class bonus digs past the ship armor separately:
    // +4 ship (vs 11 → 0) +3 turtle (vs the elite's +1 turtle armor → 2).
    expect(armorClassBonus('fast-fire-ship', 'elite-turtle-ship')).toBe(2);
  });

  it('per-class flooring never lets one class armor eat another bonus', () => {
    // Fire ship hull: +5 ships/camel armor. A galley's +8 ship lands 3;
    // its +3 ram (fire ship is no ram) contributes nothing either way.
    expect(armorClassBonus('galley', 'fire-ship')).toBe(3);
  });

  it('rams carry negative melee armor and ram-class armor', () => {
    expect(unitMeleeArmor('battering-ram')).toBe(-3);
    expect(unitMeleeArmor('capped-ram')).toBe(-3);
    expect(unitMeleeArmor('siege-ram')).toBe(-3);
    // Scorpion +1 ram vs capped ram's +1 ram armor = 0; battering takes 1.
    expect(armorClassBonus('scorpion', 'capped-ram')).toBe(0);
    expect(armorClassBonus('scorpion', 'battering-ram')).toBe(1);
  });
});
