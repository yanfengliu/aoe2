// Launching and resolving projectiles (spec §10.4). Ranged attacks no longer
// subtract HP the instant they are ordered: `launchProjectile` puts a shot in
// the air with its outcome already decided, and `resolveDueProjectiles` lands
// it some ticks later — by which time the target may have walked out from
// under it.
//
// The accuracy roll happens at LAUNCH, not impact, so the shot's fate is fixed
// the moment it leaves the bow. That is what makes a save mid-flight reload
// identically: nothing about the outcome depends on state that changes while
// the arrow is in the air.

import type { Position } from 'civ-engine';

import type { UnitComponent, UnitType } from '../types';
import {
  attackBonusAgainstUnit,
  combatDamageAfterArmor,
  effectiveMeleeArmor,
  effectivePierceArmor,
  unitAttackType,
} from '../prototypeUnitRules';
import { pierceArmorTechBonus } from '../armorTechBonuses';
import {
  firesProjectile,
  isAreaProjectile,
  projectileAimPoint,
  projectileFlightTicks,
  projectileHitsTarget,
  projectileLaunchDelayTicks,
  projectileMissAimPoint,
  projectileRoll,
  unitAccuracy,
} from '../projectileRules';
import { applyUnitBlast } from './blastDamage';
import type { GameWorld } from './pureHelpers';
import type { ProjectileSlotState, ProjectileState } from './projectileTypes';
import type { CombatState } from './systems/systemTypes';

export { firesProjectile };

/** Per-tick movement of a unit, used to lead a shot when Ballistics applies. */
export interface TargetMotion {
  readonly x: number;
  readonly y: number;
}

export interface LaunchProjectileParams {
  slot: ProjectileSlotState;
  tick: number;
  attacker: {
    id: number;
    owner: number;
    /** `null` for a building's arrow. */
    unitType: UnitType | null;
    position: Position;
    baseDamage: number;
    /** Anti-building total; only used when the target is a building. */
    buildingDamage?: number;
  };
  target: {
    id: number;
    kind: 'unit' | 'building';
    position: Position;
    /** Tiles per tick; zero for anything that is not moving. */
    motion?: TargetMotion;
  };
  /** Whether the attacker leads moving targets (Ballistics). */
  leads: boolean;
  /** Accuracy override in (0,1]; defaults to the attacker unit's own accuracy. */
  accuracy?: number;
}

/**
 * Put one shot in the air. Returns the projectile so callers can react to it
 * (render feeds, tests); the shot is already recorded in `slot`.
 */
export function launchProjectile(params: LaunchProjectileParams): ProjectileState {
  const { slot, tick, attacker, target } = params;
  const id = slot.nextId;
  slot.nextId += 1;

  const unitType = attacker.unitType;
  const isArea = unitType !== null && isAreaProjectile(unitType);
  const flightTicks = unitType === null
    ? projectileFlightTicks('archer', attacker.position, target.position)
    : projectileFlightTicks(unitType, attacker.position, target.position);
  const windup = unitType === null ? 0 : projectileLaunchDelayTicks(unitType);

  const accuracy = params.accuracy
    ?? (unitType === null ? 1 : unitAccuracy(unitType));
  // A building is not going anywhere, and an area shot always lands where it
  // was aimed — neither rolls to hit.
  const rolls = target.kind === 'unit' && !isArea && accuracy < 1;
  const willHit = !rolls || projectileRoll(tick, attacker.id, target.id, id) < accuracy;

  const motion = target.motion ?? { x: 0, y: 0 };
  const aim = willHit
    ? projectileAimPoint(target.position, motion, flightTicks, params.leads)
    : projectileMissAimPoint(target.position, tick, attacker.id, target.id, id);

  const projectile: ProjectileState = {
    id,
    attackerId: attacker.id,
    attackerOwner: attacker.owner,
    attackerUnitType: unitType,
    targetId: target.id,
    targetKind: target.kind,
    originX: attacker.position.x,
    originY: attacker.position.y,
    aimX: aim.x,
    aimY: aim.y,
    // Wind-up delays the LOOSE, it does not slow the arrow: the shot appears
    // when it actually leaves the attacker and then flies at its own speed.
    launchTick: tick + windup,
    impactTick: tick + windup + flightTicks,
    baseDamage: attacker.baseDamage,
    buildingDamage: attacker.buildingDamage ?? null,
    attackType: unitType === null ? 'pierce' : unitAttackType(unitType),
    willHit,
    isArea,
  };
  slot.inFlight.push(projectile);
  return projectile;
}

