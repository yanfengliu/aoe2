import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import {
  matrixForPart,
  type VoxelPart,
} from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createTerrainDetailParts } from '../../src/rendering/voxel/aoeVoxelTerrain';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

const TEAM_BLUE = 0x3568c0;

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 4,
    y: 5,
    elevation: 0,
    tint: TEAM_BLUE,
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

function suffixes(parts: readonly VoxelPart[]): string[] {
  return parts.map((part) => part.key.split(':').slice(2).join(':'));
}

function expectValidParts(parts: readonly VoxelPart[], min: number, max: number): void {
  expect(parts.length).toBeGreaterThanOrEqual(min);
  expect(parts.length).toBeLessThanOrEqual(max);
  expect(new Set(parts.map((part) => part.key)).size).toBe(parts.length);
  for (const part of parts) {
    expect([part.centerX, part.centerY, part.centerZ, part.width, part.height, part.depth]
      .every(Number.isFinite)).toBe(true);
    expect(part.width).toBeGreaterThan(0);
    expect(part.height).toBeGreaterThan(0);
    expect(part.depth).toBeGreaterThan(0);
    expect(matrixForPart(part).every(Number.isFinite)).toBe(true);
  }
}

function minTransformedY(part: VoxelPart): number {
  const matrix = matrixForPart(part);
  return [-0.5, 0.5].flatMap((x) => [-0.5, 0.5].flatMap((y) => (
    [-0.5, 0.5].map((z) => (
      matrix[1]! * x + matrix[5]! * y + matrix[9]! * z + matrix[13]!
    ))
  ))).reduce((minimum, value) => Math.min(minimum, value), Number.POSITIVE_INFINITY);
}

function expectPitchPlane(part: VoxelPart, directionX: number, directionZ: number): void {
  const matrix = matrixForPart(part);
  const pitchedUpX = matrix[4]! / part.height;
  const pitchedUpZ = matrix[6]! / part.height;
  expect(Math.abs(pitchedUpX * directionZ - pitchedUpZ * directionX)).toBeLessThan(1e-6);
  expect(Math.hypot(pitchedUpX, pitchedUpZ)).toBeGreaterThan(0.01);
}

describe('AoE voxel building recipes', () => {
  it('turns a Town Center into a detailed neutral landmark with faction accents', () => {
    const parts = createBuildingParts(entity({
      kind: 'building',
      layer: 'building',
      entityType: 'town-center',
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'complete',
    }), '20:3', 0);

    expectValidParts(parts, 20, 40);
    expect(suffixes(parts)).toEqual(expect.arrayContaining([
      'town-center-plinth',
      'town-center-door',
      'town-center-tower',
      'town-center-flag',
      'town-center-window-left',
    ]));
    expect(parts.some((part) => part.tint === TEAM_BLUE)).toBe(true);
    expect(parts.some((part) => part.tint !== TEAM_BLUE && part.surface === 'matte')).toBe(true);
    expect(parts.filter((part) => part.tint === TEAM_BLUE).length).toBeLessThan(parts.length / 2);
  });

  it('keeps construction visibly scaffolded and simpler than the completed facade', () => {
    const base = entity({
      kind: 'building',
      layer: 'building',
      entityType: 'house',
      footprintWidth: 2,
      footprintHeight: 2,
    });
    const complete = createBuildingParts({ ...base, visualVariant: 'complete' }, '2:1', 0);
    const construction = createBuildingParts(
      { ...base, visualVariant: 'construction' },
      '2:1',
      0,
    );

    expect(suffixes(complete)).toContain('house-chimney-cap');
    expect(suffixes(construction)).toEqual(expect.arrayContaining([
      'construction-foundation',
      'construction-scaffold-front-left',
      'construction-wall-course',
    ]));
    expect(construction.length).toBeLessThan(complete.length);
  });
});

