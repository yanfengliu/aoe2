import type { UnitRole } from '../roles/unitRole';
import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';
import { voxelPartWorldCorners } from './aoeVoxelGeometry';

export const UNIT_ATTACK_ANIMATION_DURATION_MS = 650;

export interface UnitAttackPoseState {
  readonly attackPhase: number;
  readonly attackWeight: number;
  readonly directionX: number;
  readonly directionZ: number;
  /** Root-to-target-centre distance; 0 when unknown (no reach correction). */
  readonly targetDistance: number;
}

// Melee rigs whose tip is meant to make contact, and how far each may lean to
// do it. Draw rigs (bows) and siege are absent on purpose: an archer's arrow
// is not modelled, so stretching a bow at a distant target would be nonsense.
const MELEE_TIP_SUFFIX: Partial<Record<UnitRole, string>> = {
  villager: 'villager-tool-head',
  infantry: 'infantry-sword',
  cavalry: 'cavalry-lance',
};
// How far the weapon assembly may lean, as a fraction of the actor's scale.
// Bounded by BODY COHERENCE, not by taste: the lean translates the upper body
// (tunic + arms + weapon) while the legs stay planted, so too much lean floats
// the torso off the hips. At villager scale 0.48 the legs span x 0.452-0.529
// and the tunic half-width is 0.125, so the tunic centre may travel ~0.154
// before it stops overlapping the legs — the pose itself already spends ~0.034
// of that. `bodyStaysCoherentDuringReachLean` in the reach suite pins this.
const MAX_REACH_LEAN: Partial<Record<UnitRole, number>> = {
  villager: 0.25,
  infantry: 0.25,
  cavalry: 0.35,
};
/** Land the tip just inside the target's near side rather than at its centre. */
const BITE_STANDOFF = 0.22;

function reachAlong(part: VoxelPart, state: UnitAttackPoseState, rootX: number, rootZ: number): number {
  let reach = -Infinity;
  for (const corner of voxelPartWorldCorners(part)) {
    reach = Math.max(
      reach,
      (corner.x - rootX) * state.directionX + (corner.z - rootZ) * state.directionZ,
    );
  }
  return reach;
}

/**
 * Close the gap between a melee tip and the target it captured.
 *
 * The authored arc uses a fixed forward displacement, so the tip landed
 * wherever the rig happened to put it — measured on the real boar hunt, a
 * villager's axe stopped 0.366 world units short of the boar and chopped air.
 * The root may not lunge (spec §14.5), so the correction is a BOUNDED lean of
 * the weapon assembly along the strike axis, scaled by the strike's own lunge
 * so it grows into the blow and retracts with the follow-through.
 */
