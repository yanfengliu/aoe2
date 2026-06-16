// Accessor functions over the unit / wildlife stat tables. Tables live
// in `prototypeUnitRules/statTables.ts` so this file stays under 500
// LOC; consumers continue to import from `prototypeUnitRules` since the
// barrel re-exports everything they need.

import { HUMAN_PLAYER_ID } from './prototypeScenario';
import type { ResourceKind, UnitType } from './types';
import {
  ARCHER_LINE_UNITS,
  CAVALRY_TARGETS,
  CAVALRY_UNITS,
  HEAVY_CAVALRY_TARGETS,
  INFANTRY_UNITS,
  LIGHT_CAVALRY_TARGETS,
  MANGONEL_INFANTRY_TARGETS,
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

export function isCavalryTarget(targetType: UnitType): boolean {
  return CAVALRY_TARGETS.has(targetType);
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

// Slice 2b-i: the anti-class attack bonuses, as DATA instead of an if-ladder.
// Each attacker maps to an ordered list of (target-class predicate, bonus);
// the FIRST matching rule wins — mirroring the prior ladder exactly (the
// light/heavy-cavalry classes are mutually exclusive, so first-match == the
// intended value). The predicates reuse the existing target sets, so this
// retires the hard-coded ladder into data without any behaviour change. Slice
// 2b-ii will adopt the AoE2-accurate CSV values (and revisit first-match vs
// the AoE2 cross-class summation) on top of this seam.
const UNIT_ATTACK_BONUS_RULES: Partial<
  Record<UnitType, ReadonlyArray<{ matches: (target: UnitType) => boolean; bonus: number }>>
> = {
  spearman: [
    { matches: (t) => LIGHT_CAVALRY_TARGETS.has(t), bonus: 12 },
    { matches: (t) => HEAVY_CAVALRY_TARGETS.has(t), bonus: 15 },
  ],
  pikeman: [
    { matches: (t) => LIGHT_CAVALRY_TARGETS.has(t), bonus: 19 },
    { matches: (t) => HEAVY_CAVALRY_TARGETS.has(t), bonus: 22 },
  ],
  halberdier: [{ matches: isCavalryTarget, bonus: 28 }],
  skirmisher: [{ matches: isArcherLineUnit, bonus: 4 }],
  camel: [{ matches: isCavalryTarget, bonus: 9 }],
  'heavy-camel': [{ matches: isCavalryTarget, bonus: 9 }],
  mangonel: [{ matches: (t) => MANGONEL_INFANTRY_TARGETS.has(t), bonus: 10 }],
};

export function attackBonusAgainstUnit(attackerType: UnitType, targetType: UnitType): number {
  const rules = UNIT_ATTACK_BONUS_RULES[attackerType];
  if (!rules) return 0;
  for (const rule of rules) {
    if (rule.matches(targetType)) return rule.bonus;
  }
  return 0;
}

// Anti-building bonus by attacker (rams / siege / trebuchet). Data, not a switch.
const BUILDING_ATTACK_BONUS: Partial<Record<UnitType, number>> = {
  'battering-ram': 75,
  'siege-ram': 250,
  'bombard-cannon': 80,
  trebuchet: 200,
};

export function attackBonusAgainstBuilding(attackerType: UnitType): number {
  return BUILDING_ATTACK_BONUS[attackerType] ?? 0;
}
