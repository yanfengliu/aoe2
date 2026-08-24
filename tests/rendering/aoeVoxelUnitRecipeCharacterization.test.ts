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
      // Re-recorded 2026-08-23 for the three line tiers (Capped Ram, Siege
      // Onager, Elite Skirmisher). A whole-population hash cannot say WHICH
      // unit moved it, so before touching these the per-unit digest check was
      // run with an identity keyed by TYPE rather than by list position: all 83
      // pre-existing units were byte-identical and only the three new entries
      // appeared. Keying by position — which this payload does — makes an
      // insertion shift every later unit's identity, which is why 56 units
      // first looked changed and none of them were.
    }).toEqual({
      idle: '46a65cbff423172182c08c6a3215d13330d04f1166d5e9d3704022328c92b4c1',
      locomotion: 'd1009237883519cbbbc6f3ecea7f107ca17011a6eebfc383c34afc76a16adaf1',
      builderWork: '5a2c4dc02ff299f27b5cc738c98490c01f7958cb000d1729f27c05173a4e2192',
      attackCoil: 'fe6b7948f505f9569a52e037ac4d07dac516ef60b241775cddcfa0b83c256497',
      attackImpact: '7a886c0c537991f8a16378335adcda1d8ced587978c6a29c28c74c2b1e702268',
      attackSnap: 'f81719b0b179735a90649ea7a7241d148d2097754df2d65a81e053f943a0b6ca',
      attackRecovery: 'c89e371eca4001ec8edab6c094ef69ac18507d6dbeaa4973ff8a4f26d8c80035',
      memory: '8d648bba9963969ae1a9a31b5966574a5bbfef316cc1d21d169250e04c1529ba',
    });
  });
});
