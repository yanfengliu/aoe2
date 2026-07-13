import type { ProjectedEntityView, UnitType } from '../../game/simulation/types';
import { unitRole, type UnitRole } from '../../phaser/scenes/gameScene/unitRole';
import type {
  VoxelPart,
  VoxelPartAnimation,
} from './aoeVoxelRecipeTypes';

export interface AoeUnitAnimationState {
  readonly mode: 'idle' | 'moving';
  readonly phaseRadians: number;
}

const ZERO = Object.freeze({ x: 0, y: 0, z: 0 });

export function phaseForUnitIdentity(identity: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000 * Math.PI * 2;
}

export function resolveUnitAnimationState(
  entity: ProjectedEntityView,
  identity: string,
  previous: { readonly x: number; readonly y: number } | undefined,
): AoeUnitAnimationState {
  const displacement = previous
    ? Math.hypot(entity.x - previous.x, entity.y - previous.y)
    : 0;
  return {
    mode: displacement > 0.001 ? 'moving' : 'idle',
    phaseRadians: phaseForUnitIdentity(identity),
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

function baseMotion(
  role: UnitRole,
  state: AoeUnitAnimationState,
  scale: number,
): VoxelPartAnimation {
  const movingPeriods: Record<UnitRole, number> = {
    villager: 520,
    infantry: 500,
    archer: 540,
    cavalry: 460,
    'cavalry-archer': 480,
    siege: 900,
    monk: 1_000,
  };
  return motion(
    state.mode === 'moving' ? movingPeriods[role] : 1_400,
    state.phaseRadians,
    {
      x: scale * (state.mode === 'moving' ? 0.012 : 0.008),
      y: scale * (state.mode === 'moving' ? 0.075 : 0.045),
      z: 0,
    },
    ZERO,
    state.mode === 'idle' ? { x: 0.01, y: 0.02, z: 0.01 } : ZERO,
  );
}

function humanoidMotion(
  suffix: string,
  state: AoeUnitAnimationState,
  base: VoxelPartAnimation,
): VoxelPartAnimation {
  const stride = state.mode === 'moving' ? 0.42 : 0.11;
  const armStride = state.mode === 'moving' ? 0.34 : 0.13;
  if (suffix.includes('leg-left') || suffix.includes('boot-left')) {
    return motion(base.periodMs, base.phaseRadians, base.translationAmplitude, { x: stride, y: 0, z: 0 });
  }
  if (suffix.includes('leg-right') || suffix.includes('boot-right')) {
    return motion(base.periodMs, base.phaseRadians + Math.PI, base.translationAmplitude, { x: stride, y: 0, z: 0 });
  }
  if (suffix.includes('arm-left')) {
    return motion(base.periodMs, base.phaseRadians + Math.PI, base.translationAmplitude, { x: armStride, y: 0, z: 0 });
  }
  if (suffix.includes('arm-right')) {
    return motion(base.periodMs, base.phaseRadians, base.translationAmplitude, { x: armStride, y: 0, z: 0 });
  }
  if (/(tool|sword|bow|shield)/u.test(suffix)) {
    return motion(base.periodMs, base.phaseRadians, base.translationAmplitude, { x: 0, y: 0, z: armStride * 0.5 });
  }
  return base;
}

function cavalryMotion(
  suffix: string,
  state: AoeUnitAnimationState,
  base: VoxelPartAnimation,
): VoxelPartAnimation {
  const stride = state.mode === 'moving' ? 0.52 : 0.14;
  if (suffix.includes('horse-leg')) {
    const opposite = suffix.includes('front-right') || suffix.includes('back-left');
    return motion(base.periodMs, base.phaseRadians + (opposite ? Math.PI : 0), ZERO, { x: stride, y: 0, z: 0 });
  }
  if (suffix.includes('horse-tail')) {
    return motion(780, base.phaseRadians + 0.7, ZERO, { x: 0, y: 0, z: 0.24 });
  }
  if (suffix.includes('rider') || suffix.includes('horse-body') || suffix.includes('saddle')) {
    return base;
  }
  return motion(base.periodMs, base.phaseRadians, ZERO, { x: stride * 0.18, y: 0, z: 0 });
}

function siegeMotion(
  suffix: string,
  state: AoeUnitAnimationState,
  base: VoxelPartAnimation,
): VoxelPartAnimation {
  const strength = state.mode === 'moving' ? 1 : 0.32;
  if (suffix.includes('wheel')) {
    return motion(700, base.phaseRadians, ZERO, { x: 0.55 * strength, y: 0, z: 0 });
  }
  if (suffix.includes('throwing-arm') || suffix.includes('bucket')) {
    return motion(1_200, base.phaseRadians + 0.4, ZERO, { x: 0, y: 0, z: 0.3 * strength });
  }
  if (suffix.includes('ram-beam') || suffix.includes('ram-head')) {
    return motion(850, base.phaseRadians, { x: 0.1 * strength, y: 0, z: -0.04 * strength });
  }
  return base;
}

function monkMotion(
  suffix: string,
  base: VoxelPartAnimation,
): VoxelPartAnimation {
  if (suffix.includes('sleeve-left')) {
    return motion(1_100, base.phaseRadians, base.translationAmplitude, { x: 0, y: 0, z: 0.2 });
  }
  if (suffix.includes('sleeve-right')) {
    return motion(1_100, base.phaseRadians + Math.PI, base.translationAmplitude, { x: 0, y: 0, z: 0.2 });
  }
  if (suffix.includes('staff')) {
    return motion(1_500, base.phaseRadians + 0.5, ZERO, { x: 0, y: 0, z: 0.08 });
  }
  return base;
}

export function animateUnitParts(
  parts: readonly VoxelPart[],
  entity: ProjectedEntityView,
  state: AoeUnitAnimationState,
): VoxelPart[] {
  if (entity.isMemory) return parts.map((part) => ({ ...part, animation: undefined }));
  const role = unitRole(entity.entityType as UnitType);
  const shared = baseMotion(role, state, Math.max(0.48, entity.size));
  return parts.map((part) => {
    if (part.surface === 'shadow') return part;
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    let animation = shared;
    if (role === 'villager' || role === 'infantry' || role === 'archer') {
      animation = humanoidMotion(suffix, state, shared);
    } else if (role === 'cavalry' || role === 'cavalry-archer') {
      animation = cavalryMotion(suffix, state, shared);
    } else if (role === 'siege') {
      animation = siegeMotion(suffix, state, shared);
    } else if (role === 'monk') {
      animation = monkMotion(suffix, shared);
    }
    return { ...part, animation };
  });
}
