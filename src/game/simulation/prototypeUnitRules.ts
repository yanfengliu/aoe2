// Accessor functions over the unit / wildlife stat tables. Tables live
// in `prototypeUnitRules/statTables.ts` so this file stays under 500
// LOC; consumers continue to import from `prototypeUnitRules` since the
// barrel re-exports everything they need.

import { HUMAN_PLAYER_ID } from './prototypeScenario';
import type { ResourceKind, UnitType } from './types';
import { armorClassBonus } from './prototypeUnitRules/armorClasses';
import {
  ARCHER_LINE_UNITS,
  CAVALRY_UNITS,
  INFANTRY_UNITS,
  MELEE_ATTACK_RANGE,
  MELEE_UNITS,
  STATIC_MEMORABLE_RESOURCE_TYPES,
  UNIT_ATTACK_DAMAGE,
  UNIT_ATTACK_RANGE,
  UNIT_MAX_HP,
  UNIT_MELEE_ARMOR,
  UNIT_PIERCE_ARMOR,
  UNIT_MIN_ATTACK_RANGE,
  UNIT_RELOAD_TICKS,
  UNIT_SIZES,
  UNIT_TINTS,
  UNIT_VISION_RADIUS,
  WILDLIFE_PROFILES,
  type WildlifeProfile,
} from './prototypeUnitRules/statTables';

export type { WildlifeProfile } from './prototypeUnitRules/statTables';

export function unitMaxHp(unitType: UnitType): number {
  return UNIT_MAX_HP[unitType];
}

export function unitAttackDamage(unitType: UnitType): number {
  return UNIT_ATTACK_DAMAGE[unitType];
}

// Data-driven combat Slice 1 — melee/pierce armor split.
export type AttackType = 'melee' | 'pierce';

export function unitPierceArmor(unitType: UnitType): number {
  return UNIT_PIERCE_ARMOR[unitType];
}

// Effective pierce armor = the unit's BASE pierce armor plus its accumulated
// armor-tech bonus (`CombatState.armor`, which is base 0 + blacksmith
// upgrades). So padded/leather/ring archer armor, mail armor, and barding keep
// reducing arrow / tower / siege (pierce) damage exactly as they did before the
// melee/pierce split — this slice ADDS base pierce armor without dropping the
// existing tech mitigation. NOTE: until Slice 2 separates melee-tech from
// pierce-tech armor (the CSV armor classes), the single tech bonus applies to
// both melee and pierce, matching the pre-split behaviour.
export function effectivePierceArmor(unitType: UnitType, armorTechBonus: number): number {
  return unitPierceArmor(unitType) + armorTechBonus;
}

export function unitMeleeArmor(unitType: UnitType): number {
  return UNIT_MELEE_ARMOR[unitType];
}

// Effective melee armor = the unit's BASE melee armor (units.csv) plus its
// accumulated armor-tech bonus (`CombatState.armor`, base 0 + blacksmith
// upgrades). Mirror of effectivePierceArmor for the melee side — so the
// cavalry line's base armor (knight/cavalier/paladin 2) and barding/mail techs
// both reduce melee damage. (Slice 2b will split which techs feed melee vs
// pierce; today the single tech bonus feeds both, matching prior behaviour.)
export function effectiveMeleeArmor(unitType: UnitType, armorTechBonus: number): number {
  return unitMeleeArmor(unitType) + armorTechBonus;
}

// A unit's attack deals melee damage if it is a melee unit (infantry, cavalry,
// rams), otherwise pierce (archers, skirmishers, siege, gunpowder). Towers and
// other arrow-firing buildings are pierce too, but they are not units — their
// callers pass 'pierce' directly.
export function unitAttackType(unitType: UnitType): AttackType {
  return isMeleeUnit(unitType) ? 'melee' : 'pierce';
}

// Final damage of one connecting hit: subtract the armor that matches the
// attack type (pierce attacks vs the target's pierce armor, melee vs melee),
// with the AoE2 floor of 1 so any hit that lands still chips at least 1 HP.
export function combatDamageAfterArmor(
  attackTotal: number,
  attackType: AttackType,
  targetMeleeArmor: number,
  targetPierceArmor: number,
): number {
  const armor = attackType === 'pierce' ? targetPierceArmor : targetMeleeArmor;
  return Math.max(1, attackTotal - armor);
}

export function unitReloadTicks(unitType: UnitType): number {
  return UNIT_RELOAD_TICKS[unitType];
}

