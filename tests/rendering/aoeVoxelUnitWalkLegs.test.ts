// Gate: every unit that walks swings its legs at its OWN walking speed.
//
// Symptom (owner, 2026-09-05): "soldiers are not moving their legs during the
// walking animation." Root cause: `resolveUnitAnimationState` blended the
// locomotion weight toward `speed / 2.5` tiles per second — the retired
// uniform unit speed of the pre-§12.4.2 clock. v0.3.160 (2026-08-28) moved
// the clock to `round(0.32 × speedPercent)` hundredths of a quarter-tile
// fine step per tick: 0.8 tiles/s for a villager, 0.9 for a militia, 1.35
// for a knight. No unit in the game reaches 2.5, so every walker's weight
// settled at 0.2-0.6, and the gait — every amplitude of which multiplies by
// that weight — shrank to about one pixel of boot travel at the default
// zoom. Read out of the live game through `__AOE2_TEST__.inspectVoxelUnitMotion`
// on `unit-showcase-fixture`, five units ordered south, ticks 40-45: villager
// 0.19-0.30, militia 0.24-0.33, champion 0.31-0.39, archer 0.26-0.30, knight
// 0.40-0.51 (docs/debugging/2026-09-05-walk-legs.md).
//
// BOUND, stated so the green means only what it means:
// - Every UnitType in `UNIT_BASE_SPEED_PERCENT`, driven at exactly its base
//   rate with no movement technology, in straight-line per-tick steps along
//   +x for 40 ticks at 100 ms — the simulation's own clock, restated here
//   from the sim constants and NOT from the renderer helper the fix added, so
//   a wrong helper cannot agree with itself. The weight is read once the
//   two-anchor window has filled and the start response has converged.
// - The leg check covers the humanoid roles (villager, infantry, archer) and
//   the mounted roles (cavalry, cavalry-archer), posed by the real recipes
//   through `createUnitParts` at gait phases pi/2 and 3pi/2 — the two
//   extremes of a stride — reading the travel of the left boot, the left leg
//   and the front-left horse leg between them, in units of the recipe scale.
//   The thresholds are lower bounds (a boot must travel at least a quarter
//   of the recipe scale between stride extremes, a leg 0.11, a horse leg
//   0.3); the authored amplitudes at full weight are 0.32, 0.14 and 0.39, and
//   the pre-fix weights put every type below them (the fastest humanoid, a
//   Woad Raider at 172% = 1.38 tiles/s, reached weight 0.55, so 0.55 x 0.32 =
//   0.18; the red run reads 0.178).
// - It says nothing about a unit slowed by traffic (the gait is MEANT to fade
//   with speed), about movement technologies (faster only clamps at 1), about
//   siege wheels or a monk's sway (weight-gated too, but not legs), or about
//   what a pixel does at any zoom — the capture pair in the debugging doc is
//   that evidence, not this file.

import { describe, expect, it } from 'vitest';

import {
  UNIT_SUBGRID_RESOLUTION,
  UNIT_SUBGRID_STEP_PER_TICK,
} from '../../src/game/simulation/bridge/pureHelpers';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import { unitSize } from '../../src/game/simulation/prototypeUnitRules';
import {
  REFERENCE_MOVEMENT_RATE,
  UNIT_BASE_SPEED_PERCENT,
} from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { unitRole, type UnitRole } from '../../src/rendering/roles/unitRole';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import {
  resolveUnitAnimationState,
  type AoeUnitAnimationState,
} from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

const IDENTITY = '7:3';
const MS_PER_TICK = 1_000 / TPS;
const WALK_TICKS = 40;
const START_X = 10;
/** The locomotion weight a unit walking at its own base rate must reach. */
const FULL_GAIT_WEIGHT = 0.9;

const ALL_UNIT_TYPES = Object.keys(UNIT_BASE_SPEED_PERCENT) as UnitType[];

/** Part-key suffix and the least travel (in recipe-scale units) it must show
 *  between the two stride extremes. */
type LegCheck = readonly [suffix: string, minTravel: number];
const HUMANOID_LEGS: readonly LegCheck[] = [['-boot-left', 0.25], ['-leg-left', 0.11]];
const MOUNTED_LEGS: readonly LegCheck[] = [['horse-leg-front-left', 0.3]];
const LEG_CHECKS: Partial<Record<UnitRole, readonly LegCheck[]>> = {
  villager: HUMANOID_LEGS,
  infantry: HUMANOID_LEGS,
  archer: HUMANOID_LEGS,
  cavalry: MOUNTED_LEGS,
  'cavalry-archer': MOUNTED_LEGS,
};
const LEGGED_UNIT_TYPES = ALL_UNIT_TYPES.filter((unitType) => LEG_CHECKS[unitRole(unitType)]);

