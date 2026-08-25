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
import type { ResearchableTechnologyType } from '../types';
import type { MapSize } from '../mapGeneration/constants';
import { parthianSpearmanAttackBonus } from '../parthianTechEffects';
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
  targetLeadVelocity,
  unitAccuracy,
} from '../projectileRules';
import { applyUnitBlast } from './blastDamage';
import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
  type GameWorld,
} from './pureHelpers';
import type { ProjectileSlotState, ProjectileState } from './projectileTypes';
import type { CombatState } from './systems/systemTypes';

export { firesProjectile };

// Every unit in this game shares one base ground speed (there is a single
// UNIT_SUBGRID_STEP_PER_TICK), so leading uses one constant rather than a
// per-unit lookup. Measured against a walking villager: 0.4 tiles/tick.
const UNIT_TILES_PER_TICK = UNIT_SUBGRID_STEP_PER_TICK / UNIT_SUBGRID_RESOLUTION;

/** The same point, pulled back onto the map if it lies outside it. */
function clampToMap(point: Position, size: MapSize): Position {
  return {
    x: Math.min(size.width - 1, Math.max(0, point.x)),
    y: Math.min(size.height - 1, Math.max(0, point.y)),
  };
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
    /** Where the target is walking to, or null if it is not going anywhere.
     *  Only consulted when the attacker leads (Ballistics). */
    destination?: Position | null;
  };
  /** Whether the attacker leads moving targets (Ballistics). */
  leads: boolean;
  /** Accuracy override in (0,1]; defaults to the attacker unit's own accuracy. */
  accuracy?: number;
  /** The map this shot is fired on — a miss is clamped to it (§4's ladder
   *  means the edges are not the same in every match). */
  mapSize: MapSize;
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

  const motion = params.leads
    ? targetLeadVelocity(
        target.position,
        target.destination ?? null,
        UNIT_TILES_PER_TICK,
        flightTicks,
      )
    : { x: 0, y: 0 };
  const aim = willHit
    ? projectileAimPoint(target.position, motion, flightTicks, params.leads)
    : projectileMissAimPoint(target.position, tick, attacker.id, target.id, id);

  // A shot never leaves the map. The miss scatter is a hash-driven offset in
  // any direction, so a target standing on an edge could be missed OFF the
  // board — and a projectile off the board is a coordinate the engine's
  // visibility map throws on rather than answering (it ended a 40000-tick
  // match at tick 24173, at grid (33, -1)). Clamping the AIM keeps every
  // interpolated position between origin and aim on the map too, since both
  // ends are. It cannot turn a miss into a hit: whether the shot connects is
  // `willHit`, decided above and untouched here.
  const aimOnMap = clampToMap(aim, params.mapSize);

  const projectile: ProjectileState = {
    id,
    attackerId: attacker.id,
    attackerOwner: attacker.owner,
    attackerUnitType: unitType,
    targetId: target.id,
    targetKind: target.kind,
    originX: attacker.position.x,
    originY: attacker.position.y,
    aimX: aimOnMap.x,
    aimY: aimOnMap.y,
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
  /** The shooting owner's researched set. Parthian Tactics' anti-spearman
   *  bonus is derived here rather than stored on the shot, because it depends
   *  on the TARGET's armor class — known only once the arrow lands. */
  technologiesFor: (owner: number) => ReadonlySet<ResearchableTechnologyType>;
}

/**
 * Land every projectile whose impact tick has arrived. A shot resolves exactly
 * once and always leaves the air, including when its target died mid-flight —
 * an unresolvable shot is a spent shot, not a stuck one.
 *
 * Returns true when a unit died, so the caller can refresh visibility once for
 * the whole pass. Deaths matter to fog: a killed unit stops seeing, and
 * projectiles are now the ONLY way tower/Town Center arrows kill.
 */
export function resolveDueProjectiles(deps: ResolveProjectilesDeps): boolean {
  const { slot, tick } = deps;
  if (slot.inFlight.length === 0) return false;

  const due = slot.inFlight.filter((shot) => shot.impactTick <= tick);
  if (due.length === 0) return false;
  slot.inFlight = slot.inFlight.filter((shot) => shot.impactTick > tick);

  // Ascending id keeps resolution order deterministic when several shots land
  // on the same tick.
  due.sort((a, b) => a.id - b.id);
  let killedAnyUnit = false;
  for (const shot of due) {
    if (resolveOne(deps, shot)) killedAnyUnit = true;
  }
  deps.markRender();
  return killedAnyUnit;
}

/** Resolves one shot. Returns true if it killed a unit. */
function resolveOne(deps: ResolveProjectilesDeps, shot: ProjectileState): boolean {
  const { world, combatStates } = deps;
  const impact: Position = { x: shot.aimX, y: shot.aimY };
  let killed = false;

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
        : shot.baseDamage
          + attackBonusAgainstUnit(shot.attackerUnitType, targetUnit.unitType)
          + parthianSpearmanAttackBonus(
            deps.technologiesFor(shot.attackerOwner),
            shot.attackerUnitType,
            targetUnit.unitType,
          );
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
        killed = true;
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
      destroyUnit: (id) => {
        killed = true;
        deps.destroyUnit(id);
      },
      addKill: deps.addKill,
      markDirty: deps.markCombatDirty,
    });
  }
  return killed;
}
