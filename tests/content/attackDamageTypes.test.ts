// BOUND: base armor family and contact/projectile role for the present roster,
// independently read from pinned DE class 3/4 attacks. Six non-damaging units
// have no armor family and are not asserted to attack. This does not check
// attack amounts, bonuses, projectile appearance/speed, or blast geometry.
import { describe, expect, it } from 'vitest';
import { firesProjectile, isMeleeUnit, unitAttackType } from '../../src/game/simulation/prototypeUnitRules';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { formationRank } from '../../src/game/simulation/unitFormation';
import type { UnitType } from '../../src/game/simulation/types';
import { DE_ATTACK_DAMAGE_REFERENCE } from './deAttackDamageReference';

describe('DE attack armor family independent of delivery', () => {
  it('covers the entire current roster with independent DE rows', () => {
    expect(Object.keys(DE_ATTACK_DAMAGE_REFERENCE).sort()).toEqual(Object.keys(UNIT_MAX_HP).sort());
    expect(new Set(Object.values(DE_ATTACK_DAMAGE_REFERENCE).map(row => row.id)).size).toBe(93);
  });

  it('uses every damaging unit\'s DE base armor family', () => {
    const problems: string[] = [];
    for (const [name, row] of Object.entries(DE_ATTACK_DAMAGE_REFERENCE)) {
      if (row.family === 'none') continue;
      const actual = unitAttackType(name as UnitType);
      if (actual !== row.family) problems.push(`${name}: ${actual}, DE id ${row.id} uses ${row.family}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('keeps contact role and projectile delivery separate from damage family', () => {
    const problems: string[] = [];
    for (const [name, row] of Object.entries(DE_ATTACK_DAMAGE_REFERENCE)) {
      if (row.family === 'none') continue;
      const type = name as UnitType;
      if (isMeleeUnit(type) !== (row.range === 0)) problems.push(`${name}: wrong contact role`);
      if (firesProjectile(type) !== (row.range > 1)) problems.push(`${name}: wrong projectile delivery`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
    expect(formationRank('huskarl')).toBe(0);
    // Its current base range stays below 5, so it keeps the ordinary shooter
    // rank. Range parity is separate; damage family must not move it forward.
    expect(formationRank('throwing-axeman')).toBe(1);
    expect(formationRank('mameluke')).toBe(1);
    expect(formationRank('mangonel')).toBe(2);
  });
});
