// Civilization bonuses against current Definitive Edition, census form (work
// 120; defect register 2026-10-11, "Civilization bonuses the code applied
// differently from Definitive Edition").
//
// SOURCE: the civilization help texts in SiegeEngineers/aoe2techtree
// data/locales/en/strings.json at 3bb43b14 (DE update 185872; the file's
// SHA-256 is pinned in tests/content/fixtures/deProjectileStats.json):
//   Hindustanis, team bonus: "Scout Cavalry-line and Camel Units +2 attack vs. buildings"
//   Saracens, team bonus: "Foot Archers and Skirmishers +2 attack vs. buildings"
//   Goths: "Infantry +1/+2/+3 attack vs. buildings in Feudal/Castle/Imperial Age"
//   Goths: "Hunters carry +15; hunted animals last +20% longer"
//   Aztecs: "Military Units train +15% faster"
//   Incas: "Military Units cost -15/20/25/30% food in Dark/Feudal/Castle/Imperial Age"
//   Mongols: "Hunters work +40% faster"
//   Mayans: "Resources last +15% longer"
// DE's "+N% faster" is a work rate, the time divided by 1 + N/100: DE writes
// Conscription, the Age of Conquerors' x0.75 training time, as "work +33%
// faster".
//
// THE CLASS: a bonus the code applies to other units or resources than DE's
// line names, or more than once. Each test walks the whole population the line
// could reach (every civilization, every trainable unit, every age, every
// resource kind) against an expectation written here from DE's text, not read
// from the table under test.
//
// BOUNDS: pure functions only; civBonusDeParityInMatch.test.ts shows the bridge
// applies them. Which units DE's "Foot Archers", "Infantry" and "Camel Units"
// cover is taken from the team seam and isInfantryUnit, so a line scoped wrong
// there is not caught here; what is caught is a line counted twice or applied
// to the owner alone. DE's "Military Units" is read as every unit but the five
// civilian ones, Monks included. Whether DE's Mayan bonus covers farms is not
// checked; this build excludes them.

import { describe, expect, it } from 'vitest';

import {
  civBuildingAttackBonus,
  civBuildingAttackLadder,
  civCarryBonus,
  civGatherRateMultiplier,
  civResourceDurationMultiplier,
  civTrainTimeMultiplier,
  effectiveTrainingCost,
} from '../../src/game/simulation/civBonusEffects';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { trainingCost } from '../../src/game/simulation/prototypeEconomyRules';
import { isInfantryUnit } from '../../src/game/simulation/prototypeUnitRules';
import { teamBuildingAttackBonus } from '../../src/game/simulation/teamCombatBonuses';
import { TRAINABLE_UNIT_TYPES } from '../../src/game/simulation/trainingCosts';
import type { AgeType, ResearchableTechnologyType, ResourceKind, UnitType } from '../../src/game/simulation/types';

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const NO_TECHS: ReadonlySet<ResearchableTechnologyType> = new Set();

/** Every anti-building bonus the attack delivery adds for an owner on `side`. */
function buildingAttackTotal(civilizations: Map<number, string>, teams: Map<number, number>, unit: UnitType, age: AgeType): number {
  const own = civilizations.get(1);
  return civBuildingAttackBonus(own, unit)
    + civBuildingAttackLadder(own, unit, age)
    + teamBuildingAttackBonus(teams, civilizations, 1, unit);
}

/** DE's owner-only anti-building lines in this roster: the Goth ladder alone. */
function deOwnerOnlyBuildingAttack(civilization: string, unit: UnitType, age: AgeType): number {
  if (civilization !== 'Goths' || !isInfantryUnit(unit)) return 0;
  return { 'dark-age': 0, 'feudal-age': 1, 'castle-age': 2, 'imperial-age': 3 }[age];
}

describe('anti-building lines are counted once', () => {
  it('an owner gets a team line exactly as an ally does, plus its own civilization lines, for every civilization, unit and age', () => {
    const SOLO = new Map<number, number>();
    const ALLIED = new Map([[1, 1], [2, 1]]);
    let nonZero = 0;
    for (const civilization of CIVILIZATION_NAMES) {
      for (const unit of TRAINABLE_UNIT_TYPES) {
        for (const age of AGES) {
          // A Briton, who has no anti-building line of its own, allied to the
          // civilization: what the team lines give a side.
          const asAlly = buildingAttackTotal(new Map([[1, 'Britons'], [2, civilization]]), ALLIED, unit, age);
          const solo = buildingAttackTotal(new Map([[1, civilization]]), SOLO, unit, age);
          expect(solo, `${civilization} ${unit} ${age}`).toBe(asAlly + deOwnerOnlyBuildingAttack(civilization, unit, age));
          if (solo !== 0) nonZero += 1;
        }
      }
    }
    // The census reached the lines it exists for.
    expect(nonZero).toBeGreaterThan(0);
    for (const unit of TRAINABLE_UNIT_TYPES) {
      for (const age of AGES) {
        expect(buildingAttackTotal(new Map([[1, 'Britons']]), SOLO, unit, age), `Britons ${unit}`).toBe(0);
      }
    }
  });

  it('the Hindustani line gives +2 to the Scout line and Camel Units, the owner and an ally alike', () => {
    const SOLO = new Map<number, number>();
    const ALLIED = new Map([[1, 1], [2, 1]]);
    for (const unit of ['scout', 'light-cavalry', 'hussar', 'camel', 'heavy-camel'] as const) {
      expect(buildingAttackTotal(new Map([[1, 'Indians']]), SOLO, unit, 'castle-age'), `Indian ${unit}`).toBe(2);
      expect(buildingAttackTotal(new Map([[1, 'Britons'], [2, 'Indians']]), ALLIED, unit, 'castle-age'), `allied ${unit}`).toBe(2);
    }
    for (const unit of ['knight', 'militia', 'archer', 'villager'] as const) {
      expect(buildingAttackTotal(new Map([[1, 'Indians']]), SOLO, unit, 'castle-age'), `Indian ${unit}`).toBe(0);
    }
  });
});

