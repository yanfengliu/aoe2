// Unit-vs-unit attack resolution + blast/splash for the mangonel line (spec
// §10.2/§10.7). `computeBlastDamage` is pure (testable without the bridge);
// `applyUnitBlast` wires it to the world; `resolveUnitAttackOnUnit` is the entry
// point playerCommandsSystem calls (primary hit + splash + death handling).

import type { EntityRef, Position } from 'civ-engine';

import type { RecordPlayerHit } from './playerHitFeed';

import { areAllied } from '../alliances';
import type { UnitComponent, UnitType } from '../types';
import {
  attackBonusAgainstUnit,
  detonatesOnAttack,
  combatDamageAfterArmor,
  effectiveMeleeArmor,
  effectivePierceArmor,
  unitAttackType,
  unitBlastRadius,
} from '../prototypeUnitRules';
import { blastSparesOwnSide } from '../projectileRules';
import { pierceArmorTechBonus } from '../armorTechBonuses';
import { damageAnimal, type AnimalDamageDeps } from './animalDamage';
import { distanceSquared, type GameWorld } from './pureHelpers';
import type { CombatState } from './systems/systemTypes';

/** The animals a blast can catch, and how a blow on one lands. */
export type BlastAnimals = AnimalDamageDeps;

export interface BlastCandidate {
  readonly id: number;
  readonly unitType: UnitType;
  readonly position: Position;
  /** The unit's symmetric armor-tech bonus (`CombatState.armor`, melee side). */
  readonly armor: number;
  /** The unit's extra pierce-only armor-tech bonus (`CombatState.pierceArmorBonus`). */
  readonly pierceArmorBonus: number;
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
      effectivePierceArmor(candidate.unitType, pierceArmorTechBonus(candidate)),
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
  /** The attacker, for an animal the blast hurts to turn on; null once the
   *  attacker is gone. */
  readonly ref: EntityRef | null;
}

/**
 * Where a blast a unit delivers in person is centred (spec §10.7). A
 * detonation goes off where the unit that detonates stands, as a DE demolition
 * ship's charge does ("Pilot near enemy ships and detonate", units.csv; the
 * AoE2 wiki has it deal full damage even when it explodes before reaching its
 * target). Any other blow's blast is centred on its target.
 */
export function inPersonBlastCentre(world: GameWorld, attacker: { id: number; unitType: UnitType }, target: Position): Position {
  if (!detonatesOnAttack(attacker.unitType)) return target;
  return world.getComponent<Position>(attacker.id, 'position') ?? target;
}

/**
 * Bridge wiring: enumerate the world's units, apply `computeBlastDamage` for a
 * blast attacker, mutate splashed units' HP and destroy the dead, and call
 * `markDirty` if anything was splashed. Friendly-fire kills do NOT score for the
 * attacker's owner. A blast that spares its own side (`blastSparesOwnSide`, the
 * demolition line's) skips the owner's units and its allies'. The animals in
 * reach are hurt too, whoever's the blast. No-op for non-blast attackers.
 */
