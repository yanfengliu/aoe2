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
    }).toEqual({
      idle: 'd280a07bb9dd0d76ebfb11fd5be57b6b66f358b4c40fd6aada430a5728d005e9',
      locomotion: '8956429e26caf803dc27a4eb35c4917ec541d7009717ade5d676dbfea2cf3da4',
      builderWork: '1cee6c049370351ac8f8454cac359cd97dd682ee027a05e344706afa16d6b54c',
      attackCoil: '07f47f93ed423b7eaf87dd630a333d82d5a952061f66a59f16a362d71e186ecd',
      attackImpact: '06da584f8a9bdb436064628c5112336519b8bd2a288af2e3106a63df0aabffcf',
      attackSnap: '3215a116a4fd45e2647f690c6fdf376439b5999286260ae0b5b372edff6cd9d8',
      attackRecovery: '0d52732ead65576e8e52d905ed84d9fc60baaa5a9cbcb1473437c6f585a41ef4',
      memory: 'c7e228817350ee16170231ba19bfd202a584a2ea50aee77d8dd29b81a0d3d060',
    });
  });
});
