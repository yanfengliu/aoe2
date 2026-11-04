// Building armor and attacks against buildings: Definitive Edition's figures,
// pinned in tests/content/fixtures/deBuildingCombat.json, against the design
// files and against the runtime tables (work 140).
//
// The order matters, as in projectileStats.test.ts: the pinned fixture is
// compared with structures.csv and units.csv first, then the runtime with the
// fixture, so a stale CSV cannot vouch for a stale runtime table.
//
// BOUND: the figures only. That every hit reads them through DE's formula is
// tests/simulation/buildingDamageCensus.test.ts (every attacker, building, age
// and armor technology, the pure seam) and buildingDamagePaths.test.ts (the
// real melee and projectile paths). The per-age melee/pierce rows are DE's
// update 147949 dat (the fixture's versionBound says why that is safe); every
// other value is the pinned 185872 dataset.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { buildingArmor, takesMasonry, type BuildingArmorClass } from '../../src/game/simulation/buildingArmor';
import { UNIT_BUILDING_ATTACKS, UNIT_SECOND_FAMILY_ATTACK } from '../../src/game/simulation/buildingAttack';
import type { ResearchableTechnologyType } from '../../src/game/simulation/technologyTypes';
import type { AgeType, BuildingType, UnitType } from '../../src/game/simulation/types';

interface FixtureBuilding {
  id: BuildingType;
  sourceIds: number[];
  deUnitClass: number;
  meleePierceByAge: Array<[number, number]>;
  classArmor: Record<string, number>;
  ignoredClassArmor: Record<string, number>;
}
interface FixtureUpgrade {
  building: BuildingType;
  technology: ResearchableTechnologyType;
  meleePierce: [number, number];
  classArmor: Record<string, number>;
}
interface FixtureUnit {
  id: UnitType;
  sourceId: number;
  classAttack: Record<string, number>;
  ignoredClassAttack: Record<string, number>;
  otherFamilyAttack?: { family: 'melee' | 'pierce'; amount: number };
}
const fixture = JSON.parse(readFileSync('tests/content/fixtures/deBuildingCombat.json', 'utf8')) as {
  dataSha256: string;
  classes: Record<string, string>;
  buildings: FixtureBuilding[];
  upgrades: FixtureUpgrade[];
  units: FixtureUnit[];
};
const projectileFixture = JSON.parse(readFileSync('tests/content/fixtures/deProjectileStats.json', 'utf8')) as { dataSha256: string };

const AGES: AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const CSV_AGE: Record<string, number> = { Dark: 0, Feudal: 1, Castle: 2, Imperial: 3 };
// The class ids the fixture keys by, and the CSV tokens that name them.
const CLASS_OF_ID: Record<string, BuildingArmorClass> = {
  11: 'building', 13: 'stone-defense', 21: 'standard-building', 22: 'wall-and-gate', 26: 'castle',
};
const STRUCTURE_TOKEN: Record<string, string> = {
  building: '11', 'stone defense': '13', 'standard building': '21', 'walls & gates': '22', castle: '26',
};
const UNIT_TOKEN: Record<string, string> = {
  buildings: '11', 'stone defense': '13', 'standard buildings': '21',
  'walls & gates': '22', 'walls and gates': '22', castle: '26', castles: '26',
};
const STRUCTURE_NAME: Record<string, BuildingType | { building: BuildingType; technology: ResearchableTechnologyType }> = {
  Barracks: 'barracks', Dock: 'dock', Farm: 'farm', 'Fish Trap': 'fish-trap', House: 'house',
  'Lumber Camp': 'lumber-camp', Mill: 'mill', 'Mining Camp': 'mining-camp', 'Town Center': 'town-center',
  'Archery Range': 'archery-range', Blacksmith: 'blacksmith', Market: 'market', Stable: 'stable',
  Castle: 'castle', Monastery: 'monastery', 'Siege Workshop': 'siege-workshop', University: 'university',
  Wonder: 'wonder', Outpost: 'outpost', 'Palisade Wall': 'palisade-wall', 'Palisade Gate': 'palisade-gate',
  Gate: 'stone-gate', 'Stone Wall': 'stone-wall', 'Watch Tower': 'watch-tower', 'Bombard Tower': 'bombard-tower',
  'Fortified Wall': { building: 'stone-wall', technology: 'fortified-wall' },
  'Guard Tower': { building: 'watch-tower', technology: 'guard-tower' },
  Keep: { building: 'watch-tower', technology: 'keep' },
};
const UNIT_NAME_ALIAS: Record<string, string> = { 'scout cavalry': 'scout' };
const slug = (value: string): string => value.trim().toLowerCase().replace(/ /g, '-');
// JSON with every object's keys sorted, so two records compare by content.
const canonical = (value: unknown): string => JSON.stringify(value, (_key, inner: unknown) =>
  inner && typeof inner === 'object' && !Array.isArray(inner)
    ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
    : inner);

