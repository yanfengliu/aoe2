// In-flight projectile state (spec §10.4). A projectile is a committed event:
// once launched it lands on its impact tick regardless of what happens to the
// attacker, so everything needed to resolve it is captured at launch.
//
// This is simulation state — it serializes into saves and replays through
// `projectilesCodec`, so a match saved with arrows in the air reloads with
// those same arrows still flying.
//
// A shot names its shooter and its target by entity id AND generation.
// civ-engine hands a freed id to the next entity it creates, so by the time a
// shot lands its target's id can belong to a new entity, possibly another
// player's; the generation tells the two apart, and a shot acts on neither of
// its entities once that entity is gone (spec §10.4, `projectileOps.ts`). A
// shot saved or recorded before shots carried generations has none, and is
// resolved by bare id as every shot was then (the bound, also in §10.4).

import type { AttackType } from '../prototypeUnitRules';
import type { UnitType } from '../types';

/** The generation stored for an id that names no live entity at launch (a
 *  bombardment of the ground names target -1). civ-engine's generations start
 *  at 0, so it matches no entity, ever. */
export const NO_ENTITY_GENERATION = -1;

export interface ProjectileState {
  /** Monotonic per-match id; also the shot ordinal feeding the accuracy roll. */
  readonly id: number;
  readonly attackerId: number;
  /** The shooter's generation at launch. Absent on a shot saved or recorded
   *  before shots carried generations. */
  readonly attackerGeneration?: number;
  readonly attackerOwner: number;
  /** `null` for a building's arrow (towers, Town Centers, Castles). */
  readonly attackerUnitType: UnitType | null;
  /** Acted on only together with `targetGeneration`, except on a shot saved
   *  or recorded before shots carried generations (`projectileOps.ts`). */
  readonly targetId: number;
  /** The target's generation at launch, or `NO_ENTITY_GENERATION` when the
   *  shot names no live entity. Absent on a shot saved or recorded before
   *  shots carried generations. */
  readonly targetGeneration?: number;
  /** `wildlife` is a wolf or a boar: a resource with a wildlife state (v0.3.238). */
  readonly targetKind: 'unit' | 'building' | 'wildlife';
  readonly originX: number;
  readonly originY: number;
  /** Where the shot is headed — the lead point, or a scatter point on a miss. */
  readonly aimX: number;
  readonly aimY: number;
  readonly launchTick: number;
  readonly impactTick: number;
  /**
   * Attacker's raw attack stat, snapshotted at launch. Drives unit hits and
   * blast; target armor is applied on impact.
   */
  readonly baseDamage: number;
  /**
   * Total damage for a BUILDING hit — base plus the anti-building bonuses,
   * which must never reach units. `null` for a unit-targeted shot. (A siege
   * weapon's +35 vs buildings would otherwise one-shot infantry through its
   * own blast.)
   */
  readonly buildingDamage: number | null;
  readonly attackType: AttackType;
  /** Result of the accuracy roll, decided at launch. */
  readonly willHit: boolean;
  /** Mangonel-line shot: damages by blast at the impact point, never by hit. */
  readonly isArea: boolean;
}

/** The whole slot: in-flight shots plus the id counter that keeps ids unique. */
export interface ProjectileSlotState {
  nextId: number;
  inFlight: ProjectileState[];
}

export function createEmptyProjectileSlot(): ProjectileSlotState {
  return { nextId: 1, inFlight: [] };
}
