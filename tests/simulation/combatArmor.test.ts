import { describe, expect, it } from 'vitest';

import {
  attackBonusAgainstBuilding,
  attackBonusAgainstUnit,
  combatDamageAfterArmor,
  effectiveMeleeArmor,
  effectivePierceArmor,
  unitAttackType,
  unitAttackDamage,
  unitMeleeArmor,
  unitPierceArmor,
} from '../../src/game/simulation/prototypeUnitRules';

// Data-driven combat Slice 1: melee/pierce armor split. Pierce attackers
// (archers, skirmishers, siege, towers) are reduced by the target's PIERCE
// armor; melee attackers (infantry, cavalry, rams) by its melee armor. Values
// come from design/stats/units.csv (the `melee/pierce` armor column).

describe('combatDamageAfterArmor — melee/pierce split', () => {
  it('reduces pierce attacks by pierce armor and melee attacks by melee armor', () => {
    // target has melee armor 2, pierce armor 3
    expect(combatDamageAfterArmor(10, 'pierce', 2, 3)).toBe(7); // 10 - 3
    expect(combatDamageAfterArmor(10, 'melee', 2, 3)).toBe(8); // 10 - 2
  });

  it('floors a connecting hit at 1 damage regardless of armor', () => {
    expect(combatDamageAfterArmor(2, 'pierce', 0, 5)).toBe(1);
    expect(combatDamageAfterArmor(0, 'melee', 9, 0)).toBe(1);
    expect(combatDamageAfterArmor(4, 'pierce', 0, 180)).toBe(1); // arrow vs a ram
  });
});

describe('unitAttackType', () => {
  it('classifies ranged/siege units as pierce and infantry/cavalry/rams as melee', () => {
    expect(unitAttackType('archer')).toBe('pierce');
    expect(unitAttackType('skirmisher')).toBe('pierce');
    expect(unitAttackType('mangonel')).toBe('pierce');
    expect(unitAttackType('knight')).toBe('melee');
    expect(unitAttackType('champion')).toBe('melee');
    expect(unitAttackType('battering-ram')).toBe('melee');
  });
});

describe('unitPierceArmor — from AoE2 data', () => {
  it('gives skirmishers high pierce armor and archers/spearmen none', () => {
    expect(unitPierceArmor('skirmisher')).toBe(3);
    expect(unitPierceArmor('archer')).toBe(0);
    expect(unitPierceArmor('spearman')).toBe(0);
  });

  it('gives rams huge pierce armor and cavalry some', () => {
    expect(unitPierceArmor('battering-ram')).toBe(180);
    expect(unitPierceArmor('knight')).toBe(2);
    expect(unitPierceArmor('paladin')).toBe(3);
  });
});

// Slice 2b-ii: AoE2-accurate armor-CLASS bonus damage (spec §10.1/§10.3). The
// spear line hits ALL cavalry flat (with a separate camel class), values come
// from design/stats/units.csv, and bonuses SUM across every class the target
// is in. Mangonel's anti-infantry is BLAST (deferred to M2), not a bonus.
describe('attackBonusAgainstUnit — AoE2 armor-class bonuses', () => {
  it('spear line hits ALL cavalry flat (CSV values), with a separate camel bonus', () => {
    // Flat vs every cavalry unit — no light/heavy split.
    for (const cav of ['scout', 'light-cavalry', 'knight', 'hussar', 'cavalier', 'paladin'] as const) {
      expect(attackBonusAgainstUnit('spearman', cav)).toBe(15);
      expect(attackBonusAgainstUnit('pikeman', cav)).toBe(22);
      expect(attackBonusAgainstUnit('halberdier', cav)).toBe(32);
    }
    // Camels are a SEPARATE class (not cavalry): the smaller camel bonus.
    expect(attackBonusAgainstUnit('spearman', 'camel')).toBe(7);
    expect(attackBonusAgainstUnit('pikeman', 'heavy-camel')).toBe(11);
    expect(attackBonusAgainstUnit('halberdier', 'camel')).toBe(16);
  });

  it('camels counter cavalry (and camels), at the CSV values', () => {
    expect(attackBonusAgainstUnit('camel', 'knight')).toBe(10);
    expect(attackBonusAgainstUnit('camel', 'camel')).toBe(5);
    expect(attackBonusAgainstUnit('heavy-camel', 'paladin')).toBe(18);
    expect(attackBonusAgainstUnit('heavy-camel', 'heavy-camel')).toBe(9);
  });

  it('skirmishers +3 vs archers and +3 vs spearmen; archer line +vs spearman', () => {
    expect(attackBonusAgainstUnit('skirmisher', 'archer')).toBe(3);
    expect(attackBonusAgainstUnit('skirmisher', 'cavalry-archer')).toBe(3); // archer class
    expect(attackBonusAgainstUnit('skirmisher', 'spearman')).toBe(3); // spearman class
    expect(attackBonusAgainstUnit('crossbowman', 'pikeman')).toBe(3);
    expect(attackBonusAgainstUnit('arbalest', 'spearman')).toBe(3);
    expect(attackBonusAgainstUnit('cavalry-archer', 'spearman')).toBe(2);
    expect(attackBonusAgainstUnit('longbowman', 'halberdier')).toBe(2);
  });

  it('siege units counter siege/rams; mangonel has NO anti-infantry bonus (blast, deferred to M2)', () => {
    expect(attackBonusAgainstUnit('mangonel', 'battering-ram')).toBe(12); // siege class
    expect(attackBonusAgainstUnit('onager', 'siege-ram')).toBe(12); // siege class
    expect(attackBonusAgainstUnit('scorpion', 'siege-ram')).toBe(1); // ram class
    expect(attackBonusAgainstUnit('mangonel', 'militia')).toBe(0); // blast, not a bonus (M2)
    expect(attackBonusAgainstUnit('mangonel', 'villager')).toBe(0);
    // Scout-line anti-monk shipped v0.3.130 (its CSV identity).
    expect(attackBonusAgainstUnit('scout', 'monk')).toBe(6);
    expect(attackBonusAgainstUnit('hussar', 'monk')).toBe(12);
  });

  it('gives no bonus for non-matching pairs', () => {
    expect(attackBonusAgainstUnit('archer', 'militia')).toBe(0);
    expect(attackBonusAgainstUnit('knight', 'archer')).toBe(0);
    expect(attackBonusAgainstUnit('spearman', 'archer')).toBe(0); // archer isn't cavalry
    expect(attackBonusAgainstUnit('spearman', 'militia')).toBe(0); // infantry isn't a spear target
  });

  it('applies the AoE2-accurate siege anti-building bonuses', () => {
    expect(attackBonusAgainstBuilding('battering-ram')).toBe(125);
    expect(attackBonusAgainstBuilding('siege-ram')).toBe(200);
    expect(attackBonusAgainstBuilding('bombard-cannon')).toBe(200);
    expect(attackBonusAgainstBuilding('trebuchet')).toBe(250);
    expect(attackBonusAgainstBuilding('mangonel')).toBe(35);
    expect(attackBonusAgainstBuilding('onager')).toBe(45);
    expect(attackBonusAgainstBuilding('scorpion')).toBe(2);
    expect(attackBonusAgainstBuilding('knight')).toBe(0);
  });
});

