export const UNIT_ATTACK_FEED_TICKS = 10;

export interface ProjectedUnitAttackAnimationView {
  tick: number;
  cancelTick?: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
}

export interface ProjectedUnitAttackView
  extends ProjectedUnitAttackAnimationView {
  attackerId: number;
  attackerGeneration: number;
  witnessedBy: number[];
  suppressedFor?: number[];
}
