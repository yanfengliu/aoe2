// An upgrade keeps its line's memberships (defect register, 2026-09-26, "The
// Siege Onager, the Capped Ram and the Elite Skirmisher were left out of
// tables that named the rest of their line").
//
// An upgrade replaces a unit with the next tier of the SAME line, and every
// table that names a line has to name every tier. When one leaves a tier out,
// researching the upgrade takes the unit out of the table:
// `upgradeOwnedUnits` rebuilds the upgraded unit's combat state from its new
// type, so a Celt's Onagers lost Furor Celtica's hit points the moment the
// Siege Onager upgrade finished, and the Siege Onager's stone flew at arrow
// speed and was drawn as an arrow.
//
// The claim: for every upgrade in UNIT_LINE_UPGRADES (from -> to), every
// predicate below answers the same for `to` as for `from`. Equality rather
// than "holds for `to` whenever it holds for `from`", because a table that
// leaves out a line's FIRST tier is the same defect and shows only as a
// difference in the other direction.
//
// Bound. It sees a table only through a predicate listed here: the exported
// one-argument unit predicates (NAMED), every unique technology's `applies`,
// every `applies` found by walking CIV_BONUSES, and the civilization-and-age
// bonus functions for every civilization and age. Not seen: the team bonuses
// (teamCombatBonuses.ts, teamProductionBonuses.ts), which take team maps, and
// the Heated Shot target set (buildingTechEffects.ts); the AI's and the menus'
// line lists, one of which, Anarchy's Barracks unlock, named the first tier
// alone until the review of v0.3.239 found it (uniqueTechnologies.test.ts now
// holds it); and presentation tables keyed by every unit type (names, icons),
// which the compiler already forces to hold every tier. Numbers that differ
// between tiers by design — hit points, attack, range, and in some lines
// accuracy and wind-up — are not compared; the Skirmisher line's accuracy and
// wind-up have their own case in projectileRules.test.ts. A unit that is in no
// upgrade (a Trebuchet, a Petard) is not asked.

import { describe, expect, it } from 'vitest';

import { ageScaledUnitHpFactor } from '../../src/game/simulation/ageScaledHp';
import { projectileVisualKind } from '../../src/game/simulation/bridge/projectileProjection';
import { targetPriority } from '../../src/game/simulation/bridge/targetPriority';
import { UNIT_LINE_UPGRADES } from '../../src/game/simulation/bridge/unitLineUpgrades';
import {
  civAttackRangeBonus,
  civBuildingAttackLadder,
  civMeleeArmorBonus,
  civPierceArmorBonus,
  civReloadMultiplier,
} from '../../src/game/simulation/civBonusEffects';
import { CIV_BONUSES } from '../../src/game/simulation/civBonusTable';
import { CIVILIZATION_NAMES } from '../../src/game/simulation/civilizationNames';
import { canCarryRelics, isMonasticUnit } from '../../src/game/simulation/monasticUnits';
import { thumbRingAccuracy } from '../../src/game/simulation/projectileTechEffects';
import {
  canAttackGround,
  firesProjectile,
  isAreaProjectile,
  projectileSpeedTilesPerTick,
} from '../../src/game/simulation/projectileRules';
import {
  detonatesOnAttack,
  isArcherLineUnit,
  isCavalryArcherUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  isMountedUnit,
  isSiegeUnit,
  takesMeleeAttackTechs,
  unitAttackType,
  unitBlastRadius,
  unitMinAttackRange,
} from '../../src/game/simulation/prototypeUnitRules';
import { UNIT_ARMOR_CLASSES } from '../../src/game/simulation/prototypeUnitRules/armorClasses';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import { canBoardTransport } from '../../src/game/simulation/transportShip';
import { EXTRA_UNIT_EFFECTS, UNIQUE_TECHNOLOGIES } from '../../src/game/simulation/uniqueTechnologies';
import { gathersResources, isWaterUnit } from '../../src/game/simulation/unitDomain';
import { regeneratesOnItsOwn } from '../../src/game/simulation/unitRegeneration';
import { isRepairableUnitType } from '../../src/game/simulation/unitRepair';
import { defaultStanceFor } from '../../src/game/simulation/unitStance';
import type { AgeType, UnitType } from '../../src/game/simulation/types';

type Answer = boolean | number | string | null;

interface Membership {
  readonly name: string;
  readonly of: (unitType: UnitType) => Answer;
}

