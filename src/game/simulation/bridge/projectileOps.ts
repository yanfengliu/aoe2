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
//
// A shot acts on its target and its shooter only while each is still the
// entity it named at launch, by generation (spec §10.4). civ-engine hands a
// freed id to the next entity it creates, so a stone aimed at a House that was
// deleted in its flight came down on the foundation that took the House's id
// (defect register, 2026-10-11).

import type { EntityRef, Position } from 'civ-engine';

import type { BuildingComponent, UnitComponent, UnitType } from '../types';
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
import { damageAnimal } from './animalDamage';
import { applyUnitBlast, type BlastAnimals } from './blastDamage';
import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
  type GameWorld,
} from './pureHelpers';
import { NO_ENTITY_GENERATION, type ProjectileSlotState, type ProjectileState } from './projectileTypes';
import type { CombatState } from './systems/systemTypes';
import type { RecordPlayerHit } from './playerHitFeed';

export { firesProjectile };

// Projectile lead uses the VILLAGER-reference base speed (0.08 tiles/tick at
// the §12.4.2 clock — derived, not hardcoded). Per-unit movement_rate
// percents mean a real target may run up to ~2x this; the lead is a hint,
// not a guarantee, and arrows already re-home per tick.
const UNIT_TILES_PER_TICK = UNIT_SUBGRID_STEP_PER_TICK / UNIT_SUBGRID_RESOLUTION;

/** The same point, pulled back onto the map if it lies outside it. */
function clampToMap(point: Position, size: MapSize): Position {
  return {
    x: Math.min(size.width - 1, Math.max(0, point.x)),
    y: Math.min(size.height - 1, Math.max(0, point.y)),
  };
}

