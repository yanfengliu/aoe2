// Melee weapons must actually CONNECT (spec §14.5, user 2026-07-15).
//
// Measured on the real boar hunt before this fix: at the strike peak a
// villager's axe tip reached 0.541 world units from its root while the boar's
// near edge sat at 0.907 — it swung a third of a tile short, through empty
// air. The strike used a FIXED forward displacement that ignored how far the
// captured target actually was.
//
// The pose may not move the root (spec: no authoritative root lunge), so the
// reach is a bounded lean of the weapon assembly: it closes the gap when the
// target is within an arm's length, and simply stops at its cap otherwise.

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { unitRole } from '../../src/rendering/roles/unitRole';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

const PEAK_PHASE = 0.585;

function unit(
  entityType: ProjectedEntityView['entityType'],
  targetDistance: number,
): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType,
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
    attackAnimation: {
      tick: 0,
      sourceX: 0,
      sourceY: 0,
      targetX: targetDistance,
      targetY: 0,
    },
  } as ProjectedEntityView;
}

function state(targetDistance: number): AoeUnitAnimationState {
  return {
    mode: 'attacking',
    phaseRadians: 0,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: PEAK_PHASE,
    attackWeight: 1,
    ambientSuppressionWeight: 1,
    workPhase: 0,
    workWeight: 0,
    targetDistance,
  } as unknown as AoeUnitAnimationState;
}

/** Farthest tip extent along the strike axis (+x), measured from the root. */
function tipReach(
  entityType: ProjectedEntityView['entityType'],
  suffix: string,
  targetDistance: number,
): number {
  const parts: VoxelPart[] = createUnitParts(
    unit(entityType, targetDistance),
    '7:3',
    0,
    state(targetDistance),
  );
  const tip = parts.find((p) => p.key.endsWith(`:${suffix}`))!;
  const rootX = 0.5;
  return Math.max(...voxelPartWorldCorners(tip).map((c) => c.x - rootX));
}

interface MeleeProbe {
  readonly entityType: ProjectedEntityView['entityType'];
  readonly suffix: string;
}

// The melee rigs whose tip is meant to make contact. Draw rigs (bows) and
// siege are excluded on purpose: an archer's arrow is not modelled, so
// stretching the bow toward a distant target would be nonsense.
const MELEE: readonly MeleeProbe[] = [
  { entityType: 'villager', suffix: 'villager-tool-head' },
  { entityType: 'champion', suffix: 'infantry-sword' },
  { entityType: 'knight', suffix: 'cavalry-lance' },
];

describe('melee weapons connect with the target (spec §14.5)', () => {
  it('reaches measurably further toward an adjacent target than the fixed arc did', () => {
    // 1.118 is the real root-to-root distance measured in the boar hunt, where
    // the villager's tip reached 0.541 and the boar's near edge sat at 0.907.
    // The strike now closes as much of that as the body allows — it cannot
    // close ALL of it, because at melee range the two bodies are ~0.78 wu
    // apart and no arm spans that (see the reach-limit test below).
    for (const probe of MELEE) {
      const reach = tipReach(probe.entityType, probe.suffix, 1.118);
      expect(reach, `${probe.suffix} did not extend toward the target at all`)
        .toBeGreaterThan(tipReach(probe.entityType, probe.suffix, 0));
    }
  });

  it('keeps the body coherent while leaning — the torso never leaves the hips', () => {
    // The lean translates the upper body while the legs stay planted, so an
    // unbounded reach would float the torso off the hips. This is what caps
    // MAX_REACH_LEAN; raising it to "just make the tip connect" breaks here.
    const entity = unit('villager', 1.4);
    const parts: VoxelPart[] = createUnitParts(entity, '7:3', 0, state(1.4));
    const find = (suffix: string) => parts.find((p) => p.key.endsWith(`:${suffix}`))!;
    const tunic = find('villager-tunic');
    const leg = find('villager-leg-right');
    const tunicLeft = tunic.centerX - tunic.width / 2;
    const legRight = leg.centerX + leg.width / 2;
    expect(tunicLeft, 'the torso floated forward off the legs')
      .toBeLessThanOrEqual(legRight);
  });

  it('extends further for a farther target, within an arm-length cap', () => {
    for (const probe of MELEE) {
      const near = tipReach(probe.entityType, probe.suffix, 0.9);
      const far = tipReach(probe.entityType, probe.suffix, 1.4);
      expect(far, `${probe.suffix} ignores target distance`).toBeGreaterThan(near);
      // Bounded: the actor leans, it does not telescope at an unreachable target.
      const absurd = tipReach(probe.entityType, probe.suffix, 6);
      expect(absurd, `${probe.suffix} stretches absurdly at a distant target`)
        .toBeLessThan(2.2);
    }
  });

  it('never overshoots so far that the weapon passes through the target', () => {
    for (const probe of MELEE) {
      const reach = tipReach(probe.entityType, probe.suffix, 1.118);
      expect(reach, `${probe.suffix} punches clean through the target`)
        .toBeLessThan(1.118 + 0.35);
    }
  });

  it('is a clean no-op for a state built without the reach channel', () => {
    // The guard must fail CLOSED. `targetDistance <= 0` reads false for
    // undefined, so an older fixture would have posed with NaN and silently
    // corrupted the strike — the same trap the builder work loop hit.
    const legacy = {
      mode: 'attacking',
      phaseRadians: 0,
      gaitPhaseRadians: 0,
      locomotionWeight: 0,
      speedWorldUnitsPerSecond: 0,
      directionX: 1,
      directionZ: 0,
      attackPhase: PEAK_PHASE,
      attackWeight: 1,
      ambientSuppressionWeight: 1,
      workPhase: 0,
      workWeight: 0,
    } as unknown as AoeUnitAnimationState;
    const parts = createUnitParts(unit('villager', 0), '7:3', 0, legacy);
    for (const part of parts) {
      expect(Number.isFinite(part.centerX), `${part.key} centerX went non-finite`).toBe(true);
      expect(Number.isFinite(part.centerZ), `${part.key} centerZ went non-finite`).toBe(true);
    }
  });

  it('leaves every role a melee rig', () => {
    for (const probe of MELEE) {
      expect(['villager', 'infantry', 'cavalry'])
        .toContain(unitRole(probe.entityType as UnitType));
    }
  });
});
