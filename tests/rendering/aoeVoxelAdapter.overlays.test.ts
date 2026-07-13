import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import {
  projectVoxelPointToIso,
  voxelPartMaxY,
} from '../../src/rendering/voxel/aoeVoxelGeometry';

function view(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'tile',
    layer: 'terrain',
    entityType: 'grass',
    owner: null,
    x: 0,
    y: 0,
    elevation: 0,
    tint: 0x587f4e,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

type AdapterSnapshot = ReturnType<AoeVoxelAdapter['createSnapshot']>;

function allInstanceKeys(snapshot: AdapterSnapshot): string[] {
  return snapshot.batches.flatMap((batch) => batch.instanceKeys);
}

function partMatrix(snapshot: AdapterSnapshot, key: string): Float32Array {
  const batch = snapshot.batches.find((candidate) => candidate.instanceKeys.includes(key));
  if (!batch) throw new Error(`Missing expected voxel part: ${key}`);
  const index = batch.instanceKeys.indexOf(key);
  return batch.matrices.slice(index * 16, index * 16 + 16);
}

describe('AoeVoxelAdapter world feedback projection', () => {
  it('emits fog, selection, health, placement, and death feedback as voxel data', () => {
    const selected = view({
      id: 7,
      generation: 3,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      owner: 1,
      x: 2,
      y: 3,
      selected: true,
      currentHp: 20,
      maxHp: 40,
    });
    const snapshot = new AoeVoxelAdapter().createSnapshot(
      [view({ id: 1 }), view({ id: 2, x: 1 }), selected],
      1_000,
      {
        frame: {
          tick: 10,
          playerId: 1,
          seed: 'voxel-only',
          mapWidth: 2,
          mapHeight: 1,
          visibleCells: [1],
          exploredCells: [1, 1],
          recentUnitDeaths: [{
            id: 9,
            tick: 9,
            x: 1,
            y: 0,
            owner: 2,
            unitType: 'militia',
            tint: 0xcc3333,
            size: 0.7,
            witnessedBy: [1],
          }],
        },
        placementPreview: {
          active: true,
          buildingType: 'house',
          cellX: 0,
          cellY: 0,
          width: 2,
          height: 2,
          isValid: false,
        },
        selectionPreviewEntityIds: [7],
      },
    );

    expect(allInstanceKeys(snapshot)).toEqual(expect.arrayContaining([
      'ui:selection:7:3:north',
      'ui:health:7:3:background',
      'ui:health:7:3:fill',
      'ui:placement:house:0:0:cell:0:0',
      'ui:placement:house:0:0:blocked',
      'ui:death:9:9:debris-a',
    ]));
    expect(snapshot.resources).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'material', key: 'aoe2:material:ui', shading: 'unlit' }),
    ]));
    const palette = snapshot.resources.find((resource) => resource.kind === 'palette')!;
    expect(palette.entries.some((entry) => (
      Math.max(entry.color.r, entry.color.g, entry.color.b) > 0
      && Math.max(entry.color.r, entry.color.g, entry.color.b) < 30
    ))).toBe(true);
  });

  it('shows a bounded voxel impact flash after health drops', () => {
    const adapter = new AoeVoxelAdapter();
    const unit = view({
      id: 7,
      generation: 3,
      kind: 'unit',
      layer: 'unit',
      currentHp: 40,
      maxHp: 40,
    });
    adapter.createSnapshot([unit], 0);
    const hit = adapter.createSnapshot([{ ...unit, currentHp: 30 }], 100);
    const expired = adapter.createSnapshot([{ ...unit, currentHp: 30 }], 500);

    expect(allInstanceKeys(hit)).toContain('ui:hit:7:3:spark-a');
    expect(allInstanceKeys(expired)).not.toContain('ui:hit:7:3:spark-a');
  });

  it('keeps live and fog-memory parts on the standalone ground plane', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([
      view({ id: 1, x: 2, y: 3, entityType: 'hill', elevation: 1 }),
      view({ id: 2, x: 6, y: 7, entityType: 'hill', elevation: 1 }),
      view({
        id: 20,
        generation: 4,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        x: 2.25,
        y: 3.1,
      }),
      view({
        id: 21,
        generation: undefined,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        x: 6,
        y: 7,
        isMemory: true,
      }),
    ]);
    for (const key of ['20:4:villager-boot-left', '21:memory:house-plinth']) {
      const matrix = partMatrix(snapshot, key);
      expect(matrix[13]! - matrix[5]! / 2).toBeCloseTo(0);
    }
  });

  it('renders an empty-selection drag marquee as four voxel segments', () => {
    const snapshot = new AoeVoxelAdapter().createSnapshot([view()], 0, {
      frame: null,
      placementPreview: null,
      selectionPreviewEntityIds: [],
      selectionMarqueeWorldCorners: [
        { x: 1, z: 2 },
        { x: 4, z: 2 },
        { x: 4, z: 5 },
        { x: 1, z: 5 },
      ],
    });

    expect(allInstanceKeys(snapshot)).toEqual(expect.arrayContaining([
      'ui:marquee:0',
      'ui:marquee:1',
      'ui:marquee:2',
      'ui:marquee:3',
    ]));
    const north = partMatrix(snapshot, 'ui:marquee:0');
    const east = partMatrix(snapshot, 'ui:marquee:1');
    expect(north[0]).toBeCloseTo(3);
    expect(Math.abs(east[2]!)).toBeCloseTo(3);
    const projectedNorth = projectVoxelPointToIso({
      x: north[12]!,
      y: north[13]!,
      z: north[14]!,
    });
    expect(projectedNorth.x).toBeCloseTo(16);
    expect(projectedNorth.y).toBeCloseTo(72);
    expect(north[13]).toBeGreaterThan(5);
  });

  it('places a selected watch-tower health bar above its authored voxel geometry', () => {
    const tower = view({
      id: 8,
      generation: 2,
      kind: 'building',
      layer: 'building',
      entityType: 'watch-tower',
      owner: 1,
      x: 4,
      y: 6,
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'complete',
      selected: true,
      currentHp: 500,
      maxHp: 500,
    });
    const snapshot = new AoeVoxelAdapter().createSnapshot([tower]);
    const health = partMatrix(snapshot, 'ui:health:8:2:background');
    const authoredTop = Math.max(
      ...createBuildingParts(tower, '8:2', 0)
        .filter((part) => part.surface !== 'shadow')
        .map(voxelPartMaxY),
    );

    expect(health[13]! - Math.abs(health[5]!) / 2).toBeGreaterThan(authoredTop);
  });

  it('places building hit sparks above authored geometry instead of inside the roof', () => {
    const townCenter = view({
      id: 9,
      generation: 4,
      kind: 'building',
      layer: 'building',
      entityType: 'town-center',
      owner: 1,
      x: 4,
      y: 6,
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'complete',
      currentHp: 2_400,
      maxHp: 2_400,
    });
    const adapter = new AoeVoxelAdapter();
    adapter.createSnapshot([townCenter], 0);
    const hit = adapter.createSnapshot([{ ...townCenter, currentHp: 2_200 }], 100);
    const authoredTop = Math.max(
      ...createBuildingParts(townCenter, '9:4', 0)
        .filter((part) => part.surface !== 'shadow')
        .map(voxelPartMaxY),
    );

    for (const suffix of ['spark-a', 'spark-b', 'spark-c']) {
      const matrix = partMatrix(hit, `ui:hit:9:4:${suffix}`);
      expect(matrix[13]! - Math.abs(matrix[5]!) / 2).toBeGreaterThan(authoredTop);
    }
  });
});