// The four the task named first, then every other exported one-argument
// predicate that sorts units into a class.
const NAMED: readonly Membership[] = [
  { name: 'isAreaProjectile', of: isAreaProjectile },
  { name: 'projectileVisualKind', of: (unitType) => projectileVisualKind(unitType) },
  { name: 'has a minimum range', of: (unitType) => unitMinAttackRange(unitType) > 0 },
  { name: 'projectileSpeedTilesPerTick', of: projectileSpeedTilesPerTick },
  { name: 'firesProjectile', of: firesProjectile },
  { name: 'canAttackGround', of: canAttackGround },
  { name: 'has a blast', of: (unitType) => unitBlastRadius(unitType) > 0 },
  { name: 'isMeleeUnit', of: isMeleeUnit },
  { name: 'unitAttackType', of: unitAttackType },
  { name: 'isArcherLineUnit', of: isArcherLineUnit },
  { name: 'isCavalryArcherUnit', of: isCavalryArcherUnit },
  { name: 'isCavalryUnit', of: isCavalryUnit },
  { name: 'isMountedUnit', of: isMountedUnit },
  { name: 'isInfantryUnit', of: isInfantryUnit },
  { name: 'takesMeleeAttackTechs', of: takesMeleeAttackTechs },
  { name: 'isGunpowderUnit', of: isGunpowderUnit },
  { name: 'isSiegeUnit', of: isSiegeUnit },
  { name: 'detonatesOnAttack', of: detonatesOnAttack },
  { name: 'isWaterUnit', of: isWaterUnit },
  { name: 'gathersResources', of: gathersResources },
  { name: 'canBoardTransport', of: canBoardTransport },
  { name: 'isMonasticUnit', of: isMonasticUnit },
  { name: 'canCarryRelics', of: canCarryRelics },
  { name: 'regeneratesOnItsOwn', of: regeneratesOnItsOwn },
  { name: 'isRepairableUnitType', of: isRepairableUnitType },
  { name: 'defaultStanceFor', of: defaultStanceFor },
  { name: 'targetPriority', of: targetPriority },
  { name: 'armour classes', of: (unitType) => [...UNIT_ARMOR_CLASSES[unitType]].sort().join('+') },
  { name: 'Thumb Ring accuracy', of: (unitType) => thumbRingAccuracy(new Set(['thumb-ring']), unitType) },
];

const UNIQUE: readonly Membership[] = [
  ...UNIQUE_TECHNOLOGIES.flatMap((technology) => (technology.unitEffect
    ? [{ name: `${technology.name} applies`, of: technology.unitEffect.applies }]
    : [])),
  ...Object.entries(EXTRA_UNIT_EFFECTS).flatMap(([id, effect]) => (effect
    ? [{ name: `${id} (second effect) applies`, of: effect.applies }]
    : [])),
];

// Every `applies` inside a civilization's bonus entry, found by walking the
// entry, so a rule added to the table is asked without being listed here.
function hasApplies(value: unknown): value is { applies: (unitType: UnitType) => boolean } {
  return typeof value === 'object' && value !== null
    && typeof (value as { applies?: unknown }).applies === 'function';
}

const CIVILIZATION: readonly Membership[] = CIV_BONUSES.flatMap((entry) =>
  Object.entries(entry).flatMap(([field, value]) =>
    (Array.isArray(value) ? value : [value]).flatMap((rule, index) => (hasApplies(rule)
      ? [{ name: `${entry.civilization} ${field}[${String(index)}] applies`, of: rule.applies }]
      : []))));

const AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];
const BY_CIVILIZATION_AND_AGE = {
  civReloadMultiplier,
  civAttackRangeBonus,
  civPierceArmorBonus,
  civMeleeArmorBonus,
  civBuildingAttackLadder,
  ageScaledUnitHpFactor,
} as const;

const CIVILIZATION_AND_AGE: readonly Membership[] = CIVILIZATION_NAMES.flatMap((civilization) =>
  AGES.flatMap((age) => Object.entries(BY_CIVILIZATION_AND_AGE).map(([name, bonus]) => ({
    name: `${name}(${civilization}, ${age})`,
    of: (unitType: UnitType) => bonus(civilization, unitType, age),
  }))));

const EVERY_MEMBERSHIP = [...NAMED, ...UNIQUE, ...CIVILIZATION, ...CIVILIZATION_AND_AGE];

const UPGRADES = Object.entries(UNIT_LINE_UPGRADES).flatMap(([technology, upgrade]) =>
  (upgrade ? upgrade.from.map((from) => ({ technology, from, to: upgrade.to })) : []));

describe('an upgrade keeps its line\'s memberships', () => {
  it('asks real questions of every upgrade', () => {
    // The instrument first. A census over no upgrades, or over predicates that
    // give every unit the same answer, would pass while checking nothing.
    expect(UPGRADES.length, 'the upgrade table').toBeGreaterThanOrEqual(49);
    const roster = Object.keys(UNIT_MAX_HP) as UnitType[];
    const constant = [...NAMED, ...UNIQUE]
      .filter((membership) => new Set(roster.map(membership.of)).size < 2)
      .map((membership) => membership.name);
    expect(constant, 'predicates that give every unit the same answer check nothing').toEqual([]);
    // Floors at the counts measured on 2026-09-26 (19 and 32), so a walk that
    // stops finding rules goes red rather than quietly asking fewer.
    expect(UNIQUE.length, 'unique technology unit effects').toBeGreaterThanOrEqual(19);
    expect(CIVILIZATION.length, 'civilization bonus rules with an applies').toBeGreaterThanOrEqual(32);
    expect(CIVILIZATION_AND_AGE.length).toBe(CIVILIZATION_NAMES.length * AGES.length * 6);
  });

  it('gives every upgraded unit the answer the unit it replaces had', () => {
    const drops: string[] = [];
    for (const { technology, from, to } of UPGRADES) {
      for (const membership of EVERY_MEMBERSHIP) {
        const before = membership.of(from);
        const after = membership.of(to);
        if (before !== after) {
          drops.push(`${technology}: ${from} -> ${to}: ${membership.name} was ${String(before)}, is ${String(after)}`);
        }
      }
    }
    expect(drops, `an upgrade changed a line membership:\n${drops.join('\n')}`).toEqual([]);
  });
});
