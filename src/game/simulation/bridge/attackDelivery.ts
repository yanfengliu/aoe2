// One decision point for every unit attack: does this weapon reach out and
// touch the target now, or does it launch something that has to get there?
//
// Melee attacks resolve instantly, exactly as they always have. Ranged attacks
// (spec §10.4) launch a projectile and resolve on its impact tick. Extracted
// from `playerCommandsSystem` so that system keeps only the targeting and
// approach logic.
//
// Aim uses the authoritative cell `position`, the same coordinate the range
// checks use — so the rule a player can actually see is "if the target left
// the cell you shot at, you missed". Ballistics (once researched) removes that
// by aiming where the target is going instead.

import type { Position } from 'civ-engine';

import type { ResearchableTechnologyType, UnitType } from '../types';
import { attackBonusAgainstBuilding } from '../prototypeUnitRules';
import { sappersBuildingAttackBonus } from '../sappersTechEffects';
import { civBuildingAttackBonus } from '../civBonusEffects';
import {
  ballisticsLeadsShots,
  thumbRingAccuracy,
} from '../projectileTechEffects';
import { applyUnitBlast, resolveUnitAttackOnUnit } from './blastDamage';
import { EMPTY_TECH_SET } from '../economyTechEffects';
import { firesProjectile, launchProjectile } from './projectileOps';
import type { GameWorld } from './pureHelpers';
import type { ProjectileSlotState } from './projectileTypes';
import type { CombatState } from './systems/systemTypes';

export interface DeliverAttackShared {
  world: GameWorld;
  combatStates: Map<number, CombatState>;
  projectiles: ProjectileSlotState;
  tick: number;
  destroyUnit: (id: number) => void;
  addKill: (owner: number) => void;
  markCombatDirty: () => void;
  markRender: () => void;
  /** The attacker owner's researched set — Ballistics and Thumb Ring are
   *  derived from it here rather than stored per unit. */
  attackerTechs?: ReadonlySet<ResearchableTechnologyType>;
  /** Where the target is walking to, for Ballistics leading. */
  targetDestination?: Position | null;
}

export interface DeliverUnitAttackParams extends DeliverAttackShared {
  attacker: { id: number; unitType: UnitType; owner: number; combat: CombatState };
  target: { id: number; unitType: UnitType; position: Position; combat: CombatState };
}

/**
 * Deliver one unit's attack against a unit. Returns true when the target died
 * on the spot — which only a melee attack can do, since a projectile's damage
 * lands later.
 */
export function deliverUnitAttackOnUnit(params: DeliverUnitAttackParams): boolean {
  const { attacker, target } = params;
  if (!firesProjectile(attacker.unitType)) {
    return resolveUnitAttackOnUnit({
      world: params.world,
      combatStates: params.combatStates,
      attacker,
      target,
      destroyUnit: params.destroyUnit,
      addKill: params.addKill,
      markDirty: params.markCombatDirty,
      markRender: params.markRender,
    });
  }

  const attackerPosition = params.world.getComponent<Position>(attacker.id, 'position');
  const techs = params.attackerTechs ?? EMPTY_TECH_SET;
  const accuracy = thumbRingAccuracy(techs, attacker.unitType);
  launchProjectile({
    slot: params.projectiles,
    tick: params.tick,
    attacker: {
      id: attacker.id,
      owner: attacker.owner,
      unitType: attacker.unitType,
      position: attackerPosition ?? target.position,
      baseDamage: attacker.combat.attackDamage,
    },
    target: {
      id: target.id,
      kind: 'unit',
      position: target.position,
      destination: params.targetDestination ?? null,
    },
    leads: ballisticsLeadsShots(techs),
    ...(accuracy === null ? {} : { accuracy }),
  });
  attacker.combat.cooldownTicks = attacker.combat.reloadTicks;
  params.markCombatDirty();
  params.markRender();
  return false;
}

export interface DeliverBuildingAttackParams extends DeliverAttackShared {
  attacker: { id: number; unitType: UnitType; owner: number; combat: CombatState };
  attackerTechs: ReadonlySet<ResearchableTechnologyType>;
  attackerCivilization: string | undefined;
  target: { id: number; position: Position };
  applyBuildingDamage: (buildingId: number, damage: number) => void;
}

/**
 * Deliver one unit's attack against a building. Buildings do not dodge, so a
 * projectile aimed at one always connects — it just arrives later.
 */
export function deliverUnitAttackOnBuilding(params: DeliverBuildingAttackParams): void {
  const { attacker, target } = params;
  const damage = Math.max(
    0,
    attacker.combat.attackDamage
      + attackBonusAgainstBuilding(attacker.unitType)
      + sappersBuildingAttackBonus(params.attackerTechs, attacker.unitType)
      + civBuildingAttackBonus(params.attackerCivilization, attacker.unitType),
  );

  attacker.combat.cooldownTicks = attacker.combat.reloadTicks;
  params.markCombatDirty();
  params.markRender();

  if (firesProjectile(attacker.unitType)) {
    const attackerPosition = params.world.getComponent<Position>(attacker.id, 'position');
    launchProjectile({
      slot: params.projectiles,
      tick: params.tick,
      attacker: {
        id: attacker.id,
        owner: attacker.owner,
        unitType: attacker.unitType,
        position: attackerPosition ?? target.position,
        // Blast rides the raw attack stat; only the building takes the
        // anti-building total.
        baseDamage: attacker.combat.attackDamage,
        buildingDamage: damage,
      },
      target: { id: target.id, kind: 'building', position: target.position },
      leads: ballisticsLeadsShots(params.attackerTechs ?? EMPTY_TECH_SET),
    });
    return;
  }

  params.applyBuildingDamage(target.id, damage);
  // Blast/splash (spec §10.7): a melee siege hit on a building also catches
  // units clustered around it. Projectile siege splashes on impact instead.
  applyUnitBlast({
    world: params.world,
    combatStates: params.combatStates,
    attacker: {
      id: attacker.id,
      unitType: attacker.unitType,
      owner: attacker.owner,
      baseDamage: attacker.combat.attackDamage,
    },
    impact: target.position,
    primaryTargetId: target.id,
    destroyUnit: params.destroyUnit,
    addKill: params.addKill,
    markDirty: params.markCombatDirty,
  });
}
