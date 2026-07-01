// Unit-vs-unit attack resolution + blast/splash for the mangonel line (spec
// §10.2/§10.7). `computeBlastDamage` is pure (testable without the bridge);
// `applyUnitBlast` wires it to the world; `resolveUnitAttackOnUnit` is the entry
// point playerCommandsSystem calls (primary hit + splash + death handling).

import type { Position } from 'civ-engine';

import type { UnitComponent, UnitType } from '../types';
import {
  attackBonusAgainstUnit,
  combatDamageAfterArmor,
  effectiveMeleeArmor,
  effectivePierceArmor,
  unitAttackType,
  unitBlastRadius,
} from '../prototypeUnitRules';
import { distanceSquared, type GameWorld } from './pureHelpers';
import type { CombatState } from './systems/systemTypes';

export interface BlastCandidate {
  readonly id: number;
  readonly unitType: UnitType;
  readonly position: Position;
  /** The unit's persisted armor-tech bonus (`CombatState.armor`). */
  readonly armor: number;
}

/**
 * Splash damage for a blast attacker. Given the impact cell, returns the damage
 * to apply to each OTHER unit within the attacker's Euclidean blast radius —
 * computed with the SAME formula as the primary hit (base attack + class bonus,
 * reduced by the splashed unit's melee/pierce armor, floored at 1). `excludeIds`
 * holds the attacker + the primary target (already hit directly). Order is
 * deterministic (ascending id). Empty for non-blast attackers. Friendly fire is
 * intentional: candidates of ANY owner within the radius are returned — the
 * caller decides scoring (an own-unit kill should not count).
 */
export function computeBlastDamage(
  attackerType: UnitType,
  attackerBaseDamage: number,
  impact: Position,
  candidates: readonly BlastCandidate[],
  excludeIds: ReadonlySet<number>,
): Array<{ id: number; damage: number }> {
  const radius = unitBlastRadius(attackerType);
  if (radius <= 0) return [];
  const radiusSq = radius * radius;
  const attackType = unitAttackType(attackerType);
  const hits: Array<{ id: number; damage: number }> = [];
  for (const candidate of candidates) {
    if (excludeIds.has(candidate.id)) continue;
    if (distanceSquared(impact, candidate.position) > radiusSq) continue;
    const raw = attackerBaseDamage + attackBonusAgainstUnit(attackerType, candidate.unitType);
    const damage = combatDamageAfterArmor(
      raw,
      attackType,
      effectiveMeleeArmor(candidate.unitType, candidate.armor),
      effectivePierceArmor(candidate.unitType, candidate.armor),
    );
    hits.push({ id: candidate.id, damage });
  }
  hits.sort((a, b) => a.id - b.id);
  return hits;
}

export interface BlastAttacker {
  readonly id: number;
  readonly unitType: UnitType;
  readonly owner: number;
  readonly baseDamage: number;
}

/**
 * Bridge wiring: enumerate the world's units, apply `computeBlastDamage` for a
 * blast attacker, mutate splashed units' HP and destroy the dead, and call
 * `markDirty` if anything was splashed. Friendly-fire kills do NOT score for the
 * attacker's owner. No-op for non-blast attackers.
 */
export function applyUnitBlast(params: {
  world: GameWorld;
  combatStates: Map<number, CombatState>;
  attacker: BlastAttacker;
  impact: Position;
  primaryTargetId: number;
  destroyUnit: (id: number) => void;
  addKill: (owner: number) => void;
  markDirty: () => void;
}): void {
  const { world, combatStates, attacker } = params;
  if (unitBlastRadius(attacker.unitType) <= 0) return;
  const candidates: BlastCandidate[] = [];
  for (const otherId of world.query('position', 'unit')) {
    const otherCombat = combatStates.get(otherId);
    const otherUnit = world.getComponent<UnitComponent>(otherId, 'unit');
    const otherPos = world.getComponent<Position>(otherId, 'position');
    if (!otherCombat || !otherUnit || !otherPos) continue;
    candidates.push({ id: otherId, unitType: otherUnit.unitType, position: otherPos, armor: otherCombat.armor });
  }
  const splashes = computeBlastDamage(
    attacker.unitType,
    attacker.baseDamage,
    params.impact,
    candidates,
    new Set([attacker.id, params.primaryTargetId]),
  );
  for (const splash of splashes) {
    const splashCombat = combatStates.get(splash.id);
    if (!splashCombat) continue;
    splashCombat.currentHp -= splash.damage;
    if (splashCombat.currentHp <= 0) {
      const splashUnit = world.getComponent<UnitComponent>(splash.id, 'unit');
      if (splashUnit && splashUnit.owner !== attacker.owner) params.addKill(attacker.owner);
      params.destroyUnit(splash.id);
    }
  }
  if (splashes.length > 0) params.markDirty();
}

/**
 * Resolve one unit's attack against a unit target: apply the primary
 * melee/pierce hit (base attack + class bonus, reduced by the target's armor),
 * set the attacker's reload cooldown, apply blast/splash to the surrounding
 * area, then handle the primary target's death. Returns true if the primary
 * target died (so the caller can clear the attack command).
 */
export function resolveUnitAttackOnUnit(params: {
  world: GameWorld;
  combatStates: Map<number, CombatState>;
  attacker: { id: number; unitType: UnitType; owner: number; combat: CombatState };
  target: { id: number; unitType: UnitType; position: Position; combat: CombatState };
  destroyUnit: (id: number) => void;
  addKill: (owner: number) => void;
  markDirty: () => void;
  markRender: () => void;
}): boolean {
  const { attacker, target } = params;
  const raw = attacker.combat.attackDamage + attackBonusAgainstUnit(attacker.unitType, target.unitType);
  target.combat.currentHp -= combatDamageAfterArmor(
    raw,
    unitAttackType(attacker.unitType),
    effectiveMeleeArmor(target.unitType, target.combat.armor),
    effectivePierceArmor(target.unitType, target.combat.armor),
  );
  attacker.combat.cooldownTicks = attacker.combat.reloadTicks;
  params.markDirty();
  params.markRender();

  applyUnitBlast({
    world: params.world,
    combatStates: params.combatStates,
    attacker: { id: attacker.id, unitType: attacker.unitType, owner: attacker.owner, baseDamage: attacker.combat.attackDamage },
    impact: target.position,
    primaryTargetId: target.id,
    destroyUnit: params.destroyUnit,
    addKill: params.addKill,
    markDirty: params.markDirty,
  });

  if (target.combat.currentHp <= 0) {
    params.addKill(attacker.owner);
    params.destroyUnit(target.id);
    return true;
  }
  return false;
}