export function unitAttackRange(unitType: UnitType): number {
  return UNIT_ATTACK_RANGE[unitType];
}

export function unitMinAttackRange(unitType: UnitType): number {
  return UNIT_MIN_ATTACK_RANGE.get(unitType) ?? 0;
}

export function isArcherLineUnit(unitType: UnitType): boolean {
  return ARCHER_LINE_UNITS.has(unitType);
}

export function isWildlifeResourceType(
  resourceType: ResourceKind,
): resourceType is 'boar' | 'wolf' {
  return resourceType === 'boar' || resourceType === 'wolf';
}

export function isStaticMemorableResourceType(
  resourceType: ResourceKind,
): resourceType is 'tree' | 'berry-bush' | 'gold-mine' | 'stone-mine' {
  return STATIC_MEMORABLE_RESOURCE_TYPES.has(resourceType);
}

export function createWildlifeState(resourceType: 'boar' | 'wolf'): WildlifeProfile {
  const profile = WILDLIFE_PROFILES[resourceType];
  return {
    currentHp: profile.maxHp,
    maxHp: profile.maxHp,
    attackDamage: profile.attackDamage,
    attackRange: MELEE_ATTACK_RANGE,
    reloadTicks: profile.reloadTicks,
    cooldownTicks: 0,
    armor: 0,
    autoAggro: profile.autoAggro,
    isAlive: true,
    corpsePersists: profile.corpsePersists,
    aggroRange: profile.aggroRange,
    targetEntityRef: null,
  };
}

export function unitTint(unitType: UnitType, owner: number): number {
  const palette = UNIT_TINTS[unitType];
  return owner === HUMAN_PLAYER_ID ? palette.human : palette.enemy;
}

export function unitSize(unitType: UnitType): number {
  return UNIT_SIZES[unitType];
}

export function unitVisionRadius(unitType: UnitType): number {
  return UNIT_VISION_RADIUS[unitType];
}

export function isCavalryUnit(unitType: UnitType): boolean {
  return CAVALRY_UNITS.has(unitType);
}

export function isInfantryUnit(unitType: UnitType): boolean {
  return INFANTRY_UNITS.has(unitType);
}

export function isGunpowderUnit(unitType: UnitType): boolean {
  return unitType === 'bombard-cannon';
}

export function isMeleeUnit(unitType: UnitType): boolean {
  return MELEE_UNITS.has(unitType);
}

// Slice 2b-ii: the anti-unit attack bonuses now live in the AoE2-accurate
// armor-CLASS model (./prototypeUnitRules/armorClasses.ts) — a declarative
// class taxonomy + cross-class SUMMATION with the CSV bonus VALUES. This stays
// the stable lookup the damage sites call.
export function attackBonusAgainstUnit(attackerType: UnitType, targetType: UnitType): number {
  return armorClassBonus(attackerType, targetType);
}

// Anti-building bonus by attacker (siege family), AoE2-accurate base values
// from design/stats/units.csv. Data, not a switch. (Non-siege units' tiny +1-3
// vs-building bonuses — spearman/villager/infantry — are deferred; see the
// armorClasses.ts header.)
const BUILDING_ATTACK_BONUS: Partial<Record<UnitType, number>> = {
  'battering-ram': 125,
  'siege-ram': 200,
  'bombard-cannon': 200,
  trebuchet: 250,
  mangonel: 35,
  onager: 45,
  scorpion: 2,
  'heavy-scorpion': 4,
};

export function attackBonusAgainstBuilding(attackerType: UnitType): number {
  return BUILDING_ATTACK_BONUS[attackerType] ?? 0;
}

// Blast/splash radius (spec §10.7), from design/stats/units.csv `blast_radius`.
// Only the roster's mangonel line has an effective radial blast at this grid
// resolution (measured with Euclidean distance): mangonel 1 and onager 1.25
// both reach the four orthogonal neighbours of the impact cell (a diagonal is
// √2≈1.41 away, so onager's wider AoE only manifests at siege-onager's 1.5 —
// off-roster). Bombard's CSV 0.5 is sub-cell (no other cell within it), and
// scorpion blast is a LINE attack (empty CSV radius) — both deferred. Absent
// attackers have no blast.
const UNIT_BLAST_RADIUS: Partial<Record<UnitType, number>> = {
  mangonel: 1,
  onager: 1.25,
};

export function unitBlastRadius(unitType: UnitType): number {
  return UNIT_BLAST_RADIUS[unitType] ?? 0;
}