function applyReachCorrection(
  posed: VoxelPart[],
  role: UnitRole,
  state: UnitAttackPoseState,
  scale: number,
  arc: number,
  rootX: number,
  rootZ: number,
): VoxelPart[] {
  const tipSuffix = MELEE_TIP_SUFFIX[role];
  const maxLean = MAX_REACH_LEAN[role];
  const lunge = Math.max(0, arc);
  // Fail CLOSED on every gate: `>` is false for NaN and undefined, so a state
  // built without the reach channel is a clean no-op rather than a
  // NaN-corrupted pose. (`targetDistance <= 0` would fail OPEN for undefined.)
  if (!tipSuffix || maxLean === undefined || !(lunge > 0) || !(state.targetDistance > 0)) {
    return posed;
  }
  const tip = posed.find((part) => suffixOf(part) === tipSuffix);
  if (!tip) return posed;
  const deficit = state.targetDistance - BITE_STANDOFF - reachAlong(tip, state, rootX, rootZ);
  const lean = Math.min(Math.max(0, deficit), maxLean * scale) * lunge;
  if (!(lean > 1e-4)) return posed;
  return posed.map((part) => (
    isUnitAttackControlledPart(suffixOf(part), role)
      ? {
        ...part,
        centerX: part.centerX + state.directionX * lean,
        centerZ: part.centerZ + state.directionZ * lean,
      }
      : part
  ));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function attackArc(phase: number): number {
  const normalized = clamp01(phase);
  if (normalized <= 0 || normalized >= 1) return 0;
  // Violence directive (spec §14.5, 2026-07-14): sampling honestly starts AT
  // the 0.55 impact sample, so the VISIBLE window must carry the whole read.
  // Load the coil through the production-invisible windup, hold it so the
  // first visible sample is fully loaded, whip-crack to the strike peak in
  // ~52 ms, then recover through one bounded recoil back to rest. Endpoints
  // stay exact no-ops (arc(0) === arc(1) === 0 — pinned by tests).
  if (normalized < 0.4) {
    return -0.85 * smoothstep(normalized / 0.4);
  }
  if (normalized < 0.55) {
    return -0.85;
  }
  const snapEnd = 0.586;
  if (normalized < snapEnd) {
    return -0.85 + 1.85 * smoothstep((normalized - 0.55) / (snapEnd - 0.55));
  }
  const recovery = (normalized - snapEnd) / (1 - snapEnd);
  return Math.cos(recovery * Math.PI * 1.5) * (1 - recovery) * (1 - recovery);
}

interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface AttackPivots {
  readonly tool?: Point3;
  readonly sword?: Point3;
  readonly bow?: Point3;
  readonly throwingArm?: Point3;
}

function suffixOf(part: VoxelPart): string {
  return part.key.slice(part.key.lastIndexOf(':') + 1);
}

function findPart(parts: readonly VoxelPart[], suffix: string): VoxelPart | undefined {
  return parts.find((part) => suffixOf(part) === suffix);
}

function centerOf(part: VoxelPart): Point3 {
  return { x: part.centerX, y: part.centerY, z: part.centerZ };
}

function lowerEndOf(part: VoxelPart): Point3 {
  const matrix = matrixForPart(part);
  return {
    x: part.centerX - matrix[4]! / 2,
    y: part.centerY - matrix[5]! / 2,
    z: part.centerZ - matrix[6]! / 2,
  };
}

function midpoint(first: VoxelPart, second: VoxelPart): Point3 {
  return {
    x: (first.centerX + second.centerX) / 2,
    y: (first.centerY + second.centerY) / 2,
    z: (first.centerZ + second.centerZ) / 2,
  };
}

function attackPivots(parts: readonly VoxelPart[], role: UnitRole): AttackPivots {
  if (role === 'villager') {
    const handle = findPart(parts, 'villager-tool-handle');
    return handle ? { tool: lowerEndOf(handle) } : {};
  }
  if (role === 'infantry') {
    const hilt = findPart(parts, 'infantry-sword-hilt');
    return hilt ? { sword: centerOf(hilt) } : {};
  }
  if (role === 'archer') {
    const grip = findPart(parts, 'archer-bow-grip');
    return grip ? { bow: centerOf(grip) } : {};
  }
  if (role === 'cavalry-archer') {
    const upper = findPart(parts, 'cavalry-archer-bow-upper');
    const lower = findPart(parts, 'cavalry-archer-bow-lower');
    return upper && lower ? { bow: midpoint(upper, lower) } : {};
  }
  if (role === 'siege') {
    const arm = findPart(parts, 'siege-throwing-arm');
    return arm ? { throwingArm: lowerEndOf(arm) } : {};
  }
  return {};
}

function rotateX(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x,
    y: point.y * cosine - point.z * sine,
    z: point.y * sine + point.z * cosine,
  };
}

function rotateY(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateZ(point: Point3, radians: number): Point3 {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: point.x * cosine - point.y * sine,
    y: point.x * sine + point.y * cosine,
    z: point.z,
  };
}

function rotateAttackOffset(
  offset: Point3,
  state: UnitAttackPoseState,
  yaw: number,
  pitch: number,
  roll: number,
): Point3 {
  const rolled = rotateY(
    rotateZ(rotateY(offset, -yaw), roll),
    yaw,
  );
  const heading = Math.atan2(state.directionX, state.directionZ);
  return rotateY(
    rotateX(rotateY(rolled, -heading), pitch),
    heading,
  );
}