describe('unitMeleeArmor + effectiveMeleeArmor — base melee armor', () => {
  it('gives cavalry/champion their base melee armor and most units none', () => {
    expect(unitMeleeArmor('knight')).toBe(2);
    expect(unitMeleeArmor('cavalier')).toBe(2);
    expect(unitMeleeArmor('paladin')).toBe(2);
    expect(unitMeleeArmor('champion')).toBe(1);
    expect(unitMeleeArmor('bombard-cannon')).toBe(2);
    expect(unitMeleeArmor('archer')).toBe(0);
    expect(unitMeleeArmor('spearman')).toBe(0);
    expect(unitMeleeArmor('militia')).toBe(0);
  });

  it('adds the armor-tech bonus on top of base melee armor', () => {
    expect(effectiveMeleeArmor('knight', 0)).toBe(2); // base only
    expect(effectiveMeleeArmor('knight', 2)).toBe(4); // base 2 + 2 barding/mail
    expect(effectiveMeleeArmor('archer', 0)).toBe(0);
  });

  it('makes a knight take less melee damage than a spearman', () => {
    const swordAttack = unitAttackDamage('champion');
    const vsKnight = combatDamageAfterArmor(swordAttack, 'melee', unitMeleeArmor('knight'), 0);
    const vsSpearman = combatDamageAfterArmor(swordAttack, 'melee', unitMeleeArmor('spearman'), 0);
    expect(vsKnight).toBeLessThan(vsSpearman);
  });
});

describe('effectivePierceArmor — base pierce + armor-tech bonus', () => {
  it('adds the armor-tech bonus on top of base pierce armor', () => {
    // Guards the review-found regression: blacksmith armor upgrades (which
    // accumulate in CombatState.armor) must keep reducing pierce damage.
    expect(effectivePierceArmor('archer', 0)).toBe(0); // untouched archer
    expect(effectivePierceArmor('archer', 3)).toBe(3); // +3 padded/leather/ring archer armor
    expect(effectivePierceArmor('knight', 1)).toBe(3); // base 2 + 1 barding
    expect(effectivePierceArmor('skirmisher', 0)).toBe(3); // base only, no techs
  });
});

describe('counter contract: skirmishers resist archer fire', () => {
  it('a skirmisher takes less archer (pierce) damage than a spearman does', () => {
    const archerAttack = unitAttackDamage('archer');
    const vsSkirmisher = combatDamageAfterArmor(
      archerAttack,
      'pierce',
      0,
      unitPierceArmor('skirmisher'),
    );
    const vsSpearman = combatDamageAfterArmor(
      archerAttack,
      'pierce',
      0,
      unitPierceArmor('spearman'),
    );
    expect(vsSkirmisher).toBeLessThan(vsSpearman);
  });
});
