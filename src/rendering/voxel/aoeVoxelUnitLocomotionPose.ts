// Locomotion posing for voxel units: how each role's parts move through a
// gait cycle. Extracted from `aoeVoxelUnitAnimation` (which owns the state
// machine — sampling, smoothing, and channel orchestration) so the two
// lifecycles stay separable and each file stays under the 500-LOC budget.

import type { UnitRole } from '../roles/unitRole';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import { matrixForPart } from './aoeVoxelRecipeTypes';
import type { AoeUnitAnimationState } from './aoeVoxelUnitAnimationState';

export function movePart(
  part: VoxelPart,
  x: number,
  y: number,
  z: number,
  pitch: number,
  pitchHeadingRadians?: number,
): VoxelPart {
  return {
    ...part,
    centerX: part.centerX + x,
    centerY: part.centerY + y,
    centerZ: part.centerZ + z,
    pitch: (part.pitch ?? 0) + pitch,
    ...(pitchHeadingRadians === undefined ? {} : { pitchHeadingRadians }),
  };
}

function keepBottomAbove(part: VoxelPart, minimumY: number): VoxelPart {
  const matrix = matrixForPart(part);
  const halfExtentY = (
    Math.abs(matrix[1]!) + Math.abs(matrix[5]!) + Math.abs(matrix[9]!)
  ) / 2;
  const penetration = minimumY - (part.centerY - halfExtentY);
  return penetration > 0 ? { ...part, centerY: part.centerY + penetration } : part;
}

function poseHumanoidPart(
  part: VoxelPart,
  suffix: string,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPart {
  const leftWave = Math.sin(state.gaitPhaseRadians);
  const weight = state.locomotionWeight;
  const bounce = Math.abs(leftWave) * scale * 0.018 * weight;
  if (suffix.includes('boot-left') || suffix.includes('boot-right')) {
    const wave = suffix.includes('left') ? leftWave : -leftWave;
    const reach = wave * scale * 0.15 * weight;
    const lift = Math.max(0, wave) * scale * 0.12 * weight;
    return keepBottomAbove(movePart(
      part,
      state.directionX * reach,
      lift,
      state.directionZ * reach,
      wave > 0 ? -wave * 0.42 * weight : 0,
      Math.atan2(state.directionX, state.directionZ),
    ), part.centerY - part.height / 2);
  }
  if (suffix.includes('leg-left') || suffix.includes('leg-right')) {
    const wave = suffix.includes('left') ? leftWave : -leftWave;
    const reach = wave * scale * 0.07 * weight;
    return movePart(
      part,
      state.directionX * reach,
      Math.max(0, wave) * scale * 0.025 * weight,
      state.directionZ * reach,
      -wave * 0.5 * weight,
      Math.atan2(state.directionX, state.directionZ),
    );
  }
  if (suffix.includes('arm-left') || suffix.includes('arm-right')) {
    const legWave = suffix.includes('left') ? leftWave : -leftWave;
    return movePart(
      part, 0, bounce, 0, legWave * 0.38 * weight,
      Math.atan2(state.directionX, state.directionZ),
    );
  }
  if (/(tool|sword|bow|shield|polearm|halberd|javelin)/u.test(suffix)) {
    return movePart(
      part, 0, bounce, 0, -leftWave * 0.19 * weight,
      Math.atan2(state.directionX, state.directionZ),
    );
  }
  return movePart(part, 0, bounce, 0, 0);
}

function poseCavalryPart(
  part: VoxelPart,
  suffix: string,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPart {
  const baseWave = Math.sin(state.gaitPhaseRadians);
  const weight = state.locomotionWeight;
  if (suffix.includes('horse-leg')) {
    const opposite = suffix.includes('front-right') || suffix.includes('back-left');
    const wave = opposite ? -baseWave : baseWave;
    const reach = wave * scale * 0.18 * weight;
    const lift = Math.max(0, wave) * scale * 0.15 * weight;
    return keepBottomAbove(movePart(
      part,
      state.directionX * reach,
      lift,
      state.directionZ * reach,
      wave > 0 ? -wave * 0.56 * weight : 0,
      Math.atan2(state.directionX, state.directionZ),
    ), part.centerY - part.height / 2);
  }
  const bounce = Math.abs(baseWave) * scale * 0.028 * weight;
  return movePart(part, 0, bounce, 0, 0);
}

function poseSiegePart(
  part: VoxelPart,
  suffix: string,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPart {
  if (suffix.includes('wheel')) {
    return movePart(
      part, 0, 0, 0, state.gaitPhaseRadians,
      Math.atan2(state.directionX, state.directionZ),
    );
  }
  const rumble = Math.abs(Math.sin(state.gaitPhaseRadians))
    * scale * 0.012 * state.locomotionWeight;
  return movePart(part, 0, rumble, 0, 0);
}

function poseMonkPart(
  part: VoxelPart,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPart {
  const wave = Math.sin(state.gaitPhaseRadians);
  const sway = wave * scale * 0.035 * state.locomotionWeight;
  return movePart(
    part,
    state.directionX * sway,
    Math.abs(wave) * scale * 0.018 * state.locomotionWeight,
    state.directionZ * sway,
    0,
  );
}

export function posePart(
  part: VoxelPart,
  suffix: string,
  role: UnitRole,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPart {
  if (role === 'villager' || role === 'infantry' || role === 'archer') {
    return poseHumanoidPart(part, suffix, state, scale);
  }
  if (role === 'cavalry' || role === 'cavalry-archer') {
    return poseCavalryPart(part, suffix, state, scale);
  }
  if (role === 'siege') return poseSiegePart(part, suffix, state, scale);
  return poseMonkPart(part, state, scale);
}
