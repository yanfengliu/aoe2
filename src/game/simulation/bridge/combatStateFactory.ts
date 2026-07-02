// Combat state factory. Builds a CombatState for a (owner, unitType) pair,
// applying every researched-tech bonus that stacks on top of the base unit
// stats. Called from entity-creation paths and from the technology pipeline
// when an upgrade triggers a per-unit re-build.

import type { CombatState } from './systems/systemTypes';
import type { ResearchableTechnologyType, UnitType } from '../types';
import { applyArmorTech } from '../armorTechBonuses';
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
    if (
      (isArcherLineUnit(unitType) || isGunpowderUnit(unitType))
      && hasTechnology(owner, 'chemistry')
    ) {
      state.attackDamage += 1;
    }

    return state;
  };
}
