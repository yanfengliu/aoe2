import type { ProjectedEntityView } from '../../game/simulation/types';
import type { VoxelPart } from './aoeVoxelRecipeTypes';
import { clamp01, smoothstep } from './voxelMath';

/** One raise→smash→reset cycle. Slow enough to read at default zoom. */
export const BUILDER_WORK_PERIOD_MS = 900;

/**
 * Loop phase from the injected display clock (so pause freezes it), offset by
 * the unit's stable identity phase so two builders on one site never swing in
 * lockstep.
 */
export function builderWorkPhase(sampleTimeMs: number, phaseRadians: number): number {
  const offset = phaseRadians / (Math.PI * 2);
  return (((sampleTimeMs / BUILDER_WORK_PERIOD_MS + offset) % 1) + 1) % 1;
}

/**
 * The swing needs both feet planted at the site, and it yields entirely to the
 * attack pose — which owns the same tool/arm parts — so the channels can never
 * fight over one part.
 */
export function builderWorkWeight(
  entity: ProjectedEntityView,
  moving: boolean,
  attackWeight: number,
): number {
  if (moving || attackWeight > 0) return 0;
  return entity.activeVerb !== undefined ? 1 : 0;
}

export interface BuilderWorkPoseState {
  /** Wrapped 0..1 loop phase advanced by the injected display clock. */
  readonly workPhase: number;
  /** 0 = not working, 1 = full swing. Blends the loop in and out. */
  readonly workWeight: number;
}

/**
 * Hammer arc over the loop, in radians about the tool pivot. Negative lifts
 * the head up and back over the shoulder; positive drives it down and
 * forward, matching the attack pose's sign convention. Phase 0 and 1 are the
 * same pose so the loop closes seamlessly.
 */
export function builderWorkArc(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.45) {
    // Raise: neutral -> loaded overhead.
    return -1.15 * smoothstep(p / 0.45);
  }
  if (p < 0.62) {
    // Smash: overhead -> driven at the ground.
    return -1.15 + 2.05 * smoothstep((p - 0.45) / 0.17);
  }
  // Settle back to neutral for the next cycle.
  return 0.9 * (1 - smoothstep((p - 0.62) / 0.38));
}

/**
 * Per-verb arc (v0.3.121): the axe swings the full builder arc, the pick is a
 * shorter faster strike, the picking hand a low gentle reach — three visibly
 * different working silhouettes at default zoom. 'building'/'chopping' (and
 * the legacy 'gathering' from older recordings) keep the classic arc.
 */
export function workArcForVerb(verb: string | undefined, phase: number): number {
  if (verb === 'mining') {
    // Two strikes per loop, shallower lift.
    return builderWorkArc((phase * 2) % 1) * 0.62;
  }
  if (verb === 'foraging') {
    // A slow low reach: gentle sine dip, no overhead load.
    return Math.sin(phase * Math.PI * 2) * 0.38;
  }
  return builderWorkArc(phase);
}

const WORK_PART_PATTERN = /(tool|arm-left|arm-right|apron)/u;

/**
 * The villager's hammer work loop (spec §14.5). Applied to the same tool/arm
 * parts the attack pose owns, about the same tool pivot, so the two channels
 * never fight: the caller runs this only when the unit is stationary, is
 * building, and has no attack pose active. Roots, boots, legs, and the
 * contact shadow never move.
 */
export function poseBuilderWorkParts(
  parts: readonly VoxelPart[],
  state: BuilderWorkPoseState,
  scale: number,
  verb?: string,
): VoxelPart[] {
  const weight = clamp01(state.workWeight);
  // Fail CLOSED: `>` is false for NaN and undefined, so a state built without
  // the work channel (older test fixtures, future callers) is a clean no-op
  // rather than a NaN-corrupted pose.
  if (!(weight > 0)) return [...parts];
  const arc = workArcForVerb(verb, state.workPhase) * weight;
  if (!Number.isFinite(arc) || Math.abs(arc) < 1e-9) return [...parts];
  const drive = Math.max(0, arc);
  const lift = Math.max(0, -arc);
  return parts.map((part) => {
    const suffix = part.key.slice(part.key.lastIndexOf(':') + 1);
    if (!WORK_PART_PATTERN.test(suffix)) return part;
    if (suffix.includes('apron')) {
      // A shallow torso lean into the swing; the apron reads the body.
      return { ...part, pitch: (part.pitch ?? 0) + drive * 0.1 };
    }
    return {
      ...part,
      centerX: part.centerX + (drive * 0.12 - lift * 0.05) * scale,
      centerY: part.centerY + (lift * 0.3 - drive * 0.52) * scale,
      pitch: (part.pitch ?? 0) + arc,
      pitchHeadingRadians: 0,
    };
  });
}
