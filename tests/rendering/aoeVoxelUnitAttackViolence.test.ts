// Quality bar for the attack-pose violence directive (spec §14.5,
// user 2026-07-14): the visible strike window (attackPhase 0.55 -> 1.0 —
// sampling honestly starts AT impact) must read as a whip-crack, not a tap.
// Encoded matrix-level so amplitude retunes stay honest: the impact sample
// starts COILED opposite the strike, the peak lands fast but not at the very
// first sample, peak displacement clears a role threshold, and the
// follow-through recovers fast with only a bounded recoil. The frozen
// contracts (impact phase 0.55, arc endpoints as no-ops, planted roots,
// rigidity) stay pinned by aoeVoxelUnitAttackAnimation.test.ts.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

function unit(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

function attackPoseState(attackPhase: number, attackWeight: number): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 0,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase,
    attackWeight,
    ambientSuppressionWeight: attackWeight,
  } as unknown as AoeUnitAnimationState;
}

function weaponPart(parts: readonly VoxelPart[], suffix: string): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(`:${suffix}`));
  if (!match) throw new Error(`Missing unit part ${suffix}`);
  return match;
}

interface WeaponProbe {
  readonly entityType: ProjectedEntityView['entityType'];
  readonly suffix: string;
  readonly peakThresholdWorldUnits: number;
  /** Swing/thrust rigs drive a weapon head through the target; draw rigs
   *  (bows) release without carrying the limb, so only they skip the
   *  directional matrix. Review iter-1 fixHint. */
  readonly rig: 'chop' | 'thrust' | 'draw';
}

// Thresholds sit ~40% above the MEASURED v0.2.3 peaks (villager tool-head
// 0.680, champion infantry-greatsword 0.476, knight cavalry-lance 0.389 world
// units — probed 2026-07-15), so the old amplitudes FAIL and a "gentle tap"
// cannot silently return.
// Every role whose amplitudes this directive retuned gets a bar — review
// iter-1 CONFIRMED that villager/champion/knight-only coverage let the archer
// and siege rigs regress to a tap while all gates stayed green.
const PROBES: readonly WeaponProbe[] = [
  { entityType: 'villager', suffix: 'villager-tool-head', peakThresholdWorldUnits: 0.95, rig: 'chop' },
  { entityType: 'champion', suffix: 'infantry-greatsword', peakThresholdWorldUnits: 0.66, rig: 'chop' },
  { entityType: 'knight', suffix: 'cavalry-lance', peakThresholdWorldUnits: 0.54, rig: 'thrust' },
  { entityType: 'mangonel', suffix: 'siege-throwing-arm', peakThresholdWorldUnits: 0.85, rig: 'thrust' },
  { entityType: 'battering-ram', suffix: 'siege-ram-head', peakThresholdWorldUnits: 0.2, rig: 'thrust' },
  { entityType: 'arbalest', suffix: 'archer-arm-right', peakThresholdWorldUnits: 0.2, rig: 'draw' },
  { entityType: 'cavalry-archer', suffix: 'cavalry-archer-bow-upper', peakThresholdWorldUnits: 0.15, rig: 'draw' },
];

function centerDisplacement(
  entityType: ProjectedEntityView['entityType'],
  suffix: string,
  phase: number,
): { x: number; y: number; z: number; magnitude: number } {
  const entity = unit({ entityType });
  const rest = weaponPart(createUnitParts(entity, '7:3', 0, attackPoseState(phase, 0)), suffix);
  const posed = weaponPart(createUnitParts(entity, '7:3', 0, attackPoseState(phase, 1)), suffix);
  const x = posed.centerX - rest.centerX;
  const y = posed.centerY - rest.centerY;
  const z = posed.centerZ - rest.centerZ;
  return { x, y, z, magnitude: Math.hypot(x, y, z) };
}

function maxCornerDisplacement(
  entityType: ProjectedEntityView['entityType'],
  suffix: string,
  phase: number,
): number {
  const entity = unit({ entityType });
  const rest = voxelPartWorldCorners(
    weaponPart(createUnitParts(entity, '7:3', 0, attackPoseState(phase, 0)), suffix),
  );
  const posed = voxelPartWorldCorners(
    weaponPart(createUnitParts(entity, '7:3', 0, attackPoseState(phase, 1)), suffix),
  );
  return Math.max(...rest.map((corner, index) => Math.hypot(
    corner.x - posed[index]!.x,
    corner.y - posed[index]!.y,
    corner.z - posed[index]!.z,
  )));
}

