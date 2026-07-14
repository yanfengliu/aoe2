import type { ProjectedEntityView } from '../../game/simulation/types';
import { TPS } from '../../game/simulation/prototypeScenario';
import { UNIT_ATTACK_ANIMATION_DURATION_MS } from './aoeVoxelUnitAttackAnimation';

const ATTACK_IMPACT_PHASE = 0.55;
const DIRECTION_EPSILON = 1e-5;

export interface UnitAttackSample {
  readonly phase: number;
  readonly directionX: number;
  readonly directionZ: number;
}

export function sampleUnitAttack(
  entity: ProjectedEntityView,
  sampleTimeMs: number,
): UnitAttackSample | null {
  const attack = entity.attackAnimation;
  if (!attack) return null;
  const elapsedMs = sampleTimeMs - attack.tick * 1_000 / TPS;
  if (elapsedMs < 0 || elapsedMs > UNIT_ATTACK_ANIMATION_DURATION_MS) return null;
  const deltaX = attack.targetX - entity.x;
  const deltaZ = attack.targetY - entity.y;
  const distance = Math.hypot(deltaX, deltaZ);
  if (!Number.isFinite(distance) || distance <= DIRECTION_EPSILON) return null;
  const recovery = Math.max(0, Math.min(1, elapsedMs / UNIT_ATTACK_ANIMATION_DURATION_MS));
  return {
    // Combat resolves before projection, so there is no honest pre-hit wind-up
    // to show. Start at the authored impact keyframe and recover from there.
    phase: ATTACK_IMPACT_PHASE + (1 - ATTACK_IMPACT_PHASE) * recovery,
    directionX: deltaX / distance,
    directionZ: deltaZ / distance,
  };
}
