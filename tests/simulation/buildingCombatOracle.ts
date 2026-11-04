// The DE oracle for a hit on a building (work 140): spec §10.1's formula over
// the pinned fixture tests/content/fixtures/deBuildingCombat.json, and
// nothing from the runtime's tables. buildingDamageCensus.test.ts and
// buildingDamagePaths.test.ts both judge the game against it.

import { readFileSync } from 'node:fs';

import type { AgeType, BuildingType, UnitType } from '../../src/game/simulation/types';
import { DE_ATTACK_DAMAGE_REFERENCE } from '../content/deAttackDamageReference';

interface Fixture {
  technologies: {
    masonry: { melee: number; pierce: number; classArmor: Record<string, number>; unitClasses: number[] };
    sappers: { unitClasses: number[]; classAttack: Record<string, number> };
    siegeEngineers: {
      times12: { unitClasses: number[]; sourceIds: number[]; classes: number[] };
      times14: Array<{ sourceIds: number[]; classes: number[] }>;
    };
  };
  bonuses: {
    goths: { unitClasses: number[]; classAttackPerAge: Record<string, number[]> };
    saracensTeam: { unitClasses: number[]; class: number; amount185872: number };
    hindustanisTeam: { sourceIds: number[]; class: number; amount: number };
  };
  buildings: Array<{ id: BuildingType; deUnitClass: number; meleePierceByAge: Array<[number, number]>; classArmor: Record<string, number> }>;
  upgrades: Array<{ building: BuildingType; technology: string; meleePierce: [number, number]; classArmor: Record<string, number> }>;
  units: Array<{
    id: UnitType;
    sourceId: number;
    deUnitClass: number;
    classAttack: Record<string, number>;
    otherFamilyAttack?: { family: 'melee' | 'pierce'; amount: number };
  }>;
}

export const DE_BUILDING_COMBAT = JSON.parse(
  readFileSync('tests/content/fixtures/deBuildingCombat.json', 'utf8'),
) as Fixture;

export const ORACLE_AGES: readonly AgeType[] = ['dark-age', 'feudal-age', 'castle-age', 'imperial-age'];

/** The attacker's owner, as the oracle reads it. `side` is a civilization on
 *  the attacker's side, the owner's own included, for the team bonuses. */
export interface OracleOwner {
  readonly techs: readonly string[];
  readonly civilization?: string;
  readonly side?: readonly string[];
}

export interface OracleArmor {
  melee: number;
  pierce: number;
  classes: Record<string, number>;
}

export function oracleBuildingArmor(buildingId: BuildingType, age: AgeType, techs: ReadonlySet<string>): OracleArmor {
  const row = DE_BUILDING_COMBAT.buildings.find((b) => b.id === buildingId);
  if (!row) throw new Error(`the DE fixture has no building ${buildingId}`);
  let [melee, pierce] = row.meleePierceByAge[ORACLE_AGES.indexOf(age)]!;
  let classes: Record<string, number> = { ...row.classArmor };
  for (const upgrade of DE_BUILDING_COMBAT.upgrades) {
    if (upgrade.building !== buildingId || !techs.has(upgrade.technology)) continue;
    [melee, pierce] = upgrade.meleePierce;
    classes = { ...upgrade.classArmor };
  }
  const masonry = DE_BUILDING_COMBAT.technologies.masonry;
  if (masonry.unitClasses.includes(row.deUnitClass)) {
    for (const tech of ['masonry', 'architecture']) {
      if (!techs.has(tech)) continue;
      melee += masonry.melee;
      pierce += masonry.pierce;
      for (const [cls, amount] of Object.entries(masonry.classArmor)) classes[cls] = (classes[cls] ?? 0) + amount;
    }
  }
  return { melee, pierce, classes };
}

export function oracleClassAttacks(unitId: UnitType, age: AgeType, owner: OracleOwner): Record<string, number> {
  const unit = DE_BUILDING_COMBAT.units.find((u) => u.id === unitId);
  if (!unit) throw new Error(`the DE fixture has no attacker ${unitId}`);
  const { technologies, bonuses } = DE_BUILDING_COMBAT;
  const classes: Record<string, number> = { ...unit.classAttack };
  const add = (cls: string | number, amount: number): void => {
    if (amount) classes[String(cls)] = (classes[String(cls)] ?? 0) + amount;
  };
  const techs = new Set(owner.techs);
  const side = new Set([...(owner.side ?? []), ...(owner.civilization ? [owner.civilization] : [])]);
  if (techs.has('sappers') && technologies.sappers.unitClasses.includes(unit.deUnitClass)) {
    for (const [cls, amount] of Object.entries(technologies.sappers.classAttack)) add(cls, amount);
  }
  if (owner.civilization === 'Goths' && bonuses.goths.unitClasses.includes(unit.deUnitClass)) {
    for (const [cls, perAge] of Object.entries(bonuses.goths.classAttackPerAge)) add(cls, perAge[ORACLE_AGES.indexOf(age)]!);
  }
  if (side.has('Saracens') && bonuses.saracensTeam.unitClasses.includes(unit.deUnitClass)) {
    add(bonuses.saracensTeam.class, bonuses.saracensTeam.amount185872);
  }
  // This game's Indians are DE's Hindustanis.
  if (side.has('Indians') && bonuses.hindustanisTeam.sourceIds.includes(unit.sourceId)) {
    add(bonuses.hindustanisTeam.class, bonuses.hindustanisTeam.amount);
  }
  if (techs.has('siege-engineers')) {
    const scale = (factor: number, which: number[]): void => {
      for (const cls of which) {
        const amount = classes[String(cls)];
        if (amount !== undefined) classes[String(cls)] = amount * factor;
      }
    };
    const se = technologies.siegeEngineers;
    if (se.times12.unitClasses.includes(unit.deUnitClass) || se.times12.sourceIds.includes(unit.sourceId)) scale(1.2, se.times12.classes);
    for (const entry of se.times14) if (entry.sourceIds.includes(unit.sourceId)) scale(1.4, entry.classes);
  }
  return classes;
}

/** DE's damage of one hit: `baseAttack` is the attack stat the blow carries. */
export function oracleBuildingDamage(
  unitId: UnitType,
  baseAttack: number,
  buildingId: BuildingType,
  buildingAge: AgeType,
  buildingTechs: ReadonlySet<string>,
  attackerAge: AgeType,
  owner: OracleOwner,
): number {
  const armor = oracleBuildingArmor(buildingId, buildingAge, buildingTechs);
  const family = DE_ATTACK_DAMAGE_REFERENCE[unitId as keyof typeof DE_ATTACK_DAMAGE_REFERENCE].family;
  let total = Math.max(0, baseAttack - (family === 'melee' ? armor.melee : armor.pierce));
  // DE's attack in the other family, where the unit has one (the Scorpion and
  // Chu Ko Nu lines' melee 0), meets that family's armor.
  const other = DE_BUILDING_COMBAT.units.find((u) => u.id === unitId)?.otherFamilyAttack;
  if (other) total += Math.max(0, other.amount - (other.family === 'melee' ? armor.melee : armor.pierce));
  for (const [cls, attack] of Object.entries(oracleClassAttacks(unitId, attackerAge, owner))) {
    const resisted = armor.classes[cls];
    if (resisted !== undefined) total += Math.max(0, attack - resisted);
  }
  return Math.max(1, Math.round(total));
}
