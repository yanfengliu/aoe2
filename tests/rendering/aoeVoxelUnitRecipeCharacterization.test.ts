import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { ALL_UNIT_TYPES } from '../../src/input/unitTypeMap';
import type { AoeUnitAnimationState } from '../../src/rendering/voxel/aoeVoxelUnitAnimation';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

const UNIT_TYPES = Object.keys(ALL_UNIT_TYPES) as UnitType[];

function unit(entityType: UnitType, isMemory = false): ProjectedEntityView {
  return {
    id: 37,
    generation: 4,
    kind: 'unit',
    layer: 'unit',
    entityType,
    owner: 1,
    x: 3.125,
    y: 5.375,
    elevation: 0.6,
    tint: 0x3568c0,
    size: 0.72,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory,
  };
}

function state(overrides: Partial<AoeUnitAnimationState> = {}): AoeUnitAnimationState {
  return {
    mode: 'idle',
    phaseRadians: 1.234,
    gaitPhaseRadians: 0,
    locomotionWeight: 0,
    speedWorldUnitsPerSecond: 0,
    directionX: 1,
    directionZ: 0,
    attackPhase: 0,
    attackWeight: 0,
    ambientSuppressionWeight: 0,
    workPhase: 0,
    workWeight: 0,
    targetDistance: 0,
    ...overrides,
  };
}

function digestParts(animationState: AoeUnitAnimationState, isMemory = false): string {
  const payload = UNIT_TYPES.map((entityType, index) => createUnitParts(
    unit(entityType, isMemory),
    `37:${index}`,
    0.6,
    animationState,
  ));
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

describe('AoE voxel unit recipe characterization', () => {
  it('pins every unit type across the recipe and attack-animation state space', () => {
    expect({
      idle: digestParts(state()),
      locomotion: digestParts(state({
        mode: 'moving',
        gaitPhaseRadians: 0.83,
        locomotionWeight: 0.74,
        speedWorldUnitsPerSecond: 2.6,
        directionX: 0.6,
        directionZ: 0.8,
      })),
      builderWork: digestParts(state({
        workPhase: 0.63,
        workWeight: 0.81,
      })),
      attackCoil: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.42,
        attackWeight: 0.9,
        ambientSuppressionWeight: 0.9,
        targetDistance: 1.4,
      })),
      attackImpact: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.55,
        attackWeight: 1,
        ambientSuppressionWeight: 1,
        targetDistance: 1.4,
      })),
      attackSnap: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.586,
        attackWeight: 1,
        ambientSuppressionWeight: 1,
        targetDistance: 1.4,
      })),
      attackRecovery: digestParts(state({
        mode: 'attacking',
        directionX: Math.SQRT1_2,
        directionZ: Math.SQRT1_2,
        attackPhase: 0.83,
        attackWeight: 0.67,
        ambientSuppressionWeight: 0.67,
        targetDistance: 1.4,
      })),
      memory: digestParts(state(), true),
      // Re-recorded 2026-08-24 (twice) for the Trade Cart (v0.3.68): first the
      // added unit, then its cargo branch replacing the trebuchet fallback its
      // 'tool' weapon fell into — a cart with a throwing arm, caught by the
      // close-zoom capture, not by any test. The rendering
      // diff was three additive 'trade-cart' table rows and nothing else
      // (git diff: 6 insertions, 0 deletions), so every other unit's recipe
      // input is textually unchanged. Previously re-recorded 2026-08-23 for
      // the three line tiers (Capped Ram, Siege Onager, Elite Skirmisher). A whole-population hash cannot say WHICH
      // unit moved it, so before touching these the per-unit digest check was
      // run with an identity keyed by TYPE rather than by list position: all 83
      // pre-existing units were byte-identical and only the three new entries
      // appeared. Keying by position — which this payload does — makes an
      // insertion shift every later unit's identity, which is why 56 units
      // first looked changed and none of them were.
    }).toEqual({
      idle: 'bd88d6acb636e4912d1dfac57b1a693c5313b38d7b0abf68bf44f070cf643ef6',
      locomotion: '8a03829d3e0ef3e2e60640219f380b7e07c7c9036b0561cc176131bf20f77a1b',
      builderWork: '7345fd0c51869415915160307332d0c506d8debd5677fcd5850e40da0e4dd8e0',
      attackCoil: 'bca1f7bd034a90f69daa1d314e0f4a62613a12a9a5ccb06941fb2f8edcfcdb44',
      attackImpact: 'b33268a0c14dcda3ade2524cfac951589a037f5f82353b12f6e632de9dae82ad',
      attackSnap: '5d5165cb2a67c4e038833882e98acad5d43e67f74c6b775d16775f3eb6fc8021',
      attackRecovery: '02ecd2b1ab60dfac4bf1c02af17dc6d33df011fa1fe3c6e2dc739c7879fe8e49',
      memory: 'ed2af949e9524bd14d759f0462cc71038b4d9b6c783f05080f96de0963ce10c8',
    });
  });
});