function transformPart(
  part: VoxelPart,
  state: UnitAttackPoseState,
  forward: number,
  vertical: number,
  pitch: number,
  roll = 0,
  pivot?: Point3,
): VoxelPart {
  const rotatedOffset = pivot
    ? rotateAttackOffset(
      {
        x: part.centerX - pivot.x,
        y: part.centerY - pivot.y,
        z: part.centerZ - pivot.z,
      },
      state,
      part.yaw ?? 0,
      pitch,
      roll,
    )
    : undefined;
  return {
    ...part,
    centerX: (pivot && rotatedOffset ? pivot.x + rotatedOffset.x : part.centerX)
      + state.directionX * forward,
    centerY: (pivot && rotatedOffset ? pivot.y + rotatedOffset.y : part.centerY)
      + vertical,
    centerZ: (pivot && rotatedOffset ? pivot.z + rotatedOffset.z : part.centerZ)
      + state.directionZ * forward,
    pitch: (part.pitch ?? 0) + pitch,
    pitchHeadingRadians: Math.atan2(state.directionX, state.directionZ),
    roll: (part.roll ?? 0) + roll,
  };
}

function poseHumanoidAttack(
  part: VoxelPart,
  suffix: string,
  role: 'villager' | 'infantry' | 'archer',
  state: UnitAttackPoseState,
  scale: number,
  arc: number,
  pivots: AttackPivots,
): VoxelPart {
  const lunge = Math.max(0, arc);
  const windup = Math.max(0, -arc);
  if (role === 'archer') {
    if (suffix.includes('bow-')) {
      return transformPart(
        part,
        state,
        (lunge * 0.19 - windup * 0.06) * scale,
        windup * 0.04 * scale,
        -arc * 0.34,
        0,
        pivots.bow,
      );
    }
    if (suffix.includes('arm-left')) {
      return transformPart(part, state, lunge * 0.13 * scale, 0, -arc * 0.7);
    }
    if (suffix.includes('arm-right')) {
      return transformPart(
        part,
        state,
        (lunge * 0.06 - windup * 0.18) * scale,
        windup * 0.06 * scale,
        arc * 0.85,
      );
    }
    if (suffix.includes('tunic')) {
      return transformPart(part, state, lunge * 0.055 * scale, 0, -lunge * 0.13);
    }
    return part;
  }

  const weapon = role === 'villager'
    ? /(tool|arm-left|arm-right)/u.test(suffix)
    : /(sword|sword-hilt|arm-right)/u.test(suffix);
  if (weapon) {
    return transformPart(
      part,
      state,
      (lunge * 0.2 - windup * 0.075) * scale,
      (windup * 0.17 - lunge * 0.075) * scale,
      // Sign convention (review iter-1 HIGH): POSITIVE pitch swings the
      // weapon head forward-and-down about its pivot, negative swings it
      // up-and-back. The strike (arc -> +1) must therefore pitch POSITIVE so
      // the chop drives through the captured target, and the coil (arc < 0)
      // loads it over the shoulder. v0.2.3 used the opposite sign, which was
      // invisible while the window was a monotone decay and became a
      // backward strike once the coil->snap window was authored.
      arc * (role === 'villager' ? 1.6 : 1.25),
      arc * (role === 'villager' ? -0.27 : 0.21),
      suffix.includes('tool') ? pivots.tool
        : suffix.includes('sword') ? pivots.sword : undefined,
    );
  }
  if (role === 'infantry' && /(shield|arm-left)/u.test(suffix)) {
    return transformPart(part, state, lunge * 0.08 * scale, 0, -lunge * 0.24);
  }
  if (suffix.includes('tunic')) {
    return transformPart(part, state, lunge * 0.07 * scale, 0, -lunge * 0.16);
  }
  return part;
}

