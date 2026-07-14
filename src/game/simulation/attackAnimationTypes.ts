export interface ProjectedUnitAttackAnimationView {
  tick: number;
  targetX: number;
  targetY: number;
}

export interface ProjectedUnitAttackView
  extends ProjectedUnitAttackAnimationView {
  attackerId: number;
  attackerGeneration: number;
  witnessedBy: number[];
}
