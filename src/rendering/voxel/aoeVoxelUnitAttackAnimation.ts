import type { UnitRole } from '../roles/unitRole';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import { voxelPartWorldCorners } from './aoeVoxelGeometry';
import {
  unitPartSuffix,
} from './aoeVoxelUnitAttackGeometry';
import { poseConcreteUnitAttackPart } from './aoeVoxelUnitAttackPoseStyles';
import {
  resolveUnitAttackPivot,
  unitAttackRigControlsPart,
  type UnitAttackRig,
} from './aoeVoxelUnitAttackRigs';
import { clamp01, smoothstep } from './voxelMath';

export const UNIT_ATTACK_ANIMATION_DURATION_MS = 650;

export interface UnitAttackPoseState {
  readonly attackPhase: number;
  readonly attackWeight: number;
  readonly directionX: number;
  readonly directionZ: number;
  /** Root-to-target-centre distance; 0 when unknown (no reach correction). */
  readonly targetDistance: number;
}

/** Land the tip just inside the target's near side rather than at its centre. */
const BITE_STANDOFF = 0.22;

function reachAlong(
  part: VoxelPart,
  state: UnitAttackPoseState,
  rootX: number,
  rootZ: number,
): number {
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
 * Close a melee gap with a bounded upper-body lean. Roots and feet remain
 * authoritative and planted; the cap preserves torso/hip overlap.
 */
function applyReachCorrection(
  posed: VoxelPart[],
  rig: UnitAttackRig,
  state: UnitAttackPoseState,
  scale: number,
  arc: number,
  rootX: number,
  rootZ: number,
): VoxelPart[] {
  const tipSuffix = rig.meleeReach?.tipSuffix;
  const maxLean = rig.meleeReach?.maxLeanScale;
  const lunge = Math.max(0, arc);
  if (!tipSuffix || maxLean === undefined || !(lunge > 0) || !(state.targetDistance > 0)) {
    return posed;
  }
  const tip = posed.find((part) => unitPartSuffix(part) === tipSuffix);
  if (!tip) return posed;
  const deficit = state.targetDistance - BITE_STANDOFF - reachAlong(tip, state, rootX, rootZ);
  const lean = Math.min(Math.max(0, deficit), maxLean * scale) * lunge;
  if (!(lean > 1e-4)) return posed;
  return posed.map((part) => (
    unitAttackRigControlsPart(rig, unitPartSuffix(part))
      ? {
        ...part,
        centerX: part.centerX + state.directionX * lean,
        centerZ: part.centerZ + state.directionZ * lean,
      }
      : part
  ));
}

function attackArc(phase: number): number {
  const normalized = clamp01(phase);
  if (normalized <= 0 || normalized >= 1) return 0;
  if (normalized < 0.4) return -0.85 * smoothstep(normalized / 0.4);
  if (normalized < 0.55) return -0.85;
  const snapEnd = 0.586;
  if (normalized < snapEnd) {
    return -0.85 + 1.85 * smoothstep((normalized - 0.55) / (snapEnd - 0.55));
  }
  const recovery = (normalized - snapEnd) / (1 - snapEnd);
  return Math.cos(recovery * Math.PI * 1.5) * (1 - recovery) * (1 - recovery);
}

export function poseUnitAttackParts(
  parts: readonly VoxelPart[],
  _role: UnitRole,
  rig: UnitAttackRig,
  state: UnitAttackPoseState,
  scale: number,
  rootX = 0,
  rootZ = 0,
): VoxelPart[] {
  const arc = attackArc(state.attackPhase) * clamp01(state.attackWeight);
  if (Math.abs(arc) <= Number.EPSILON || rig.style === 'none') return [...parts];
  const pivot = resolveUnitAttackPivot(parts, rig);
  const posed = parts.map((part) => {
    if (part.surface === 'shadow') return part;
    return poseConcreteUnitAttackPart(
      part,
      unitPartSuffix(part),
      rig.style,
      state,
      scale,
      arc,
      pivot,
    );
  });
  return applyReachCorrection(posed, rig, state, scale, arc, rootX, rootZ);
}