export interface LaunchProjectileParams {
  /** The world the shot is loosed in. The shot takes its shooter's and its
   *  target's generation from it, to tell each from any entity that takes
   *  its id before the shot lands. */
  world: Pick<GameWorld, 'getEntityRef'>;
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
    /** A building's position is the centre of its footprint (spec §10.7). */
    kind: 'unit' | 'building' | 'wildlife';
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

/** The generation of the entity living at `id` now, or `NO_ENTITY_GENERATION`
 *  when none does (a bombardment of the ground names target -1). */
function generationAtLaunch(world: Pick<GameWorld, 'getEntityRef'>, id: number): number {
  return world.getEntityRef(id)?.generation ?? NO_ENTITY_GENERATION;
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
  // was aimed — neither rolls to hit. A unit and an animal do.
  const rolls = target.kind !== 'building' && !isArea && accuracy < 1;
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
    attackerGeneration: generationAtLaunch(params.world, attacker.id),
    attackerOwner: attacker.owner,
    attackerUnitType: unitType,
    targetId: target.id,
    targetGeneration: generationAtLaunch(params.world, target.id),
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
  /** Who is on whose side (`playerTeamsCodec`), for a blast that spares its
   *  own side. */
  teams: ReadonlyMap<number, number>;
  /** The animals a shot or its blast can hurt, and how a blow on one lands. */
  animals: BlastAnimals;
  /** Every shot that lands on a unit or a building, and every unit its blast
   *  catches, is a blow for the attack warning — a tower's and a Town
   *  Centre's arrows as much as an archer's (v0.3.235). */
  recordPlayerHit: RecordPlayerHit;
}

/**
 * The id of an entity the shot names, while it is still the entity the shot
 * named at launch; null once that entity is gone, even when another has taken
 * its id since. A shot saved or recorded before shots carried generations
 * names whatever holds the id, as every shot did then (spec §10.4's bound).
 */
function namedEntity(world: GameWorld, id: number, generation: number | undefined): number | null {
  if (generation === undefined) return id;
  return world.isCurrent({ id, generation }) ? id : null;
}

/**
 * The unit that loosed this shot, for an animal it hurts to turn on: the
 * shooter while it is still the unit that loosed the shot, whoever owns it
 * now, and null once it is gone, even when another unit has taken its id
 * since. A building's arrow has no unit to turn on. A shot saved or recorded
 * before shots carried generations is told apart by its owner instead, which
 * rules out another player's unit only: a unit of the shooter's owner that
 * took a dead shooter's id is turned on in its place.
 */
function shooterRef(world: GameWorld, shot: ProjectileState): EntityRef | null {
  const unit = world.getComponent<UnitComponent>(shot.attackerId, 'unit');
  if (!unit) return null;
  if (shot.attackerGeneration === undefined) {
    return unit.owner === shot.attackerOwner ? world.getEntityRef(shot.attackerId) : null;
  }
  const ref: EntityRef = { id: shot.attackerId, generation: shot.attackerGeneration };
  return world.isCurrent(ref) ? ref : null;
}

/**
 * Land every projectile whose impact tick has arrived. A shot resolves exactly
 * once and always leaves the air, including when its target died mid-flight —
 * an unresolvable shot is a spent shot, not a stuck one.
 *
 * Returns true when a unit died or a building was destroyed, so the caller can
 * refresh visibility once for the whole pass. Deaths matter to fog: a killed
 * unit stops seeing, and so does a destroyed building, since every building
 * sees (2026-09-24); projectiles are the ONLY way tower/Town Center arrows kill.
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
  let somethingDied = false;
  for (const shot of due) {
    if (resolveOne(deps, shot)) somethingDied = true;
  }
  deps.markRender();
  return somethingDied;
}

/** Resolves one shot. Returns true if it killed a unit or destroyed a building. */
function resolveOne(deps: ResolveProjectilesDeps, shot: ProjectileState): boolean {
  const { world, combatStates } = deps;
  const impact: Position = { x: shot.aimX, y: shot.aimY };
  // What the shot was aimed at, while it is still that entity. Once it is gone
  // the shot deals nothing to whatever has taken its id, and only a blast
  // still lands.
  const targetId = namedEntity(world, shot.targetId, shot.targetGeneration);
  let killed = targetId !== null && landOnTarget(deps, shot, targetId, impact);

  // The mangonel line damages by blast at wherever the stone came down — a
  // "missed" siege shot is still dangerous, including to its own side.
  if (shot.isArea && shot.attackerUnitType !== null) {
    applyUnitBlast({
      world,
      combatStates,
      attacker: {
        // The blast spares its shooter only while the shooter is still the
        // unit that loosed it; a unit that took a dead shooter's id is caught.
        id: namedEntity(world, shot.attackerId, shot.attackerGeneration) ?? -1,
        unitType: shot.attackerUnitType,
        owner: shot.attackerOwner,
        baseDamage: shot.baseDamage,
        ref: shooterRef(world, shot),
      },
      impact,
      primaryTargetId: -1,
      teams: deps.teams,
      animals: deps.animals,
      destroyUnit: (id) => {
        killed = true;
        deps.destroyUnit(id);
      },
      addKill: deps.addKill,
      markDirty: deps.markCombatDirty,
      // Every splash is recorded in the shot's name, its shooter's id at
      // launch, as its direct hit is.
      recordPlayerHit: (_shooterId, owner, splashedId) => deps.recordPlayerHit(shot.attackerId, owner, splashedId),
    });
  }
  return killed;
}

/** The shot's direct effect on its target, the entity it was aimed at.
 *  Returns true if it killed a unit or destroyed a building. */
function landOnTarget(deps: ResolveProjectilesDeps, shot: ProjectileState, targetId: number, impact: Position): boolean {
  const { world, combatStates } = deps;
  if (shot.targetKind === 'building') {
    if (!shot.willHit) return false;
    // Recorded first, because a building the shot razes is gone after the
    // damage. And only while the target is a building: a shot saved before
    // shots carried generations can find a new unit at its target's id, and a
    // shot at a building deals a unit nothing (independent review of v0.3.235).
    if (world.getComponent<BuildingComponent>(targetId, 'building')) {
      deps.recordPlayerHit(shot.attackerId, shot.attackerOwner, targetId);
    }
    return deps.damageBuilding(
      targetId,
      shot.buildingDamage ?? shot.baseDamage,
      shot.attackerUnitType,
      shot.attackerOwner,
    );
  }
  if (shot.targetKind === 'wildlife') {
    // A shot at an animal connects as one at a unit does: on an animal still
    // alive and still standing where the shot was aimed. It deals the
    // attacker's attack whole, as any blow on an animal does.
    const animal = deps.animals.states.get(targetId);
    const at = world.getComponent<Position>(targetId, 'position');
    if (shot.willHit && !shot.isArea && animal?.isAlive === true && at !== undefined && projectileHitsTarget(impact, at)) {
      damageAnimal(deps.animals, targetId, shot.baseDamage, shooterRef(world, shot));
    }
    return false;
  }
  const targetUnit = world.getComponent<UnitComponent>(targetId, 'unit');
  const targetPosition = world.getComponent<Position>(targetId, 'position');
  const targetCombat = combatStates.get(targetId);
  // A direct hit needs a live target still standing where the shot was
  // aimed. An un-led shot at a moving unit fails right here — that is the
  // whole point of Ballistics.
  const connects = shot.willHit
    && !shot.isArea
    && targetUnit !== undefined
    && targetPosition !== undefined
    && targetCombat !== undefined
    && projectileHitsTarget(impact, targetPosition);
  if (!connects) return false;
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
  deps.recordPlayerHit(shot.attackerId, shot.attackerOwner, targetId);
  deps.markCombatDirty();
  if (targetCombat.currentHp > 0) return false;
  if (targetUnit.owner !== shot.attackerOwner) deps.addKill(shot.attackerOwner);
  deps.destroyUnit(targetId);
  return true;
}