describe('AoE voxel unit recipes', () => {
  it.each([
    ['villager', ['villager-tool-handle', 'villager-tool-head']],
    ['militia', ['infantry-shield', 'infantry-sword']],
    ['archer', ['archer-bow-upper', 'archer-quiver']],
    ['knight', ['cavalry-horse-body', 'cavalry-rider-tunic']],
    ['mangonel', ['siege-chassis', 'siege-wheel-left']],
    ['monk', ['monk-robe', 'monk-staff']],
  ] as const)('gives %s a bounded role-specific silhouette', (entityType, expected) => {
    const parts = createUnitParts(entity({ entityType }), '7:4', 0);
    expectValidParts(parts, 8, 26);
    expect(suffixes(parts)).toEqual(expect.arrayContaining([...expected]));
    expect(parts.some((part) => part.surface === 'shadow')).toBe(true);
  });

  it.each([
    'villager',
    'knight',
    'battering-ram',
  ] as const)('rotates the complete %s pose rigidly between travel headings', (entityType) => {
    const east = createUnitParts(entity({ entityType }), '7:4', 0, {
      mode: 'idle',
      phaseRadians: 0,
      gaitPhaseRadians: 0,
      locomotionWeight: 0,
      speedWorldUnitsPerSecond: 0,
      directionX: 1,
      directionZ: 0,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    });
    const south = createUnitParts(entity({ entityType }), '7:4', 0, {
      mode: 'idle',
      phaseRadians: 0,
      gaitPhaseRadians: 0,
      locomotionWeight: 0,
      speedWorldUnitsPerSecond: 0,
      directionX: 0,
      directionZ: 1,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    });
    const rootX = 4.5;
    const rootZ = 5.5;

    expect(south.map((part) => part.key)).toEqual(east.map((part) => part.key));
    for (let index = 0; index < east.length; index += 1) {
      const eastPart = east[index]!;
      const southPart = south[index]!;
      const eastMatrix = matrixForPart(eastPart);
      const southMatrix = matrixForPart(southPart);
      expect(southPart.centerX - rootX).toBeCloseTo(-(eastPart.centerZ - rootZ));
      expect(southPart.centerZ - rootZ).toBeCloseTo(eastPart.centerX - rootX);
      expect(southMatrix[0]).toBeCloseTo(-eastMatrix[2]!);
      expect(southMatrix[2]).toBeCloseTo(eastMatrix[0]!);
    }
  });

  it.each([
    ['villager', 'villager-apron'],
    ['militia', 'infantry-belt'],
    ['archer', 'archer-belt'],
    ['monk', 'monk-face'],
    ['knight', 'cavalry-horse-head'],
    ['cavalry-archer', 'cavalry-horse-head'],
    ['battering-ram', 'siege-ram-head'],
    ['mangonel', 'siege-bucket'],
  ] as const)('points the semantic front of %s along every cardinal heading', (
    entityType,
    frontSuffix,
  ) => {
    for (const [directionX, directionZ] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const parts = createUnitParts(entity({ entityType }), '7:4', 0, {
        mode: 'idle',
        phaseRadians: 0,
        gaitPhaseRadians: 0,
        locomotionWeight: 0,
        speedWorldUnitsPerSecond: 0,
        directionX,
        directionZ,
        attackPhase: 0,
        attackWeight: 0,
        ambientSuppressionWeight: 0,
      });
      const front = parts.find((part) => part.key.endsWith(frontSuffix))!;
      const offsetX = front.centerX - 4.5;
      const offsetZ = front.centerZ - 5.5;

      expect(offsetX * directionX + offsetZ * directionZ).toBeGreaterThan(0);
      expect(
        Math.abs(offsetX * directionZ - offsetZ * directionX)
        / Math.hypot(offsetX, offsetZ),
      ).toBeLessThan(0.01);
    }
  });

  it('normalizes one direction for the complete pose and rejects non-finite headings', () => {
    const state = {
      mode: 'moving',
      phaseRadians: 0,
      gaitPhaseRadians: Math.PI / 2,
      locomotionWeight: 1,
      speedWorldUnitsPerSecond: 2,
      directionX: 1,
      directionZ: 0,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    } as const;
    const normalized = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, state);
    const scaled = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, {
      ...state,
      directionX: 2,
    });

    expect(scaled).toEqual(normalized);
    expect(() => createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, {
      ...state,
      directionX: Number.NaN,
    })).toThrow(RangeError);
  });

  it('lifts and advances opposing humanoid feet without penetrating the ground', () => {
    const moving = {
      mode: 'moving',
      phaseRadians: 0,
      gaitPhaseRadians: Math.PI / 2,
      locomotionWeight: 1,
      speedWorldUnitsPerSecond: 1,
      directionX: 0,
      directionZ: 1,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    } as const;
    const parts = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, moving);
    const resting = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, {
      ...moving,
      mode: 'idle',
      locomotionWeight: 0,
      speedWorldUnitsPerSecond: 0,
    });
    const left = parts.find((part) => part.key.endsWith('villager-boot-left'))!;
    const right = parts.find((part) => part.key.endsWith('villager-boot-right'))!;
    const restingLeft = resting.find((part) => part.key.endsWith('villager-boot-left'))!;
    const restingRight = resting.find((part) => part.key.endsWith('villager-boot-right'))!;

    expect(left.centerY).toBeGreaterThan(right.centerY);
    expect(left.centerZ).toBeGreaterThan(restingLeft.centerZ);
    expect(right.centerZ).toBeLessThan(restingRight.centerZ);
    expect(left.centerY - left.height / 2).toBeGreaterThanOrEqual(0);
    expect(right.centerY - right.height / 2).toBeGreaterThanOrEqual(0);
    expect(left.pitch).not.toBe(0);
    expect(right.pitch ?? 0).toBe(0);
    expect(minTransformedY(left)).toBeGreaterThanOrEqual(0);
    expect(minTransformedY(right)).toBeGreaterThanOrEqual(0);
  });

  it('keeps the planted cavalry leg grounded while its opposite leg lifts', () => {
    const parts = createUnitParts(entity({ entityType: 'knight', size: 1 }), '8:2', 0, {
      mode: 'moving',
      phaseRadians: 0,
      gaitPhaseRadians: Math.PI / 2,
      locomotionWeight: 1,
      speedWorldUnitsPerSecond: 4,
      directionX: 1,
      directionZ: 0,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    });
    const lifted = parts.find((part) => part.key.endsWith('cavalry-horse-leg-front-left'))!;
    const planted = parts.find((part) => part.key.endsWith('cavalry-horse-leg-front-right'))!;

    expect(lifted.centerY).toBeGreaterThan(planted.centerY);
    expect(lifted.pitch).not.toBe(0);
    expect(planted.pitch ?? 0).toBe(0);
    expect(minTransformedY(lifted)).toBeGreaterThanOrEqual(0);
    expect(minTransformedY(planted)).toBeGreaterThanOrEqual(0);
  });

  it.each([
    [1, 0],
    [0, 1],
    [Math.SQRT1_2, Math.SQRT1_2],
  ])('aligns foot flexion with travel direction (%s, %s)', (directionX, directionZ) => {
    const parts = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0, {
      mode: 'moving',
      phaseRadians: 0,
      gaitPhaseRadians: Math.PI / 2,
      locomotionWeight: 1,
      speedWorldUnitsPerSecond: 2,
      directionX,
      directionZ,
      attackPhase: 0,
      attackWeight: 0,
      ambientSuppressionWeight: 0,
    });
    const lifted = parts.find((part) => part.key.endsWith('villager-boot-left'))!;

    expectPitchPlane(lifted, directionX, directionZ);
    expect(minTransformedY(lifted)).toBeGreaterThanOrEqual(0);
  });
});

