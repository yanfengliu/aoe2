import { describe, expect, it } from 'vitest';

import {
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
