// Every hit on a building, as Definitive Edition resolves it (spec §10.1 and
// §10.3, work 140). The one seam: the melee delivery, a shot landing on a
// building and anything that estimates either read `attackOnBuilding` and
// `damageOnBuilding`, against `buildingArmor` (buildingArmor.ts).
//
// DE's damage is per class: an attack's base (melee or pierce) meets the
// building's melee or pierce armor, each of its attacks against a building
// class meets the building's armor in that class, every term is floored at 0,
// an attack in a class the building lacks does nothing, and the hit deals at
// least 1. The attacks below are the pinned DE dataset's (aoe2techtree
// 3bb43b14, update 185872) in the five building classes, held to it and to
// units.csv by tests/content/buildingCombatStats.test.ts. What changes them:
//  - Sappers: villagers +15 Building and +15 Stone Defense (DE effect 321;
//    "Villagers +15 attack vs. buildings").
//  - Siege Engineers (DE effect 375): x1.2 on the Building attack of every
//    siege weapon and the Cannon Galleon line, x1.4 on the Petard's Building,
//    Wall & Gate and Castle attacks and on the Demolition Ship line's Building
//    attack ("+20% attack vs. buildings; Demolition Units +40%"). The base
//    attack is not multiplied.
//  - The Goths' infantry +1/+2/+3 and the Saracen and Hindustani team bonuses
//    land on Standard Building (DE effects 326-328, 409 and 2), so a Wonder,
//    which is no Standard Building, takes none of them.
// Four units carry a base attack in BOTH families: the Scorpion and Chu Ko Nu
// lines have a melee 0 beside their pierce attack, which takes
// max(0, 0 - melee armor) off a building with negative melee armor, 2 off a
// Dark Age House (work 140 review round 0, finding F0).
// DE also carries classes 0 (Wonder), 23 (Gunpowder, on the Bombard Tower), 31
// and 40 on some buildings. No attacker here attacks in 0, 23 or 40, and every
// class-31 attack here is 0 against armor of at least 0, so each would add
// nothing; the content test proves that rather than assuming it.

import { civBuildingAttackLadder } from './civBonusEffects';
import {
  BUILDING_ARMOR_CLASSES,
  type BuildingArmor,
  type BuildingArmorClass,
  type BuildingClassAmounts,
} from './buildingArmor';
import { unitAttackType, type AttackType } from './prototypeUnitRules';
import type { ResearchableTechnologyType } from './technologyTypes';
import type { AgeType, UnitType } from './types';

/** DE's attacks of each unit against the building classes (update 185872);
 *  a unit absent here, or a class absent from its row, attacks in none. */
export const UNIT_BUILDING_ATTACKS: Readonly<Partial<Record<UnitType, BuildingClassAmounts>>> = {
  villager: { building: 3, 'stone-defense': 6 },
  // Infantry: the small +N against Standard Buildings.
  spearman: { 'standard-building': 1 },
  pikeman: { 'standard-building': 1 },
  halberdier: { 'standard-building': 1 },
  'man-at-arms': { 'standard-building': 2 },
  'long-swordsman': { 'standard-building': 3 },
  'two-handed-swordsman': { 'standard-building': 4 },
  champion: { 'standard-building': 4 },
  'jaguar-warrior': { 'standard-building': 2 },
  'elite-jaguar-warrior': { 'standard-building': 2 },
  'woad-raider': { 'standard-building': 2 },
  'elite-woad-raider': { 'standard-building': 3 },
  'throwing-axeman': { 'standard-building': 1 },
  'elite-throwing-axeman': { 'standard-building': 2 },
  huskarl: { 'standard-building': 2 },
  'elite-huskarl': { 'standard-building': 3 },
  samurai: { 'standard-building': 2 },
  'elite-samurai': { 'standard-building': 3 },
  'teutonic-knight': { 'standard-building': 4 },
  'elite-teutonic-knight': { 'standard-building': 4 },
  berserk: { 'standard-building': 2 },
  'elite-berserk': { 'standard-building': 3 },
  'war-wagon': { 'standard-building': 2 },
  'elite-war-wagon': { 'standard-building': 2 },
  // Siege.
  mangonel: { building: 35 },
  onager: { building: 45 },
  'siege-onager': { building: 60 },
  scorpion: { building: 3 },
  'heavy-scorpion': { building: 6 },
  'battering-ram': { building: 150 },
  'capped-ram': { building: 160 },
  'siege-ram': { building: 200 },
  'bombard-cannon': { building: 200, 'stone-defense': 40 },
  trebuchet: { building: 250 },
  petard: { building: 500, 'wall-and-gate': 900, castle: 100 },
  // Ships.
  galley: { building: 6 },
  'war-galley': { building: 6 },
  galleon: { building: 6 },
  'fire-ship': { building: 2 },
  'fast-fire-ship': { building: 3 },
  'demolition-ship': { building: 220 },
  'heavy-demolition-ship': { building: 280 },
  'cannon-galleon': { building: 200 },
  'elite-cannon-galleon': { building: 275 },
  'turtle-ship': { building: 7, 'wall-and-gate': 6, castle: 7 },
  'elite-turtle-ship': { building: 7, 'wall-and-gate': 6, castle: 7 },
  // Unique cavalry built to break buildings.
  tarkan: { building: 8, 'stone-defense': 12, 'wall-and-gate': 8, castle: 10 },
  'elite-tarkan': { building: 10, 'stone-defense': 12, 'wall-and-gate': 10, castle: 10 },
  'war-elephant': { building: 30, 'stone-defense': 30 },
  'elite-war-elephant': { building: 30, 'stone-defense': 30 },
  'elite-conquistador': { building: 2 },
};

