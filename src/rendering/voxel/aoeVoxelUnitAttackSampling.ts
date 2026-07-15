import type { ProjectedEntityView } from '../../game/simulation/types';
import { UNIT_ATTACK_FEED_TICKS } from '../../game/simulation/attackAnimationTypes';
import { TPS } from '../../game/simulation/prototypeScenario';
import { UNIT_ATTACK_ANIMATION_DURATION_MS } from './aoeVoxelUnitAttackAnimation';

const ATTACK_IMPACT_PHASE = 0.55;
const DIRECTION_EPSILON = 1e-5;
const UNIT_ATTACK_FEED_DURATION_MS = UNIT_ATTACK_FEED_TICKS * 1_000 / TPS;

export interface UnitAttackSample {
  readonly phase: number;
  readonly poseWeight: number;
  readonly ambientSuppressionWeight: number;
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

export function sampleUnitAttack(
  entity: ProjectedEntityView,
  sampleTimeMs: number,
  fallbackDirectionX = 1,
  fallbackDirectionZ = 0,
): UnitAttackSample | null {
  const attack = entity.attackAnimation;
  if (!attack) return null;
  const elapsedMs = sampleTimeMs - attack.tick * 1_000 / TPS;
  if (elapsedMs < 0 || elapsedMs > UNIT_ATTACK_FEED_DURATION_MS) return null;
  const deltaX = attack.targetX - attack.sourceX;
  const deltaZ = attack.targetY - attack.sourceY;
  const distance = Math.hypot(deltaX, deltaZ);
  if (!Number.isFinite(distance)) return null;
  const fallbackDistance = Math.hypot(fallbackDirectionX, fallbackDirectionZ);
  const useFallback = distance <= DIRECTION_EPSILON;
  const hasUsableFallback = Number.isFinite(fallbackDistance)
    && fallbackDistance > DIRECTION_EPSILON;
  const safeFallbackX = hasUsableFallback ? fallbackDirectionX / fallbackDistance : 1;
  const safeFallbackZ = hasUsableFallback ? fallbackDirectionZ / fallbackDistance : 0;
  const recovery = clamp01(elapsedMs / UNIT_ATTACK_ANIMATION_DURATION_MS);
  const displayTick = sampleTimeMs * TPS / 1_000;
  const cancellationWeight = attack.cancelTick === undefined
    ? 1
    : 1 - smoothstep(displayTick - attack.cancelTick);
  const ambientRecovery = elapsedMs <= UNIT_ATTACK_ANIMATION_DURATION_MS
    ? 0
    : smoothstep(
      (elapsedMs - UNIT_ATTACK_ANIMATION_DURATION_MS)
      / (UNIT_ATTACK_FEED_DURATION_MS - UNIT_ATTACK_ANIMATION_DURATION_MS),
    );
  return {
    // Combat resolves before projection, so there is no honest pre-hit wind-up
    // to show. Start at the authored impact keyframe and recover from there.
    phase: ATTACK_IMPACT_PHASE + (1 - ATTACK_IMPACT_PHASE) * recovery,
    poseWeight: elapsedMs <= UNIT_ATTACK_ANIMATION_DURATION_MS
      ? cancellationWeight : 0,
    ambientSuppressionWeight: (1 - ambientRecovery) * cancellationWeight,
    directionX: useFallback ? safeFallbackX : deltaX / distance,
    directionZ: useFallback ? safeFallbackZ : deltaZ / distance,
  };
}
