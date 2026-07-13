import type { ProjectedEntityView, UnitType } from '../../game/simulation/types';
import { unitRole, type UnitRole } from '../roles/unitRole';
import type {
  VoxelPart,
  VoxelPartAnimation,
} from './aoeVoxelRecipeTypes';
import { matrixForPart } from './aoeVoxelRecipeTypes';

export interface AoeUnitAnimationState {
  readonly mode: 'idle' | 'moving';
  /** Stable identity phase used only by ambient clock-driven motion. */
  readonly phaseRadians: number;
  /** Wrapped pose phase advanced only by displayed root distance. */
  readonly gaitPhaseRadians: number;
  readonly locomotionWeight: number;
  readonly speedWorldUnitsPerSecond: number;
  readonly directionX: number;
  readonly directionZ: number;
}

export interface AoeUnitMotionHistory extends AoeUnitAnimationState {
  readonly x: number;
  readonly y: number;
  readonly sampleTimeMs: number;
}

export interface ResolvedUnitAnimationState {
  readonly state: AoeUnitAnimationState;
  readonly history: AoeUnitMotionHistory;
}

const TAU = Math.PI * 2;
const MOVEMENT_EPSILON = 0.000_001;
const MAX_SPEED_WORLD_UNITS_PER_SECOND = 20;
const MAX_SMOOTHING_DELTA_MS = 250;
const FULL_LOCOMOTION_SPEED = 2.5;
const START_RESPONSE_MS = 90;
const STOP_RESPONSE_MS = 180;
const TURN_RESPONSE_MS = 110;
const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

const STRIDE_LENGTH_WORLD_UNITS: Readonly<Record<UnitRole, number>> = Object.freeze({
  villager: 2.2,
  infantry: 2.35,
  archer: 2.4,
  cavalry: 3.2,
  'cavalry-archer': 3.4,
  siege: 0.95,
  monk: 2.5,
});

const AUTHORED_FORWARD_RADIANS: Readonly<Record<UnitRole, number>> = Object.freeze({
  villager: Math.PI / 2,
  infantry: Math.PI / 2,
  archer: Math.PI / 2,
  cavalry: Math.atan2(-0.36, 0.5),
  'cavalry-archer': Math.atan2(-0.36, 0.5),
  siege: Math.atan2(-0.43, 0.88),
  monk: Math.PI / 2,
});

const FALLBACK_STRIDE_LENGTH_WORLD_UNITS = STRIDE_LENGTH_WORLD_UNITS.infantry;