function byId(entries: Record<string, number>): Partial<Record<BuildingArmorClass, number>> {
  return Object.fromEntries(Object.entries(entries).map(([id, amount]) => [CLASS_OF_ID[id]!, amount]));
}

function csvRows(path: string): string[][] {
  return readFileSync(path, 'utf8').split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('#'))
    .slice(1)
    .map((line) => line.split(','));
}

const buildings = new Map(fixture.buildings.map((b) => [b.id, b]));

describe('the pinned DE building-combat fixture', () => {
  it('is cut from the same pinned dataset as the other DE fixtures', () => {
    expect(fixture.dataSha256).toBe(projectileFixture.dataSha256);
    expect(fixture.classes).toMatchObject({ 3: 'pierce', 4: 'melee', 11: 'building', 13: 'stone-defense', 21: 'standard-building', 22: 'wall-and-gate', 26: 'castle' });
  });

  it('names a class no attacker here attacks in only where its omission changes no hit', () => {
    // A class-31 attack of 0 against armor of at least 0 adds max(0, 0 - armor) = 0,
    // and no unit here attacks in class 0, 23 or 40 at all.
    const problems: string[] = [];
    for (const unit of fixture.units) {
      for (const [cls, amount] of Object.entries(unit.ignoredClassAttack)) {
        if (cls !== '31' || amount > 0) problems.push(`${unit.id}: attacks class ${cls} for ${amount}`);
      }
    }
    for (const building of fixture.buildings) {
      if ((building.ignoredClassArmor['31'] ?? 0) < 0) problems.push(`${building.id}: class-31 armor ${building.ignoredClassArmor['31']}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('structures.csv armor is the fixture\'s', () => {
  it('holds every row\'s melee/pierce and class armor to DE', () => {
    const problems: string[] = [];
    for (const cols of csvRows('design/stats/structures.csv')) {
      const name = cols[0]!.trim();
      const age = CSV_AGE[cols[2]!.trim()]!;
      const target = STRUCTURE_NAME[name];
      if (target === undefined) { problems.push(`unmapped structure row "${name}"`); continue; }
      const expected = typeof target === 'string'
        ? { meleePierce: buildings.get(target)!.meleePierceByAge[age]!, classArmor: buildings.get(target)!.classArmor }
        : fixture.upgrades.find((u) => u.building === target.building && u.technology === target.technology)!;
      const [melee, pierce] = expected.meleePierce;
      if (cols[7]!.trim() !== `${melee}/${pierce}`) problems.push(`${name} ${cols[2]!.trim()}: armor ${cols[7]!.trim()} vs DE ${melee}/${pierce}`);
      const csvClasses: Record<string, number> = {};
      for (const token of (cols[12] ?? '').split(';').map((t) => t.trim()).filter(Boolean)) {
        const match = /^(.*?)\s+(-?\d+)$/.exec(token);
        const id = match ? STRUCTURE_TOKEN[match[1]!] : undefined;
        if (!match || id === undefined) { problems.push(`${name}: unreadable armor class "${token}"`); continue; }
        csvClasses[id] = Number(match[2]);
      }
      if (canonical(csvClasses) !== canonical(expected.classArmor)) {
        problems.push(`${name} ${cols[2]!.trim()}: armor_classes ${JSON.stringify(csvClasses)} vs DE ${JSON.stringify(expected.classArmor)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('units.csv attacks against buildings are the fixture\'s', () => {
  it('holds every roster unit\'s building-class attacks to DE', () => {
    const perUnit = new Map<string, Record<string, number>>();
    const meleeToken = new Map<string, number>();
    for (const cols of csvRows('design/stats/units.csv')) {
      if (cols.length < 16) continue;
      const raw = cols[0]!.trim().toLowerCase();
      const name = slug(UNIT_NAME_ALIAS[raw] ?? raw);
      meleeToken.delete(name);
      const attacks: Record<string, number> = {};
      for (const part of cols[15]!.split(';')) {
        const match = /^\+?(\d+)\s+(.*)$/.exec(part.trim());
        if (!match) continue;
        const token = match[2]!.trim().toLowerCase();
        // "+180 with siege engineers buildings" restates a ram's attack under
        // Siege Engineers, which the census checks from the base figure.
        if (token.includes('with siege engineers')) continue;
        // "+0 melee" is a second base attack in the melee family.
        if (token === 'melee') { meleeToken.set(name, Number(match[1])); continue; }
        const id = UNIT_TOKEN[token];
        if (id !== undefined) attacks[id] = Number(match[1]);
      }
      perUnit.set(name, attacks); // the last row of a name is the modelled tier
    }
    const problems: string[] = [];
    for (const unit of fixture.units) {
      const csv = perUnit.get(unit.id);
      if (!csv) { problems.push(`${unit.id}: no units.csv row`); continue; }
      if (canonical(csv) !== canonical(unit.classAttack)) {
        problems.push(`${unit.id}: units.csv ${JSON.stringify(csv)} vs DE ${JSON.stringify(unit.classAttack)}`);
      }
      const csvMelee = meleeToken.get(unit.id);
      const deMelee = unit.otherFamilyAttack?.family === 'melee' ? unit.otherFamilyAttack.amount : undefined;
      if (csvMelee !== deMelee) {
        problems.push(`${unit.id}: units.csv second melee attack ${String(csvMelee)} vs DE ${String(deMelee)}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('the runtime tables are the fixture\'s', () => {
  it('gives every building its DE armor in every age', () => {
    const problems: string[] = [];
    for (const building of fixture.buildings) {
      AGES.forEach((age, index) => {
        const [melee, pierce] = building.meleePierceByAge[index]!;
        const armor = buildingArmor(building.id, age, new Set());
        const expected = { melee, pierce, classes: byId(building.classArmor) };
        if (canonical(armor) !== canonical(expected)) {
          problems.push(`${building.id} ${age}: ${JSON.stringify(armor)} vs DE ${JSON.stringify(expected)}`);
        }
      });
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('turns a building into DE\'s upgraded unit for Guard Tower, Keep and Fortified Wall', () => {
    for (const upgrade of fixture.upgrades) {
      const techs = new Set<ResearchableTechnologyType>(upgrade.technology === 'keep' ? ['guard-tower', 'keep'] : [upgrade.technology]);
      const [melee, pierce] = upgrade.meleePierce;
      expect(buildingArmor(upgrade.building, 'imperial-age', techs), upgrade.technology)
        .toEqual({ melee, pierce, classes: byId(upgrade.classArmor) });
    }
    // The Fortified Wall's other half, the Fortified Gate, has the Gate's armor (DE unit 488).
    expect(buildingArmor('stone-gate', 'castle-age', new Set(['fortified-wall'])))
      .toEqual(buildingArmor('stone-gate', 'castle-age', new Set()));
  });

  it('reaches Masonry and Architecture exactly to DE\'s unit classes 3 and 52', () => {
    for (const building of fixture.buildings) {
      expect(takesMasonry(building.id), building.id).toBe(building.deUnitClass === 3 || building.deUnitClass === 52);
    }
  });

  it('gives every attacker its DE attacks against the building classes, both ways', () => {
    const problems: string[] = [];
    const inFixture = new Set<string>();
    for (const unit of fixture.units) {
      inFixture.add(unit.id);
      const ours = UNIT_BUILDING_ATTACKS[unit.id] ?? {};
      const expected = byId(unit.classAttack);
      if (canonical(ours) !== canonical(expected)) {
        problems.push(`${unit.id}: runtime ${JSON.stringify(ours)} vs DE ${JSON.stringify(expected)}`);
      }
    }
    for (const unit of Object.keys(UNIT_BUILDING_ATTACKS)) {
      if (!inFixture.has(unit)) problems.push(`${unit}: a runtime row with no DE row`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it("gives every attacker DE's base attack in the other family, where it has one, both ways", () => {
    const problems: string[] = [];
    for (const unit of fixture.units) {
      const ours = UNIT_SECOND_FAMILY_ATTACK[unit.id];
      if (canonical(ours ?? null) !== canonical(unit.otherFamilyAttack ?? null)) {
        problems.push(`${unit.id}: runtime ${JSON.stringify(ours)} vs DE ${JSON.stringify(unit.otherFamilyAttack)}`);
      }
    }
    for (const unit of Object.keys(UNIT_SECOND_FAMILY_ATTACK)) {
      if (!fixture.units.some((u) => u.id === unit)) problems.push(`${unit}: a runtime row with no DE row`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