export function applyUnitBlast(params: {
  world: GameWorld;
  combatStates: Map<number, CombatState>;
  attacker: BlastAttacker;
  impact: Position;
  primaryTargetId: number;
  /** Who is on whose side (`playerTeamsCodec`), for a blast that spares its own. */
  teams: ReadonlyMap<number, number>;
  animals: BlastAnimals;
  destroyUnit: (id: number) => void;
  addKill: (owner: number) => void;
  markDirty: () => void;
  /** Every splashed unit is a blow landed, for the attack warning. */
  recordPlayerHit: RecordPlayerHit;
}): void {
  const { world, combatStates, attacker } = params;
  const radius = unitBlastRadius(attacker.unitType);
  if (radius <= 0) return;
  const sparesOwnSide = blastSparesOwnSide(attacker.unitType);
  const candidates: BlastCandidate[] = [];
  for (const otherId of world.query('position', 'unit')) {
    const otherCombat = combatStates.get(otherId);
    const otherUnit = world.getComponent<UnitComponent>(otherId, 'unit');
    const otherPos = world.getComponent<Position>(otherId, 'position');
    if (!otherCombat || !otherUnit || !otherPos) continue;
    if (sparesOwnSide && areAllied(params.teams, attacker.owner, otherUnit.owner)) continue;
    candidates.push({
      id: otherId,
      unitType: otherUnit.unitType,
      position: otherPos,
      armor: otherCombat.armor,
      pierceArmorBonus: otherCombat.pierceArmorBonus ?? 0,
    });
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
    params.recordPlayerHit(attacker.id, attacker.owner, splash.id);
    if (splashCombat.currentHp <= 0) {
      const splashUnit = world.getComponent<UnitComponent>(splash.id, 'unit');
      if (splashUnit && splashUnit.owner !== attacker.owner) params.addKill(attacker.owner);
      params.destroyUnit(splash.id);
    }
  }
  if (splashes.length > 0) params.markDirty();

  // The animals in reach. A boar or a wolf is a resource with a wildlife
  // state, not a unit, and a blast hurts one with the attack whole, since
  // animals carry no armour here (DE's blast falls off with distance, and
  // this game's does not; spec §10.7). It belongs to nobody, so no blast
  // spares it. In id order, like the units.
  const radiusSq = radius * radius;
  const animalsHit: number[] = [];
  for (const [animalId, animal] of params.animals.states) {
    if (!animal.isAlive || animalId === params.primaryTargetId) continue;
    const at = world.getComponent<Position>(animalId, 'position');
    if (at && distanceSquared(params.impact, at) <= radiusSq) animalsHit.push(animalId);
  }
  animalsHit.sort((a, b) => a - b);
  for (const animalId of animalsHit) damageAnimal(params.animals, animalId, attacker.baseDamage, attacker.ref);
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
  /** Caller-computed team extras (Persian knights vs archer-class). */
  teamUnitBonus?: number;
  /** For the blast: who is on whose side, and the animals it can catch. */
  teams: ReadonlyMap<number, number>;
  animals: BlastAnimals;
  /** The primary hit and every splashed unit, for the attack warning. */
  recordPlayerHit: RecordPlayerHit;
}): boolean {
  const { attacker, target } = params;
  const raw = attacker.combat.attackDamage
    + attackBonusAgainstUnit(attacker.unitType, target.unitType)
    + (params.teamUnitBonus ?? 0);
  target.combat.currentHp -= combatDamageAfterArmor(
    raw,
    unitAttackType(attacker.unitType),
    effectiveMeleeArmor(target.unitType, target.combat.armor),
    effectivePierceArmor(target.unitType, pierceArmorTechBonus(target.combat)),
  );
  params.recordPlayerHit(attacker.id, attacker.owner, target.id);
  attacker.combat.cooldownTicks = attacker.combat.reloadTicks;
  params.markDirty();
  params.markRender();

  applyUnitBlast({
    world: params.world,
    combatStates: params.combatStates,
    attacker: {
      id: attacker.id,
      unitType: attacker.unitType,
      owner: attacker.owner,
      baseDamage: attacker.combat.attackDamage,
      ref: params.world.getEntityRef(attacker.id),
    },
    impact: inPersonBlastCentre(params.world, attacker, target.position),
    primaryTargetId: target.id,
    teams: params.teams,
    animals: params.animals,
    destroyUnit: params.destroyUnit,
    addKill: params.addKill,
    markDirty: params.markDirty,
    recordPlayerHit: params.recordPlayerHit,
  });

  const primaryDied = target.combat.currentHp <= 0;
  if (primaryDied) {
    params.addKill(attacker.owner);
    params.destroyUnit(target.id);
  }

  // The demolition line is spent by its own blast (units.csv: "self-destructs
  // when used"), and it goes AFTER the blast so the explosion still lands. No
  // kill is credited for it: nobody killed the bomb, its owner spent it.
  if (detonatesOnAttack(attacker.unitType)) {
    params.destroyUnit(attacker.id);
  }
  return primaryDied;
}