function animationRole(entity: ProjectedEntityView): UnitRole | undefined {
  return unitRole(entity.entityType as UnitType) as UnitRole | undefined;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function wrapRadians(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

export function phaseForUnitIdentity(identity: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000 * TAU;
}

function initialUnitMotion(
  entity: ProjectedEntityView,
  identity: string,
  sampleTimeMs: number,
): ResolvedUnitAnimationState {
  const phaseRadians = phaseForUnitIdentity(identity);
  const role = animationRole(entity);
  const authoredForward = role === undefined ? 0 : AUTHORED_FORWARD_RADIANS[role];
  const state: AoeUnitAnimationState = {
    mode: 'idle',
    phaseRadians,
    gaitPhaseRadians: phaseRadians,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: Math.cos(authoredForward),
    directionZ: Math.sin(authoredForward),
  };
  return {
    state,
    history: { ...state, x: entity.x, y: entity.y, sampleTimeMs },
  };
}

function smoothDirection(
  previous: AoeUnitMotionHistory,
  targetX: number,
  targetZ: number,
  smoothingDeltaMs: number,
): readonly [number, number] {
  const blend = smoothingDeltaMs > 0
    ? 1 - Math.exp(-smoothingDeltaMs / TURN_RESPONSE_MS)
    : 0;
  const previousAngle = Math.atan2(previous.directionZ, previous.directionX);
  const targetAngle = Math.atan2(targetZ, targetX);
  const turn = Math.atan2(
    Math.sin(targetAngle - previousAngle),
    Math.cos(targetAngle - previousAngle),
  );
  const angle = previousAngle + turn * blend;
  return [Math.cos(angle), Math.sin(angle)];
}

export function resolveUnitAnimationState(
  entity: ProjectedEntityView,
  identity: string,
  previous: AoeUnitMotionHistory | undefined,
  sampleTimeMs: number,
): ResolvedUnitAnimationState {
  if (!Number.isFinite(sampleTimeMs) || sampleTimeMs < 0) {
    throw new RangeError('Unit animation sample time must be a non-negative finite number.');
  }
  if (!previous || sampleTimeMs < previous.sampleTimeMs) {
    return initialUnitMotion(entity, identity, sampleTimeMs);
  }

  const deltaX = entity.x - previous.x;
  const deltaZ = entity.y - previous.y;
  const distance = Math.hypot(deltaX, deltaZ);
  const moving = distance > MOVEMENT_EPSILON;
  const elapsedMs = Math.max(0, sampleTimeMs - previous.sampleTimeMs);
  if (elapsedMs === 0) {
    if (!moving) {
      return {
        state: {
          mode: previous.mode,
          phaseRadians: previous.phaseRadians,
          gaitPhaseRadians: previous.gaitPhaseRadians,
          locomotionWeight: previous.locomotionWeight,
          speedWorldUnitsPerSecond: previous.speedWorldUnitsPerSecond,
          directionX: previous.directionX,
          directionZ: previous.directionZ,
        },
        history: { ...previous, x: entity.x, y: entity.y },
      };
    }
    return initialUnitMotion(entity, identity, sampleTimeMs);
  }
  const smoothingDeltaMs = Math.min(
    MAX_SMOOTHING_DELTA_MS,
    elapsedMs,
  );
  const speed = elapsedMs > 0
    ? Math.min(MAX_SPEED_WORLD_UNITS_PER_SECOND, distance * 1_000 / elapsedMs)
    : 0;
  const targetWeight = clamp01(speed / FULL_LOCOMOTION_SPEED);
  const responseMs = targetWeight > previous.locomotionWeight
    ? START_RESPONSE_MS
    : STOP_RESPONSE_MS;
  const blend = smoothingDeltaMs > 0
    ? 1 - Math.exp(-smoothingDeltaMs / responseMs)
    : 0;
  const blendedWeight = previous.locomotionWeight
    + (targetWeight - previous.locomotionWeight) * blend;
  const locomotionWeight = targetWeight === 0 && blendedWeight < 0.001
    ? 0
    : clamp01(blendedWeight);
  const role = animationRole(entity);
  const strideLength = role === undefined
    ? FALLBACK_STRIDE_LENGTH_WORLD_UNITS
    : STRIDE_LENGTH_WORLD_UNITS[role];
  const gaitPhaseRadians = wrapRadians(
    previous.gaitPhaseRadians + distance / strideLength * TAU,
  );
  const [directionX, directionZ] = moving
    ? smoothDirection(
      previous,
      deltaX / distance,
      deltaZ / distance,
      smoothingDeltaMs,
    )
    : [previous.directionX, previous.directionZ];
  const state: AoeUnitAnimationState = {
    mode: moving ? 'moving' : 'idle',
    phaseRadians: previous.phaseRadians,
    gaitPhaseRadians,
    locomotionWeight,
    speedWorldUnitsPerSecond: speed,
    directionX,
    directionZ,
  };
  return {
    state,
    history: { ...state, x: entity.x, y: entity.y, sampleTimeMs },
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

function ambientBodyMotion(state: AoeUnitAnimationState, scale: number): VoxelPartAnimation {
  return motion(
    1_400,
    state.phaseRadians,
    { x: scale * 0.005, y: scale * 0.026, z: 0 },
    ZERO,
    { x: 0.006, y: 0.012, z: 0.006 },
  );
}

function movePart(
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
  if (/(tool|sword|bow|shield)/u.test(suffix)) {
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

function posePart(
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

function ambientAnimation(
  suffix: string,
  role: UnitRole,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPartAnimation | undefined {
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

function orientUnitParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  role: UnitRole,
  state: AoeUnitAnimationState,
): readonly VoxelPart[] {
  const targetHeading = Math.atan2(state.directionZ, state.directionX);
  const authoredForward = AUTHORED_FORWARD_RADIANS[role] ?? 0;
  const heading = Math.atan2(
    Math.sin(targetHeading - authoredForward),
    Math.cos(targetHeading - authoredForward),
  );
  if (Math.abs(heading) <= MOVEMENT_EPSILON) return parts;
  const cosine = Math.cos(heading);
  const sine = Math.sin(heading);
  const rootX = entity.x + 0.5;
  const rootZ = entity.y + 0.5;
  return parts.map((part) => {
    const offsetX = part.centerX - rootX;
    const offsetZ = part.centerZ - rootZ;
    return {
      ...part,
      centerX: rootX + offsetX * cosine - offsetZ * sine,
      centerZ: rootZ + offsetX * sine + offsetZ * cosine,
      yaw: (part.yaw ?? 0) - heading,
    };
  });
}

function normalizeAnimationDirection(state: AoeUnitAnimationState): AoeUnitAnimationState {
  const length = Math.hypot(state.directionX, state.directionZ);
  if (!Number.isFinite(length) || length <= MOVEMENT_EPSILON) {
    throw new RangeError('Unit animation direction must be finite and non-zero.');
  }
  if (Math.abs(length - 1) <= MOVEMENT_EPSILON) return state;
  return {
    ...state,
    directionX: state.directionX / length,
    directionZ: state.directionZ / length,
  };
}

export function animateUnitParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  state: AoeUnitAnimationState,
): VoxelPart[] {
  if (entity.isMemory) return parts.map((part) => ({ ...part, animation: undefined }));
  const role = unitRole(entity.entityType as UnitType);
  const scale = Math.max(0.48, entity.size);
  const normalizedState = normalizeAnimationDirection(state);
  return orientUnitParts(parts, entity, role, normalizedState).map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    const posed = posePart(part, suffix, role, normalizedState, scale);
    return {
      ...posed,
      animation: ambientAnimation(suffix, role, normalizedState, scale),
    };
  });
}
