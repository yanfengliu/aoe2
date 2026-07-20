import type { UnitRole } from '../roles/unitRole';
import type { VoxelPartAnimation } from './aoeVoxelRecipeTypes';
import {
  unitAttackRigForRole,
  unitAttackRigControlsPart,
  type UnitAttackRig,
} from './aoeVoxelUnitAttackRigs';
import { clamp01 } from './voxelMath';

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

interface AmbientAnimationState {
  readonly phaseRadians: number;
  readonly ambientSuppressionWeight: number;
}

function scaleVector(
  value: VoxelPartAnimation['translationAmplitude'],
  weight: number,
): VoxelPartAnimation['translationAmplitude'] {
  return { x: value.x * weight, y: value.y * weight, z: value.z * weight };
}

function scaleMotion(animation: VoxelPartAnimation, weight: number): VoxelPartAnimation {
  return {
    ...animation,
    translationAmplitude: scaleVector(animation.translationAmplitude, weight),
    rotationAmplitude: scaleVector(animation.rotationAmplitude, weight),
    scaleAmplitude: scaleVector(animation.scaleAmplitude, weight),
  };
}

function motion(
  periodMs: number,
  phaseRadians: number,
  translationAmplitude: VoxelPartAnimation['translationAmplitude'] = ZERO,
  rotationAmplitude: VoxelPartAnimation['rotationAmplitude'] = ZERO,
  scaleAmplitude: VoxelPartAnimation['scaleAmplitude'] = ZERO,
): VoxelPartAnimation {
  return {
    periodMs,
    phaseRadians,
    translationAmplitude,
    rotationAmplitude,
    scaleAmplitude,
  };
}

function ambientBodyMotion(
  state: AmbientAnimationState,
  scale: number,
): VoxelPartAnimation {
  return motion(
    1_400,
    state.phaseRadians,
    { x: scale * 0.005, y: scale * 0.026, z: 0 },
    ZERO,
    { x: 0.006, y: 0.012, z: 0.006 },
  );
}

export function unitAmbientAnimation(
  suffix: string,
  role: UnitRole,
  state: AmbientAnimationState,
  scale: number,
  attackRig: UnitAttackRig = unitAttackRigForRole(role),
): VoxelPartAnimation | undefined {
  const base = ambientBodyMotion(state, scale);
  let animation: VoxelPartAnimation | undefined;
  if (role === 'villager' || role === 'infantry' || role === 'archer') {
    if (/(boot|leg|arm|tool|sword|bow|shield|polearm|halberd|javelin)/u.test(suffix)) {
      return undefined;
    }
    animation = base;
  } else if (role === 'cavalry' || role === 'cavalry-archer') {
    if (suffix.includes('horse-leg')) return undefined;
    if (suffix.includes('horse-tail')) {
      animation = motion(780, state.phaseRadians + 0.7, ZERO, { x: 0, y: 0, z: 0.24 });
    } else {
      animation = base;
    }
  } else if (role === 'siege') {
    if (suffix.includes('wheel')) return undefined;
    if (suffix.includes('throwing-arm') || suffix.includes('bucket')) {
      animation = motion(1_200, state.phaseRadians + 0.4, ZERO, { x: 0, y: 0, z: 0.18 });
    } else {
      animation = base;
    }
  } else if (suffix.includes('sleeve-left')) {
    animation = motion(1_100, state.phaseRadians, ZERO, { x: 0, y: 0, z: 0.2 });
  } else if (suffix.includes('sleeve-right')) {
    animation = motion(1_100, state.phaseRadians + Math.PI, ZERO, { x: 0, y: 0, z: 0.2 });
  } else if (suffix.includes('staff')) {
    animation = motion(1_500, state.phaseRadians + 0.5, ZERO, { x: 0, y: 0, z: 0.08 });
  } else {
    animation = base;
  }
  if (!unitAttackRigControlsPart(attackRig, suffix)) return animation;
  return scaleMotion(animation, 1 - clamp01(state.ambientSuppressionWeight));
}