function poseCavalryAttack(
  part: VoxelPart,
  suffix: string,
  role: 'cavalry' | 'cavalry-archer',
  state: UnitAttackPoseState,
  scale: number,
  arc: number,
  pivots: AttackPivots,
): VoxelPart {
  const lunge = Math.max(0, arc);
  const windup = Math.max(0, -arc);
  if (role === 'cavalry-archer' && suffix.includes('bow-')) {
    return transformPart(
      part,
      state,
      (lunge * 0.24 - windup * 0.09) * scale,
      windup * 0.06 * scale,
      -arc * 0.42,
      0,
      pivots.bow,
    );
  }
  if (role === 'cavalry' && suffix.includes('lance')) {
    return transformPart(
      part,
      state,
      (lunge * 0.45 - windup * 0.18) * scale,
      -lunge * 0.04 * scale,
      -arc * 0.55,
    );
  }
  if (suffix.includes('rider-tunic')) {
    return transformPart(part, state, lunge * 0.1 * scale, 0, -lunge * 0.18);
  }
  if (role === 'cavalry' && suffix.includes('shield')) {
    return transformPart(part, state, lunge * 0.06 * scale, 0, -lunge * 0.15);
  }
  return part;
}

function poseSiegeAttack(
  part: VoxelPart,
  suffix: string,
  state: UnitAttackPoseState,
  scale: number,
  arc: number,
  pivots: AttackPivots,
): VoxelPart {
  const lunge = Math.max(0, arc);
  const windup = Math.max(0, -arc);
  if (suffix.includes('ram-beam') || suffix.includes('ram-head')) {
    return transformPart(
      part,
      state,
      (lunge * 0.34 - windup * 0.16) * scale,
      0,
      0,
    );
  }
  if (suffix.includes('throwing-arm') || suffix.includes('bucket')) {
    return transformPart(
      part,
      state,
      0,
      (windup * 0.06 - lunge * 0.03) * scale,
      // Same sign correction as the humanoid chop: the arm is loaded back at
      // the coil and snaps FORWARD through the release.
      arc * 1.1,
      arc * 0.08,
      pivots.throwingArm,
    );
  }
  if (suffix.includes('chassis') || suffix.includes('deck')) {
    return transformPart(part, state, -lunge * 0.035 * scale, 0, lunge * 0.04);
  }
  return part;
}

export function poseUnitAttackParts(
  parts: readonly VoxelPart[],
  role: UnitRole,
  state: UnitAttackPoseState,
  scale: number,
  rootX = 0,
  rootZ = 0,
): VoxelPart[] {
  const arc = attackArc(state.attackPhase) * clamp01(state.attackWeight);
  if (Math.abs(arc) <= Number.EPSILON || role === 'monk') return [...parts];
  const pivots = attackPivots(parts, role);
  const posed = parts.map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = suffixOf(part);
    if (role === 'villager' || role === 'infantry' || role === 'archer') {
      return poseHumanoidAttack(part, suffix, role, state, scale, arc, pivots);
    }
    if (role === 'cavalry' || role === 'cavalry-archer') {
      return poseCavalryAttack(part, suffix, role, state, scale, arc, pivots);
    }
    return poseSiegeAttack(part, suffix, state, scale, arc, pivots);
  });
  return applyReachCorrection(posed, role, state, scale, arc, rootX, rootZ);
}

export function isUnitAttackControlledPart(
  suffix: string,
  role: UnitRole,
): boolean {
  if (role === 'villager') {
    return /(tool|arm-left|arm-right|tunic)/u.test(suffix);
  }
  if (role === 'infantry') {
    return /(sword|arm-right|shield|arm-left|tunic)/u.test(suffix);
  }
  if (role === 'archer') {
    return /(bow|arm-left|arm-right|tunic)/u.test(suffix);
  }
  if (role === 'cavalry') {
    return /(lance|rider-tunic|shield)/u.test(suffix);
  }
  if (role === 'cavalry-archer') {
    return /(archer-bow|rider-tunic)/u.test(suffix);
  }
  if (role === 'siege') {
    return /(ram-beam|ram-head|throwing-arm|bucket|chassis|deck)/u.test(suffix);
  }
  return false;
}
