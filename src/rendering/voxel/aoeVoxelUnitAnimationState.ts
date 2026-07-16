// The unit animation state contract, split out of `aoeVoxelUnitAnimation` so
// the locomotion-pose module can consume it without importing the state
// machine (and so both files stay under the 500-LOC budget).

export interface AoeUnitAnimationState {
  readonly mode: 'idle' | 'moving' | 'attacking';
  /** Stable identity phase used only by ambient clock-driven motion. */
  readonly phaseRadians: number;
  /** Wrapped pose phase advanced only by displayed root distance. */
  readonly gaitPhaseRadians: number;
  readonly locomotionWeight: number;
  readonly speedWorldUnitsPerSecond: number;
  readonly directionX: number;
  readonly directionZ: number;
  readonly attackPhase: number;
  readonly attackWeight: number;
  readonly ambientSuppressionWeight: number;
  /** Wrapped 0..1 builder work-loop phase (spec §14.5 construction). */
  readonly workPhase: number;
  /** 0 when not building, stationary-gated so the swing never plays mid-walk. */
  readonly workWeight: number;
  /** Root-to-target-centre distance for the active strike; 0 when idle. */
  readonly targetDistance: number;
}
