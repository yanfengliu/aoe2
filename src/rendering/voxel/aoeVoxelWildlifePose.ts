import type { ProjectedEntityView } from '../../game/simulation/types';
import { sampleUnitAttack } from './aoeVoxelUnitAttackSampling';
import type { VoxelPart } from './aoeVoxelRecipeTypes';

// Same whip-crack family as the unit attack arc's visible window (spec §14.5
// violence directive): reared coil at the 0.55 impact sample, snap into the
// gore by ~52 ms, one bounded recoil, exact zero at the window end.
const GORE_SNAP_END = 0.586;

function smoothstep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

function goreArc(phase: number): number {
  const p = Math.max(0.55, Math.min(1, phase));
  if (p >= 1) return 0;
  if (p < GORE_SNAP_END) {
    return -0.7 + 1.7 * smoothstep((p - 0.55) / (GORE_SNAP_END - 0.55));
  }
  const recovery = (p - GORE_SNAP_END) / (1 - GORE_SNAP_END);
  return Math.cos(recovery * Math.PI * 1.5) * (1 - recovery) * (1 - recovery);
}

interface GoreMotion {
  readonly pitch: number;
  readonly shove: number;
  readonly lift: number;
}

function goreMotionFor(suffix: string, arc: number, scale: number): GoreMotion | null {
  const lunge = Math.max(0, arc);
  const coil = Math.max(0, -arc);
  if (/boar-(head|tusk|bristles)/u.test(suffix)) {
    return {
      pitch: arc * 0.5,
      shove: (lunge * 0.24 - coil * 0.1) * scale,
      lift: (coil * 0.12 - lunge * 0.06) * scale,
    };
  }
  if (suffix.includes('boar-body')) {
    return { pitch: arc * 0.16, shove: (lunge * 0.09 - coil * 0.04) * scale, lift: 0 };
  }
  return null;
}

/**
 * Wildlife retaliation gore pose (spec §14.5): a boar with a live
 * `attackAnimation` channel rears and gores toward the captured target.
 * Applied at snapshot-build time onto the static resource lane, so equal
 * presented time freezes the pose exactly like every other cue; outside the
 * strike window the parts are returned untouched (byte-identical rest).
 */
/** The direction a boar is looking: its last strike's target direction. */
export interface WildlifeFacing {
  readonly directionX: number;
  readonly directionZ: number;
}

/**
 * Facing is STICKY and deliberately independent of the gore's pose weight: an
 * animal that lunged at something keeps looking at it once the strike is over,
 * rather than swinging back to its authored forward. Weighting facing by the
 * decaying pose weight (v0.2.8) made a boar rotate back after every bite and
 * snap again on the next one — it read as turning back and forth.
 *
 * Disposable render history, exactly like unit gait: never persisted, never a
 * replay contract, rebuilt from the next strike a fresh renderer observes.
 */
export function resolveWildlifeFacing(
  entity: ProjectedEntityView,
  sampleTimeMs: number,
  previous: WildlifeFacing | undefined,
): WildlifeFacing | undefined {
  const sample = sampleUnitAttack(entity, sampleTimeMs);
  if (!sample) return previous;
  return { directionX: sample.directionX, directionZ: sample.directionZ };
}

/**
 * Wildlife retaliation gore pose (spec §14.5): a boar with a live
 * `attackAnimation` channel rears and gores toward the captured target, and
 * holds `facing` between strikes. Applied at snapshot-build time onto the
 * static resource lane, so equal presented time freezes it like every other
 * cue; with neither an active strike nor a retained facing the parts are
 * returned untouched (byte-identical rest).
 */
export function poseWildlifeAttackParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  sampleTimeMs: number,
  facing: WildlifeFacing | undefined,
): readonly VoxelPart[] {
  const sample = sampleUnitAttack(entity, sampleTimeMs);
  const goreWeight = sample?.poseWeight ?? 0;
  const arc = goreWeight > 0 ? goreArc(sample!.phase) * goreWeight : 0;
  const hasGore = Math.abs(arc) > 1e-6;
  if (!hasGore && !facing) return parts;
  const scale = Math.max(0.38, entity.size);
  const centerX = entity.x + 0.5;
  const centerZ = entity.y + 0.5;
  // The facing vector IS the rotation: authored-forward is +x, so a unit
  // direction (cos, sin) rotates the body onto the target bearing.
  const cos = facing?.directionX ?? 1;
  const sin = facing?.directionZ ?? 0;
  const norm = Math.hypot(cos, sin) || 1;
  const yawDelta = facing ? -Math.atan2(sin, cos) : 0;
  const pitchHeading = Math.atan2(cos, sin);
  return parts.map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    const motion = hasGore ? goreMotionFor(suffix, arc, scale) : null;
    const localX = part.centerX - centerX + (motion?.shove ?? 0);
    const localZ = part.centerZ - centerZ;
    return {
      ...part,
      centerX: centerX + (localX * cos - localZ * sin) / norm,
      centerZ: centerZ + (localX * sin + localZ * cos) / norm,
      centerY: part.centerY + (motion?.lift ?? 0),
      yaw: (part.yaw ?? 0) + yawDelta,
      ...(motion ? {
        pitch: (part.pitch ?? 0) + motion.pitch,
        pitchHeadingRadians: pitchHeading,
      } : {}),
    };
  });
}