// DE's civilian units; every other trained unit is one of its "Military Units".
const DE_CIVILIAN_UNITS: ReadonlySet<UnitType> = new Set<UnitType>([
  'villager', 'fishing-ship', 'transport-ship', 'trade-cog', 'trade-cart',
]);

describe('"Military Units" lines reach military units only', () => {
  it('Aztec training is +15% faster (time / 1.15) for every military unit and unchanged for the five civilian ones', () => {
    for (const unit of TRAINABLE_UNIT_TYPES) {
      const expected = DE_CIVILIAN_UNITS.has(unit) ? 1 : 1 / 1.15;
      expect(civTrainTimeMultiplier('Aztecs', unit), unit).toBeCloseTo(expected, 12);
    }
    for (const civilian of DE_CIVILIAN_UNITS) {
      expect(TRAINABLE_UNIT_TYPES, `${civilian} is not trainable`).toContain(civilian);
    }
  });

  it('the Inca food discount follows the same line, in every age', () => {
    const ladder = { 'dark-age': 0.85, 'feudal-age': 0.8, 'castle-age': 0.75, 'imperial-age': 0.7 };
    for (const unit of TRAINABLE_UNIT_TYPES) {
      const baseFood = trainingCost(unit).food;
      for (const age of AGES) {
        const food = effectiveTrainingCost('Incas', age, unit, NO_TECHS).food;
        const expected = baseFood === undefined || DE_CIVILIAN_UNITS.has(unit) ? baseFood : Math.round(baseFood * ladder[age]);
        expect(food, `${unit} ${age}`).toBe(expected);
      }
    }
  });

  it('no other civilization changes training time', () => {
    for (const civilization of CIVILIZATION_NAMES) {
      if (civilization === 'Aztecs') continue;
      for (const unit of TRAINABLE_UNIT_TYPES) {
        expect(civTrainTimeMultiplier(civilization, unit), `${civilization} ${unit}`).toBe(1);
      }
    }
  });
});

// Every resource kind, classified from DE: hunters gather hunted animals; sheep
// are livestock (shepherds); a wolf leaves no food. A new kind fails typecheck
// here until it is classified.
const DE_FOOD_SOURCE: Record<ResourceKind, 'hunted' | 'livestock' | 'other'> = {
  boar: 'hunted',
  deer: 'hunted',
  sheep: 'livestock',
  wolf: 'other',
  fish: 'other',
  'berry-bush': 'other',
  farm: 'other',
  tree: 'other',
  'gold-mine': 'other',
  'stone-mine': 'other',
  relic: 'other',
};
const RESOURCE_KINDS = Object.keys(DE_FOOD_SOURCE) as ResourceKind[];

describe('hunter lines reach every hunted animal', () => {
  it('Mongol hunters work +40% faster, Goth hunters carry +15 and Goth hunted animals last +20% longer, on every hunted kind and nothing else', () => {
    let hunted = 0;
    for (const kind of RESOURCE_KINDS) {
      const isHunted = DE_FOOD_SOURCE[kind] === 'hunted';
      if (isHunted) hunted += 1;
      expect(civGatherRateMultiplier('Mongols', kind), `Mongols ${kind}`).toBe(isHunted ? 1.4 : 1);
      expect(civCarryBonus('Goths', kind), `Goths carry ${kind}`).toBe(isHunted ? 15 : 0);
      expect(civResourceDurationMultiplier('Goths', kind), `Goths duration ${kind}`).toBe(isHunted ? 1.2 : 1);
    }
    expect(hunted).toBe(2);
  });

  it('Mayan natural resources last +15% longer, and no other civilization changes how long a resource lasts', () => {
    for (const kind of RESOURCE_KINDS) {
      if (kind !== 'farm') expect(civResourceDurationMultiplier('Mayans', kind), `Mayans ${kind}`).toBe(1.15);
      for (const civilization of CIVILIZATION_NAMES) {
        if (civilization === 'Mayans' || civilization === 'Goths') continue;
        expect(civResourceDurationMultiplier(civilization, kind), `${civilization} ${kind}`).toBe(1);
      }
    }
  });
});