describe('AoE voxel resource and terrain recipes', () => {
  it.each([
    ['tree', ['tree-trunk', 'tree-crown-top']],
    ['gold-mine', ['gold-mine-rock-center', 'gold-mine-glint']],
    ['berry-bush', ['berry-bush-leaves-center', 'berry-bush-berry-left']],
    ['sheep', ['sheep-body', 'sheep-head']],
    ['relic', ['relic-pedestal', 'relic-crossbar']],
  ] as const)('gives %s clustered readable detail', (entityType, expected) => {
    const parts = createResourceParts(entity({
      kind: 'resource',
      layer: 'resource',
      entityType,
    }), '8:2', 0);
    expectValidParts(parts, 5, 20);
    expect(suffixes(parts)).toEqual(expect.arrayContaining([...expected]));
  });

  it('uses reduced-opacity memory material and omits live contact shadows', () => {
    const parts = createResourceParts(entity({
      kind: 'resource',
      layer: 'resource',
      entityType: 'tree',
      isMemory: true,
    }), '8:memory', 0);
    expect(parts.every((part) => part.surface === 'memory')).toBe(true);
  });

  it('emits sparse deterministic terrain props independent of input order', () => {
    const cells = Array.from({ length: 48 }, (_, index) => entity({
      id: 100 + index,
      kind: 'tile',
      layer: 'terrain',
      entityType: index % 4 === 0 ? 'water' : index % 5 === 0 ? 'hill' : 'grass',
      x: index % 8,
      y: Math.floor(index / 8),
      owner: null,
      tint: 0x587f4e,
    }));
    const forward = createTerrainDetailParts(cells);
    const reverse = createTerrainDetailParts([...cells].reverse());
    expect(forward).toEqual(reverse);
    expectValidParts(forward, 3, 30);
    expect(forward.some((part) => part.key.includes('water-glint'))).toBe(true);
  });

  it('encodes rotated thin parts as non-axis-aligned finite matrices', () => {
    const part: VoxelPart = {
      key: 'demo:part',
      surface: 'matte',
      tint: 0xffffff,
      centerX: 1,
      centerY: 2,
      centerZ: 3,
      width: 0.1,
      height: 1,
      depth: 0.1,
      yaw: Math.PI / 4,
      pitch: Math.PI / 5,
      pitchHeadingRadians: Math.PI / 3,
      roll: Math.PI / 6,
    };
    const matrix = matrixForPart(part);
    expect(matrix.every(Number.isFinite)).toBe(true);
    expect(matrix[1]).not.toBe(0);
    expect(matrix[2]).not.toBe(0);
  });
});
