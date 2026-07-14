import type { UnitRole } from '../roles/unitRole';
import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';

export const UNIT_ATTACK_ANIMATION_DURATION_MS = 650;

export interface UnitAttackPoseState {
  readonly attackPhase: number;
  readonly attackWeight: number;
  readonly directionX: number;
  readonly directionZ: number;
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
  if (normalized < 0.35) {
    return -0.65 * smoothstep(normalized / 0.35);
  }
  if (normalized < 0.55) {
    const transition = smoothstep((normalized - 0.35) / 0.2);
    return -0.65 + transition * 1.65;
  }
  return 1 - smoothstep((normalized - 0.55) / 0.45);
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
        (lunge * 0.13 - windup * 0.04) * scale,
        windup * 0.025 * scale,
        -arc * 0.22,
        0,
        pivots.bow,
      );
    }
    if (suffix.includes('arm-left')) {
      return transformPart(part, state, lunge * 0.09 * scale, 0, -arc * 0.48);
    }
    if (suffix.includes('arm-right')) {
      return transformPart(
        part,
        state,
        (lunge * 0.04 - windup * 0.12) * scale,
        windup * 0.04 * scale,
        arc * 0.58,
      );
    }
    if (suffix.includes('tunic')) {
      return transformPart(part, state, lunge * 0.035 * scale, 0, -lunge * 0.08);
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
      (lunge * 0.14 - windup * 0.05) * scale,
      (windup * 0.12 - lunge * 0.05) * scale,
      -arc * (role === 'villager' ? 1.05 : 0.82),
      arc * (role === 'villager' ? -0.18 : 0.14),
      suffix.includes('tool') ? pivots.tool
        : suffix.includes('sword') ? pivots.sword : undefined,
    );
  }
  if (role === 'infantry' && /(shield|arm-left)/u.test(suffix)) {
    return transformPart(part, state, lunge * 0.055 * scale, 0, -lunge * 0.16);
  }
  if (suffix.includes('tunic')) {
    return transformPart(part, state, lunge * 0.045 * scale, 0, -lunge * 0.1);
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
      (lunge * 0.16 - windup * 0.06) * scale,
      windup * 0.04 * scale,
      -arc * 0.28,
      0,
      pivots.bow,
    );
  }
  if (role === 'cavalry' && suffix.includes('lance')) {
    return transformPart(
      part,
      state,
      (lunge * 0.3 - windup * 0.12) * scale,
      -lunge * 0.025 * scale,
      -arc * 0.36,
    );
  }
  if (suffix.includes('rider-tunic')) {
    return transformPart(part, state, lunge * 0.065 * scale, 0, -lunge * 0.12);
  }
  if (role === 'cavalry' && suffix.includes('shield')) {
    return transformPart(part, state, lunge * 0.04 * scale, 0, -lunge * 0.1);
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
      -arc * 1.1,
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
): VoxelPart[] {
  const arc = attackArc(state.attackPhase) * clamp01(state.attackWeight);
  if (Math.abs(arc) <= Number.EPSILON || role === 'monk') return [...parts];
  const pivots = attackPivots(parts, role);
  return parts.map((part) => {
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