/** A unit's base attack in the family other than its own, where DE gives it
 *  one: the Scorpion and Chu Ko Nu lines' melee 0 (the pinned dataset). */
export const UNIT_SECOND_FAMILY_ATTACK: Readonly<Partial<Record<UnitType, { readonly family: AttackType; readonly amount: number }>>> = {
  scorpion: { family: 'melee', amount: 0 },
  'heavy-scorpion': { family: 'melee', amount: 0 },
  'chu-ko-nu': { family: 'melee', amount: 0 },
  'elite-chu-ko-nu': { family: 'melee', amount: 0 },
};

/** Sappers: villagers' attack against buildings (DE effect 321). */
export const SAPPERS_BUILDING_ATTACK: BuildingClassAmounts = { building: 15, 'stone-defense': 15 };

// Siege Engineers' scope, by DE's own lists: unit classes 13 (rams, the
// Mangonel line, the Bombard Cannon), 54 and 51 (the Trebuchet), 55 (the
// Scorpion line) and the Cannon Galleons by id at x1.2; the Petard and the
// Demolition Ships by id at x1.4.
const SIEGE_ENGINEERS_TIMES_1_2 = new Set<UnitType>([
  'battering-ram', 'capped-ram', 'siege-ram',
  'mangonel', 'onager', 'siege-onager', 'bombard-cannon',
  'scorpion', 'heavy-scorpion', 'trebuchet',
  'cannon-galleon', 'elite-cannon-galleon',
]);
const SIEGE_ENGINEERS_TIMES_1_4: ReadonlyMap<UnitType, readonly BuildingArmorClass[]> = new Map([
  ['petard', ['building', 'wall-and-gate', 'castle']],
  ['demolition-ship', ['building']],
  ['heavy-demolition-ship', ['building']],
]);

/** The multiplier Siege Engineers puts on one of the attacker's building-class attacks. */
export function siegeEngineersMultiplier(
  technologies: ReadonlySet<ResearchableTechnologyType>,
  attackerType: UnitType,
  attackClass: BuildingArmorClass,
): number {
  if (!technologies.has('siege-engineers')) return 1;
  if (SIEGE_ENGINEERS_TIMES_1_2.has(attackerType)) return attackClass === 'building' ? 1.2 : 1;
  return SIEGE_ENGINEERS_TIMES_1_4.get(attackerType)?.includes(attackClass) ? 1.4 : 1;
}

/** The attacker's owner, as an attack against a building reads it. */
export interface BuildingAttackerOwner {
  readonly technologies: ReadonlySet<ResearchableTechnologyType>;
  readonly civilization: string | undefined;
  readonly age: AgeType;
  /** The side's team bonus for this unit against Standard Buildings
   *  (`teamBuildingAttackBonus`): the owner's own side included. */
  readonly teamBonus: number;
}

/** One blow or shot against a building, in DE's classes. */
export interface AttackOnBuilding {
  readonly family: AttackType;
  readonly base: number;
  /** A base attack in the other family, which meets that family's armor. */
  readonly second?: { readonly family: AttackType; readonly amount: number };
  readonly classes: BuildingClassAmounts;
}

/** A unit's attack against a building: its attack stat in its own family,
 *  and its building-class attacks under its owner's state. */
export function attackOnBuilding(
  attackerType: UnitType,
  attackDamage: number,
  owner: BuildingAttackerOwner,
): AttackOnBuilding {
  const classes: Partial<Record<BuildingArmorClass, number>> = { ...UNIT_BUILDING_ATTACKS[attackerType] };
  const add = (attackClass: BuildingArmorClass, amount: number): void => {
    if (amount !== 0) classes[attackClass] = (classes[attackClass] ?? 0) + amount;
  };
  if (attackerType === 'villager' && owner.technologies.has('sappers')) {
    for (const attackClass of BUILDING_ARMOR_CLASSES) add(attackClass, SAPPERS_BUILDING_ATTACK[attackClass] ?? 0);
  }
  add('standard-building', civBuildingAttackLadder(owner.civilization, attackerType, owner.age));
  add('standard-building', owner.teamBonus);
  for (const attackClass of BUILDING_ARMOR_CLASSES) {
    const amount = classes[attackClass];
    if (amount === undefined) continue;
    classes[attackClass] = amount * siegeEngineersMultiplier(owner.technologies, attackerType, attackClass);
  }
  const second = UNIT_SECOND_FAMILY_ATTACK[attackerType];
  return { family: unitAttackType(attackerType), base: attackDamage, ...(second ? { second } : {}), classes };
}

/** A building's own arrow, should one ever land on a building: pierce, and no
 *  attack in any building class. */
export function buildingArrowOnBuilding(attackDamage: number): AttackOnBuilding {
  return { family: 'pierce', base: attackDamage, classes: {} };
}

/** DE's damage of one hit on a building (spec §10.1), whole: the sum over the
 *  classes the building has armor in of max(0, attack - armor), at least 1. */
export function damageOnBuilding(attack: AttackOnBuilding, armor: BuildingArmor): number {
  const resist = (family: AttackType): number => (family === 'pierce' ? armor.pierce : armor.melee);
  let total = Math.max(0, attack.base - resist(attack.family));
  if (attack.second) total += Math.max(0, attack.second.amount - resist(attack.second.family));
  for (const attackClass of BUILDING_ARMOR_CLASSES) {
    const amount = attack.classes[attackClass];
    const resisted = armor.classes[attackClass];
    if (amount === undefined || resisted === undefined) continue;
    total += Math.max(0, amount - resisted);
  }
  return Math.max(1, Math.round(total));
}
