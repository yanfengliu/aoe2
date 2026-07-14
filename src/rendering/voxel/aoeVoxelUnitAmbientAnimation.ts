import type { UnitRole } from '../roles/unitRole';
import type { VoxelPartAnimation } from './aoeVoxelRecipeTypes';
import { isUnitAttackControlledPart } from './aoeVoxelUnitAttackAnimation';

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

interface AmbientAnimationState {
  readonly phaseRadians: number;
  readonly attackWeight: number;
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
): VoxelPartAnimation | undefined {
  if (state.attackWeight > 0 && isUnitAttackControlledPart(suffix, role)) {
    return undefined;
  }
  const base = ambientBodyMotion(state, scale);
  if (role === 'villager' || role === 'infantry' || role === 'archer') {
    if (/(boot|leg|arm|tool|sword|bow|shield)/u.test(suffix)) return undefined;
    return base;
  }
  if (role === 'cavalry' || role === 'cavalry-archer') {
    if (suffix.includes('horse-leg')) return undefined;
    if (suffix.includes('horse-tail')) {
      return motion(780, state.phaseRadians + 0.7, ZERO, { x: 0, y: 0, z: 0.24 });
    }
    return base;
  }
  if (role === 'siege') {
    if (suffix.includes('wheel')) return undefined;
    if (suffix.includes('throwing-arm') || suffix.includes('bucket')) {
      return motion(1_200, state.phaseRadians + 0.4, ZERO, { x: 0, y: 0, z: 0.18 });
    }
    return base;
  }
  if (suffix.includes('sleeve-left')) {
    return motion(1_100, state.phaseRadians, ZERO, { x: 0, y: 0, z: 0.2 });
  }
  if (suffix.includes('sleeve-right')) {
    return motion(1_100, state.phaseRadians + Math.PI, ZERO, { x: 0, y: 0, z: 0.2 });
  }
  if (suffix.includes('staff')) {
    return motion(1_500, state.phaseRadians + 0.5, ZERO, { x: 0, y: 0, z: 0.08 });
  }
  return base;
}
