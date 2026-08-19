// In-flight projectile state (spec §10.4). A projectile is a committed event:
// once launched it lands on its impact tick regardless of what happens to the
// attacker, so everything needed to resolve it is captured at launch.
//
// This is simulation state — it serializes into saves and replays through
// `projectilesCodec`, so a match saved with arrows in the air reloads with
// those same arrows still flying.

import type { AttackType } from '../prototypeUnitRules';
import type { UnitType } from '../types';

export interface ProjectileState {
  /** Monotonic per-match id; also the shot ordinal feeding the accuracy roll. */
  readonly id: number;
  readonly attackerId: number;
  readonly attackerOwner: number;
  /** `null` for a building's arrow (towers, Town Centers, Castles). */
  readonly attackerUnitType: UnitType | null;
  readonly targetId: number;
  readonly targetKind: 'unit' | 'building';
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
