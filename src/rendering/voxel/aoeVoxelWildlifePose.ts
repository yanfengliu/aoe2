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
export function poseWildlifeAttackParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  sampleTimeMs: number,
): readonly VoxelPart[] {
  const sample = sampleUnitAttack(entity, sampleTimeMs);
  if (!sample || sample.poseWeight <= 0) return parts;
  const arc = goreArc(sample.phase) * sample.poseWeight;
  if (Math.abs(arc) < 1e-6) return parts;
  const scale = Math.max(0.38, entity.size);
  const centerX = entity.x + 0.5;
  const centerZ = entity.y + 0.5;
  // Rotate authored-forward (+x) motion onto the captured target direction:
  // the unit direction vector IS the rotation (cos = dirX, sin = dirZ).
  const { directionX, directionZ } = sample;
  const facingWeight = sample.poseWeight;
  const yawDelta = -Math.atan2(directionZ, directionX) * facingWeight;
  const pitchHeading = Math.atan2(directionX, directionZ);
  return parts.map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    const motion = goreMotionFor(suffix, arc, scale);
    // Whole-actor facing: swing every non-shadow part about the boar's root
    // toward the target, weighted by pose weight so entry/exit stay smooth.
    const localX = part.centerX - centerX + (motion?.shove ?? 0);
    const localZ = part.centerZ - centerZ;
    const cos = 1 + (directionX - 1) * facingWeight;
    const sin = directionZ * facingWeight;
    const norm = Math.hypot(cos, sin) || 1;
    const rotatedX = (localX * cos - localZ * sin) / norm;
    const rotatedZ = (localX * sin + localZ * cos) / norm;
    return {
      ...part,
      centerX: centerX + rotatedX,
      centerZ: centerZ + rotatedZ,
      centerY: part.centerY + (motion?.lift ?? 0),
      yaw: (part.yaw ?? 0) + yawDelta,
      ...(motion ? {
        pitch: (part.pitch ?? 0) + motion.pitch,
        pitchHeadingRadians: pitchHeading,
      } : {}),
    };
  });
}
