// BOUND: ten fields pinned to dataset3bb43b14; five corroborated by DE185872.
// Literal source values catch CSV and runtime agreeing on stale data. The
// offline fixture's metadata pins verified extraction, not a CI network fetch.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildContentBundle } from '../../scripts/content-lib.mjs';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import { unitAttackDamage, unitMaxHp, unitPierceArmor, unitReloadTicks,
  unitVisionRadius, unitMeleeArmor, attackBonusAgainstUnit } from '../../src/game/simulation/prototypeUnitRules';
import type { UnitType } from '../../src/game/simulation/types';

interface SourceRow {
  id: UnitType; name: string; sourceId: number; displayStringId: number;
  attack: number; meleeArmor: number; pierceArmor: number; lineOfSight: number;
  hitPoints: number; reloadSeconds: number;
}
interface CsvRow {
  id: string; name: string; trainable: boolean; attack: number;
  armor: { melee: number; pierce: number }; lineOfSight: number; hitPoints: number; reloadTime: number;
}
const fixture = JSON.parse(readFileSync('tests/content/fixtures/deSiegeBaseStats.json', 'utf8')) as {
  dataUrl: string; dataSha256: string; stringsUrl: string; stringsSha256: string;
  officialUpdateUrl: string; units: SourceRow[]; unchangedTiers: SourceRow[];
};
const supported: string[] = Object.keys(ALL_UNIT_TYPES).filter(id =>
  id === 'onager' || id === 'battering-ram' || id === 'capped-ram' || id === 'siege-ram' || id === 'heavy-scorpion');
const csv = (buildContentBundle() as { units: CsvRow[] }).units.filter(row => supported.includes(row.id));

function populationErrors(rows: readonly Pick<SourceRow, 'id' | 'name' | 'sourceId'>[]): string[] {
  const expected = [
    ['onager', 'Onager', 550], ['battering-ram', 'Battering Ram', 1258],
    ['capped-ram', 'Capped Ram', 422], ['siege-ram', 'Siege Ram', 548],
    ['heavy-scorpion', 'Heavy Scorpion', 542],
  ];
  return expected.flatMap(([id, name, sourceId]) => {
    const matches = rows.filter(row => row.id === id);
    return matches.length === 1 && matches[0]!.name === name && matches[0]!.sourceId === sourceId
      ? [] : [`Missing, duplicate or wrong source identity: ${String(id)}`];
  }).concat(rows.filter(row => !supported.includes(row.id)).map(row => `Unsupported source identity: ${row.id}`));
}

type Field = 'attack' | 'meleeArmor' | 'pierceArmor' | 'lineOfSight' | 'hitPoints' | 'reloadSeconds';
const changed: Array<{ id: UnitType; field: Field; expected: number }> = [
  { id: 'onager', field: 'attack', expected: 55 },
  { id: 'onager', field: 'pierceArmor', expected: 8 },
  ...(['battering-ram', 'capped-ram', 'siege-ram'] as const).map(id => ({ id, field: 'lineOfSight' as const, expected: 5 })),
  { id: 'heavy-scorpion', field: 'attack', expected: 14 },
  { id: 'heavy-scorpion', field: 'hitPoints', expected: 60 },
  { id: 'heavy-scorpion', field: 'meleeArmor', expected: 1 },
  { id: 'heavy-scorpion', field: 'pierceArmor', expected: 8 },
  { id: 'heavy-scorpion', field: 'reloadSeconds', expected: 3.6 },
];

describe('ten siege base fields match dataset3bb43b14, with five DE185872 corroborations', () => {
  it('pins extraction provenance and all five supported source identities', () => {
    expect(fixture).toMatchObject({
      dataUrl: 'https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/3bb43b14/data/data.json',
      dataSha256: '66a439979afe62f71541cff05280837abfb04e7732e364e2eae2f318862ade6d',
      stringsUrl: 'https://raw.githubusercontent.com/SiegeEngineers/aoe2techtree/3bb43b14/data/locales/en/strings.json',
      stringsSha256: '94f3077c8011ef3e57a2012d9cc7158499257b4c2dc8e5382c77e007249618b3',
    });
    expect(populationErrors(fixture.units)).toEqual([]);
    expect(fixture.units).toHaveLength(5);
    expect(new Set(fixture.units.map(row => row.id))).toEqual(new Set(supported));
    expect(new Set(csv.map(row => row.id))).toEqual(new Set(supported));
    expect(csv.every(row => row.trainable)).toBe(true);
  });

  it('rejects missing, duplicate and rogue source rows', () => {
    expect(populationErrors(fixture.units.slice(1))).toContain('Missing, duplicate or wrong source identity: onager');
    expect(populationErrors([...fixture.units, fixture.units[0]!])).toContain('Missing, duplicate or wrong source identity: onager');
    expect(populationErrors([...fixture.units, { id: 'villager', name: 'Villager', sourceId: 83 }]))
      .toContain('Unsupported source identity: villager');
  });

  for (const { id, field, expected } of changed) {
    it(`${id} ${field}: CSV matches the independent literal source`, () => {
      const source = fixture.units.find(row => row.id === id)!;
      const row = csv.find(candidate => candidate.id === id)!;
      expect(source[field]).toBe(expected);
      expect(row.name).toBe(source.name);
      const actual = field === 'meleeArmor' ? row.armor.melee : field === 'pierceArmor' ? row.armor.pierce
        : field === 'reloadSeconds' ? row.reloadTime : row[field];
      expect(actual).toBe(expected);
    });

    it(`${id} ${field}: runtime matches the independent literal source`, () => {
      expect(fixture.units.find(row => row.id === id)![field]).toBe(expected);
      const actual = field === 'attack' ? unitAttackDamage(id) : field === 'meleeArmor' ? unitMeleeArmor(id)
        : field === 'pierceArmor' ? unitPierceArmor(id) : field === 'lineOfSight' ? unitVisionRadius(id)
          : field === 'hitPoints' ? unitMaxHp(id) : unitReloadTicks(id);
      expect(actual).toBe(field === 'reloadSeconds' ? Math.round(expected * 10) : expected);
    });
  }

  it('preserves Mangonel and Siege Onager and independently sourced combat controls', () => {
    for (const source of fixture.unchangedTiers) {
      expect(unitAttackDamage(source.id)).toBe(source.attack);
      expect(unitPierceArmor(source.id)).toBe(source.pierceArmor);
      expect(unitMaxHp(source.id)).toBe(source.hitPoints);
      expect(unitReloadTicks(source.id)).toBe(source.reloadSeconds * 10);
    }
    expect(unitAttackDamage('hand-cannoneer')).toBe(17);
    expect(unitMaxHp('champion')).toBe(70);
    expect(unitMeleeArmor('champion')).toBe(1);
    expect(attackBonusAgainstUnit('onager', 'champion')).toBe(0);
    expect(attackBonusAgainstUnit('hand-cannoneer', 'onager')).toBe(0);
    for (const source of fixture.units.filter(row => row.id.endsWith('-ram'))) {
      expect(unitAttackDamage(source.id)).toBe(source.attack);
      expect(unitPierceArmor(source.id)).toBe(source.pierceArmor);
      expect(unitMaxHp(source.id)).toBe(source.hitPoints);
      expect(unitReloadTicks(source.id)).toBe(source.reloadSeconds * 10);
    }
  });
});
