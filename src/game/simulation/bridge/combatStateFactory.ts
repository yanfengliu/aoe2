// Combat state factory. Builds a CombatState for a (owner, unitType) pair,
// applying every researched-tech bonus that stacks on top of the base unit
// stats. Called from entity-creation paths and from the technology pipeline
// when an upgrade triggers a per-unit re-build.

import type { CombatState } from './systems/systemTypes';
import type { ResearchableTechnologyType, UnitType } from '../types';
import {
  isArcherLineUnit,
  isCavalryUnit,
  isGunpowderUnit,
  isInfantryUnit,
  isMeleeUnit,
  unitAttackDamage,
  unitAttackRange,
  unitMaxHp,
  unitReloadTicks,
} from '../prototypeUnitRules';

export interface CombatStateFactoryDeps {
  hasTechnology: (owner: number, technologyType: ResearchableTechnologyType) => boolean;
}

export function createCombatStateFactory(deps: CombatStateFactoryDeps): (
  owner: number,
  unitType: UnitType,
) => CombatState {
  const { hasTechnology } = deps;

  return function createCombatState(owner: number, unitType: UnitType): CombatState {
    const state: CombatState = {
      currentHp: unitMaxHp(unitType),
      maxHp: unitMaxHp(unitType),
      attackDamage: unitAttackDamage(unitType),
      attackRange: unitAttackRange(unitType),
      reloadTicks: unitReloadTicks(unitType),
      cooldownTicks: 0,
      armor: 0,
    };

    // Loom: +15 villager max HP + +1 armor. A newly created villager is at full
    // HP, so current and max both gain 15 (25 → 40). The same flat bump is
    // applied to existing villagers on research in technologyOps' `loom` case.
    // AoE2 Loom is +1 melee / +2 pierce; this slice ships +1/+1 via the single
    // CombatState.armor scalar (the +1 pierce is deferred — see the type union
    // comment + design/spec-final.md).
    if (unitType === 'villager' && hasTechnology(owner, 'loom')) {
      state.maxHp += 15;
      state.currentHp += 15;
      state.armor += 1;
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
      state.armor += 1;
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'plate-barding')) {
      state.armor += 1;
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'forging')) {
      state.attackDamage += 1;
    }
    if (isMeleeUnit(unitType) && hasTechnology(owner, 'iron-casting')) {
      state.attackDamage += 1;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'scale-mail-armor')) {
      state.armor += 1;
    }
    if (isInfantryUnit(unitType) && hasTechnology(owner, 'chain-mail-armor')) {
      state.armor += 1;
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'scale-barding-armor')) {
      state.armor += 1;
    }
    if (isCavalryUnit(unitType) && hasTechnology(owner, 'chain-barding-armor')) {
      state.armor += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'padded-archer-armor')) {
      state.armor += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'leather-archer-armor')) {
      state.armor += 1;
    }
    if (isArcherLineUnit(unitType) && hasTechnology(owner, 'ring-archer-armor')) {
      state.armor += 1;
    }
    if (
      (isArcherLineUnit(unitType) || isGunpowderUnit(unitType))
      && hasTechnology(owner, 'chemistry')
    ) {
      state.attackDamage += 1;
    }

    return state;
  };
}
