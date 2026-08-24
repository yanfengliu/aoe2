// Combat state factory. Builds a CombatState for a (owner, unitType) pair,
// applying every researched-tech bonus that stacks on top of the base unit
// stats. Called from entity-creation paths and from the technology pipeline
// when an upgrade triggers a per-unit re-build.

import {
  uniqueTechnologiesFor,
  unitEffectsOf,
  type UniqueUnitEffect,
} from '../uniqueTechnologies';
import type { CombatState } from './systems/systemTypes';
import type { ResearchableTechnologyType, UnitType } from '../types';
import { applyArmorTech } from '../armorTechBonuses';
import { civUnitHpMultiplier } from '../civBonusEffects';
import {
  isArcherLineUnit,
  isCavalryArcherUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  isMountedUnit,
  isSiegeUnit,
  unitAttackDamage,
  unitAttackRange,
  unitMaxHp,
  unitReloadTicks,
} from '../prototypeUnitRules';

export interface CombatStateFactoryDeps {
  hasTechnology: (owner: number, technologyType: ResearchableTechnologyType) => boolean;
  getCivilization: (owner: number) => string;
}

/**
 * Fold one declared unique-technology effect into a combat state.
 *
 * Multipliers are applied to the value as it stands, so a unit that is already
 * carrying flat bonuses keeps them scaled — Furor Celtica on a Ram that has
 * been through the blacksmith raises the total, not the base.
 */
export function applyUniqueUnitEffect(
  state: CombatState,
  effect: UniqueUnitEffect,
  unitType: UnitType,
): void {
  if (!effect.applies(unitType)) return;
  if (effect.maxHpMultiplier !== undefined) {
    const wasFull = state.currentHp >= state.maxHp;
    state.maxHp = Math.round(state.maxHp * effect.maxHpMultiplier);
    if (wasFull) state.currentHp = state.maxHp;
  }
  if (effect.maxHp !== undefined) {
    const wasFull = state.currentHp >= state.maxHp;
    state.maxHp += effect.maxHp;
    // A flat hit-point grant fills a unit that was already full, and leaves a
    // damaged one damaged — the same rule Loom follows.
    state.currentHp = wasFull ? state.maxHp : state.currentHp + effect.maxHp;
  }
  if (effect.attackDamage !== undefined) state.attackDamage += effect.attackDamage;
  if (effect.attackRange !== undefined) state.attackRange += effect.attackRange;
  if (effect.armor !== undefined) state.armor += effect.armor;
  if (effect.pierceArmor !== undefined) state.pierceArmorBonus += effect.pierceArmor;
  if (effect.reloadMultiplier !== undefined) {
    state.reloadTicks = Math.max(1, Math.round(state.reloadTicks * effect.reloadMultiplier));
  }
}

export function createCombatStateFactory(deps: CombatStateFactoryDeps): (
  owner: number,
  unitType: UnitType,
) => CombatState {
  const { hasTechnology, getCivilization } = deps;

  return function createCombatState(owner: number, unitType: UnitType): CombatState {
    // Civ HP bonus (Franks Knights +20%) applies to the BASE HP before flat
    // tech bonuses (Bloodlines, Loom) add — AoE2: knight 100 → Franks 120 →
    // +20 Bloodlines = 140. A non-bonus civ multiplies by 1 (byte-identical).
    const baseHp = Math.round(unitMaxHp(unitType) * civUnitHpMultiplier(getCivilization(owner), unitType));
    const state: CombatState = {
      currentHp: baseHp,
      maxHp: baseHp,
      attackDamage: unitAttackDamage(unitType),
      attackRange: unitAttackRange(unitType),
      reloadTicks: unitReloadTicks(unitType),
      cooldownTicks: 0,
      armor: 0,
      pierceArmorBonus: 0,
    };

    // Loom: +15 villager max HP + +1 melee / +2 pierce armor (spec §11.8). A
    // newly created villager is at full HP, so current and max both gain 15
    // (25 → 40). The same bump is applied to existing villagers on research in
    // technologyOps' `loom` case (via loomEffect). applyArmorTech routes the
    // asymmetric pierce bonus.
    if (unitType === 'villager' && hasTechnology(owner, 'loom')) {
      state.maxHp += 15;
      state.currentHp += 15;
      applyArmorTech(state, 'loom');
    }

    // Sanctity: +15 monk HP (Monastery). A newly created monk is at full HP, so
    // current and max both gain 15. Existing monks get it on research in
    // technologyOps' `sanctity` case (via sanctityEffect).
    if (unitType === 'monk' && hasTechnology(owner, 'sanctity')) {
      state.maxHp += 15;
      state.currentHp += 15;
    }

    // Bloodlines: +20 MOUNTED HP (Feudal Stable — cavalry + cavalry archers,
    // technologies.csv:78). A newly created mounted unit is at full HP, so
    // current and max both gain 20. Existing mounted units get it on research
    // in technologyOps' `bloodlines` case (via bloodlinesEffect).
    if (isMountedUnit(unitType) && hasTechnology(owner, 'bloodlines')) {
      state.maxHp += 20;
      state.currentHp += 20;
    }

    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'fletching')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'bodkin-arrow')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'bracer')) {
      state.attackDamage += 1;
      state.attackRange += 1;
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'blast-furnace')) {
      state.attackDamage += 2;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'plate-mail-armor')) {
      applyArmorTech(state, 'plate-mail-armor');
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'plate-barding')) {
      applyArmorTech(state, 'plate-barding');
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'forging')) {
      state.attackDamage += 1;
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'iron-casting')) {
      state.attackDamage += 1;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'scale-mail-armor')) {
      applyArmorTech(state, 'scale-mail-armor');
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'chain-mail-armor')) {
      applyArmorTech(state, 'chain-mail-armor');
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'scale-barding-armor')) {
      applyArmorTech(state, 'scale-barding-armor');
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'chain-barding-armor')) {
      applyArmorTech(state, 'chain-barding-armor');
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'padded-archer-armor')) {
      applyArmorTech(state, 'padded-archer-armor');
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'leather-archer-armor')) {
      applyArmorTech(state, 'leather-archer-armor');
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'ring-archer-armor')) {
      applyArmorTech(state, 'ring-archer-armor');
    }
    // Parthian Tactics armors the mounted archers, which the FOOT archer armor
    // line above deliberately does not cover.
    if (isCavalryArcherUnit(unitType) && hasTechnology(owner, 'parthian-tactics')) {
      applyArmorTech(state, 'parthian-tactics');
    }
    if (
      (isArcherLineUnit(unitType) || isGunpowderUnit(unitType))
      && hasTechnology(owner, 'chemistry')
    ) {
      state.attackDamage += 1;
    }

    // Siege Engineers: +1 attack range to every siege unit. The same +1 is
    // applied to existing siege units on research in technologyOps'
    // `siege-engineers` case; the already-researched guard keeps it single-
    // applied (no double stacking).
    if (isSiegeUnit(unitType) && hasTechnology(owner, 'siege-engineers')) {
      state.attackRange += 1;
    }

    // Civilization unique technologies, applied from their declarations rather
    // than as another sixteen branches (see uniqueTechnologies.ts). Only the
    // owner's OWN civilization's technologies are considered, so a researched-
    // set that somehow carried another civ's id still cannot apply it.
    for (const technology of uniqueTechnologiesFor(getCivilization(owner))) {
      if (!hasTechnology(owner, technology.id)) continue;
      for (const effect of unitEffectsOf(technology.id)) {
        applyUniqueUnitEffect(state, effect, unitType);
      }
    }

    return state;
  };
}