function unit(unitType: UnitType, x: number): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: unitType,
    owner: 1,
    x,
    y: 10,
    elevation: 0,
    tint: 0x3568c0,
    size: unitSize(unitType),
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
  };
}

/** Tiles a unit at its base rate covers per tick: the §12.4.2 rule, from the
 *  sim's own constants — `round(0.32 × percent)` hundredths of a fine step a
 *  tick, a fine step being a quarter tile. */
function baseTilesPerTick(unitType: UnitType): number {
  const hundredths = Math.round(UNIT_SUBGRID_STEP_PER_TICK * UNIT_BASE_SPEED_PERCENT[unitType]);
  return hundredths / 100 / UNIT_SUBGRID_RESOLUTION;
}

function walkAtBaseRate(unitType: UnitType): {
  readonly state: AoeUnitAnimationState;
  readonly entity: ProjectedEntityView;
} {
  const step = baseTilesPerTick(unitType);
  let entity = unit(unitType, START_X);
  let resolved = resolveUnitAnimationState(entity, IDENTITY, undefined, 0);
  for (let tick = 1; tick <= WALK_TICKS; tick += 1) {
    entity = unit(unitType, START_X + step * tick);
    resolved = resolveUnitAnimationState(entity, IDENTITY, resolved.history, tick * MS_PER_TICK);
  }
  return { state: resolved.state, entity };
}

function findPart(parts: readonly VoxelPart[], suffix: string, unitType: UnitType): VoxelPart {
  const match = parts.find((candidate) => candidate.key.endsWith(suffix));
  if (!match) throw new Error(`${unitType} has no part ending in ${suffix}`);
  return match;
}

function travelBetween(left: VoxelPart, right: VoxelPart): number {
  return Math.hypot(
    left.centerX - right.centerX,
    left.centerY - right.centerY,
    left.centerZ - right.centerZ,
  );
}

describe('voxel unit walk: legs swing at the unit\'s own walking speed', () => {
  it('drives the simulation\'s own clock: a villager at 100% walks 0.8 tiles a second', () => {
    // Instrument check. If this drifts, every verdict below is about some
    // other speed than the one the sim moves units at.
    expect(baseTilesPerTick('villager') * TPS).toBeCloseTo(REFERENCE_MOVEMENT_RATE, 10);
    expect(baseTilesPerTick('knight') * TPS).toBeCloseTo(1.35, 2);
  });

  it.each(ALL_UNIT_TYPES)(
    '%s reaches full locomotion weight walking at its base rate',
    (unitType) => {
      const { state } = walkAtBaseRate(unitType);
      expect(state.mode).toBe('moving');
      expect(
        state.locomotionWeight,
        `${unitType} at ${(baseTilesPerTick(unitType) * TPS).toFixed(2)} tiles/s `
        + `reached locomotion weight ${state.locomotionWeight.toFixed(3)}, `
        + `below ${FULL_GAIT_WEIGHT}: its gait plays at that fraction of the authored motion`,
      ).toBeGreaterThanOrEqual(FULL_GAIT_WEIGHT);
    },
  );

  it.each(LEGGED_UNIT_TYPES)(
    '%s moves its legs between stride extremes while walking at its base rate',
    (unitType) => {
      const { state, entity } = walkAtBaseRate(unitType);
      const scale = Math.max(0.48, entity.size);
      const poseAt = (gaitPhaseRadians: number): VoxelPart[] => createUnitParts(
        entity, IDENTITY, 0, { ...state, gaitPhaseRadians },
      );
      const forward = poseAt(Math.PI / 2);
      const back = poseAt(3 * Math.PI / 2);
      for (const [suffix, minTravel] of LEG_CHECKS[unitRole(unitType)] ?? []) {
        const travel = travelBetween(
          findPart(forward, suffix, unitType),
          findPart(back, suffix, unitType),
        ) / scale;
        expect(
          travel,
          `${unitType} ${suffix} travels ${travel.toFixed(3)} x scale between stride extremes `
          + `at locomotion weight ${state.locomotionWeight.toFixed(3)}; at least ${minTravel} is visible`,
        ).toBeGreaterThanOrEqual(minTravel);
      }
    },
  );
});
