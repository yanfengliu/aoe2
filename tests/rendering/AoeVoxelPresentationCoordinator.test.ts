import { describe, expect, it } from 'vitest';

import type {
  ProjectedEntityView,
  RenderState,
} from '../../src/game/simulation/types';
import { createAoeVoxelPresentationCoordinator } from '../../src/rendering/voxel/AoeVoxelPresentationCoordinator';

function unit(x: number): ProjectedEntityView {
  return {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'scout',
    owner: 1,
    x,
    y: 4,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.8,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 45,
    maxHp: 45,
    isMemory: false,
  };
}

describe('AoeVoxelPresentationCoordinator interpolation', () => {
  it('interpolates from the exact prior tick after the host coalesces multiple ticks', () => {
    let alpha = 0;
    let state: RenderState = {
      tick: 0,
      entities: [unit(1)],
      frame: null,
      previousPositionFrame: null,
    };
    const presented: ProjectedEntityView[][] = [];
    const coordinator = createAoeVoxelPresentationCoordinator({
      getBridge: () => ({
        getRenderState: () => state,
        getRenderInterpolationAlpha: () => alpha,
      }),
      isActive: () => true,
      getPlacementPreviewState: () => null,
      getSelectionBoxState: () => null,
      screenToWorldPosition: (x, y) => ({ x, z: y }),
      centerCameraOnWorldPosition: () => undefined,
      present: (entities) => presented.push(entities.map((entity) => ({ ...entity }))),
    });
    coordinator.syncFromBridge(true);

    state = {
      tick: 2,
      entities: [unit(3)],
      frame: null,
      previousPositionFrame: {
        tick: 1,
        positions: [{ id: 7, generation: 3, x: 2, y: 4 }],
      },
    };
    alpha = 0.5;
    coordinator.syncFromBridge();

    expect(presented.at(-1)?.[0]).toMatchObject({ x: 2.5, y: 4 });
  });

  it('refuses a stale non-adjacent position frame instead of blending across skipped state', () => {
    const state: RenderState = {
      tick: 4,
      entities: [unit(5)],
      frame: null,
      previousPositionFrame: {
        tick: 2,
        positions: [{ id: 7, generation: 3, x: 2, y: 4 }],
      },
    };
    let displayed: readonly ProjectedEntityView[] = [];
    const coordinator = createAoeVoxelPresentationCoordinator({
      getBridge: () => ({
        getRenderState: () => state,
        getRenderInterpolationAlpha: () => 0.5,
      }),
      isActive: () => true,
      getPlacementPreviewState: () => null,
      getSelectionBoxState: () => null,
      screenToWorldPosition: (x, y) => ({ x, z: y }),
      centerCameraOnWorldPosition: () => undefined,
      present: (entities) => { displayed = entities; },
    });

    coordinator.syncFromBridge(true);

    expect(displayed[0]).toMatchObject({ x: 5, y: 4 });
  });
});