export interface ResolveProjectilesDeps {
  world: GameWorld;
  slot: ProjectileSlotState;
  tick: number;
  combatStates: Map<number, CombatState>;
  /** Applies damage to a building and destroys it at zero HP. Returns true if it died. */
  damageBuilding: (buildingId: number, damage: number, attackerUnitType: UnitType | null, attackerOwner: number) => boolean;
  destroyUnit: (id: number) => void;
  addKill: (owner: number) => void;
  markCombatDirty: () => void;
  markRender: () => void;
}

/**
 * Land every projectile whose impact tick has arrived. A shot resolves exactly
 * once and always leaves the air, including when its target died mid-flight —
 * an unresolvable shot is a spent shot, not a stuck one.
 */
export function resolveDueProjectiles(deps: ResolveProjectilesDeps): void {
  const { slot, tick } = deps;
  if (slot.inFlight.length === 0) return;

  const due = slot.inFlight.filter((shot) => shot.impactTick <= tick);
  if (due.length === 0) return;
  slot.inFlight = slot.inFlight.filter((shot) => shot.impactTick > tick);

  // Ascending id keeps resolution order deterministic when several shots land
  // on the same tick.
  due.sort((a, b) => a.id - b.id);
  for (const shot of due) resolveOne(deps, shot);
  deps.markRender();
}

function resolveOne(deps: ResolveProjectilesDeps, shot: ProjectileState): void {
  const { world, combatStates } = deps;
  const impact: Position = { x: shot.aimX, y: shot.aimY };

  if (shot.targetKind === 'building') {
    if (shot.willHit) {
      deps.damageBuilding(
        shot.targetId,
        shot.buildingDamage ?? shot.baseDamage,
        shot.attackerUnitType,
        shot.attackerOwner,
      );
    }
  } else {
    const targetUnit = world.getComponent<UnitComponent>(shot.targetId, 'unit');
    const targetPosition = world.getComponent<Position>(shot.targetId, 'position');
    const targetCombat = combatStates.get(shot.targetId);
    // A direct hit needs a live target still standing where the shot was
    // aimed. An un-led shot at a moving unit fails right here — that is the
    // whole point of Ballistics.
    const connects = shot.willHit
      && !shot.isArea
      && targetUnit !== undefined
      && targetPosition !== undefined
      && targetCombat !== undefined
      && projectileHitsTarget(impact, targetPosition);
    if (connects) {
      const raw = shot.attackerUnitType === null
        ? shot.baseDamage
        : shot.baseDamage + attackBonusAgainstUnit(shot.attackerUnitType, targetUnit.unitType);
      targetCombat.currentHp -= combatDamageAfterArmor(
        raw,
        shot.attackType,
        effectiveMeleeArmor(targetUnit.unitType, targetCombat.armor),
        effectivePierceArmor(targetUnit.unitType, pierceArmorTechBonus(targetCombat)),
      );
      deps.markCombatDirty();
      if (targetCombat.currentHp <= 0) {
        if (targetUnit.owner !== shot.attackerOwner) deps.addKill(shot.attackerOwner);
        deps.destroyUnit(shot.targetId);
      }
    }
  }

  // The mangonel line damages by blast at wherever the stone came down — a
  // "missed" siege shot is still dangerous, including to its own side.
  if (shot.isArea && shot.attackerUnitType !== null) {
    applyUnitBlast({
      world,
      combatStates,
      attacker: {
        id: shot.attackerId,
        unitType: shot.attackerUnitType,
        owner: shot.attackerOwner,
        baseDamage: shot.baseDamage,
      },
      impact,
      primaryTargetId: -1,
      destroyUnit: deps.destroyUnit,
      addKill: deps.addKill,
      markDirty: deps.markCombatDirty,
    });
  }
}