const VISIBLE_PHASES: number[] = [];
for (let phase = 0.55; phase <= 1.0001; phase += 0.005) VISIBLE_PHASES.push(Math.min(1, phase));

function peakPhaseOf(entityType: ProjectedEntityView['entityType'], suffix: string): {
  peakPhase: number;
  peak: number;
} {
  let peakPhase = 0.55;
  let peak = -Infinity;
  for (const phase of VISIBLE_PHASES) {
    const displacement = maxCornerDisplacement(entityType, suffix, phase);
    if (displacement > peak) {
      peak = displacement;
      peakPhase = phase;
    }
  }
  return { peakPhase, peak };
}

describe('attack pose violence bar (spec §14.5 directive)', () => {
  it('loads BEHIND the target at the impact sample and drives THROUGH it at the peak', () => {
    // The pose state faces +x, so the strike axis is x. This asserts the
    // ABSOLUTE sense of the swing, not just that coil and strike differ:
    // review iter-1 CONFIRMED (two independent probes) that the villager and
    // champion whipped their weapons AWAY from the captured target, ending
    // behind the actor's heels, while a `coil.x * strike.x < 0` product test
    // stayed green because it is satisfied by either orientation. Spec §14.5
    // requires "a fast impact snap toward the captured target".
    for (const probe of PROBES) {
      if (probe.rig === 'draw') continue;
      const { peakPhase } = peakPhaseOf(probe.entityType, probe.suffix);
      const coil = centerDisplacement(probe.entityType, probe.suffix, 0.55);
      const strike = centerDisplacement(probe.entityType, probe.suffix, peakPhase);
      expect(coil.magnitude, `${probe.suffix} must be visibly coiled at the impact sample`)
        .toBeGreaterThan(0.02);
      expect(coil.x, `${probe.suffix} must LOAD behind the target at the impact sample`)
        .toBeLessThan(0);
      expect(strike.x, `${probe.suffix} must DRIVE toward the target at the peak`)
        .toBeGreaterThan(0);
      if (probe.rig === 'chop') {
        // A chop is loaded high and driven low through the target.
        expect(coil.y - strike.y, `${probe.suffix} strike must drop through the swing`)
          .toBeGreaterThan(0.1);
      }
    }
  });

  it('lands the strike peak fast but not at the very first visible sample', () => {
    for (const probe of PROBES) {
      // A draw rig's extreme IS the loaded draw at the impact sample; it
      // releases rather than carrying the limb through, so snap timing is
      // meaningless for it (its bar is peak magnitude + recovery).
      if (probe.rig === 'draw') continue;
      const { peakPhase } = peakPhaseOf(probe.entityType, probe.suffix);
      // <= 120ms of the 650ms window past the 0.55 sample start...
      expect(peakPhase, `${probe.suffix} peak too late`).toBeLessThanOrEqual(0.55 + 0.45 * (120 / 650));
      // ...but after a readable coil->snap, never instantaneous at 0.55.
      expect(peakPhase, `${probe.suffix} peak must follow a visible snap`).toBeGreaterThan(0.56);
    }
  });

  it('clears the per-role peak displacement threshold', () => {
    for (const probe of PROBES) {
      const { peak } = peakPhaseOf(probe.entityType, probe.suffix);
      expect(peak, `${probe.suffix} strike reads too soft`)
        .toBeGreaterThanOrEqual(probe.peakThresholdWorldUnits);
    }
  });

  it('recovers fast: bounded recoil, near-rest by the window end', () => {
    for (const probe of PROBES) {
      const { peakPhase, peak } = peakPhaseOf(probe.entityType, probe.suffix);
      const lateBound = peak * 0.45;
      for (const phase of VISIBLE_PHASES) {
        if (phase < Math.min(1, peakPhase + 0.15)) continue;
        const displacement = maxCornerDisplacement(probe.entityType, probe.suffix, phase);
        expect(displacement, `${probe.suffix} lingers at phase ${String(phase)}`)
          .toBeLessThanOrEqual(lateBound);
      }
      expect(maxCornerDisplacement(probe.entityType, probe.suffix, 1))
        .toBeLessThanOrEqual(0.02);
    }
  });
});
