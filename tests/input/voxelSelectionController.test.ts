import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createVoxelSelectionController } from '../../src/input/voxelSelectionController';

describe('voxel selection controller', () => {
  it('keeps only current hits while preserving their prior semantic order', () => {
    const bridge = createSimulationBridge('tile-selection-cycle-fixture');
    const displayed = bridge.getRenderState().entities;
    const militia = findEntity(displayed, 'militia');
    const house = findEntity(displayed, 'house');
    const sheep = findEntity(displayed, 'sheep');
    const hitOrders = [
      [militia, house, sheep],
      [militia, house, sheep],
      [sheep, house],
      [sheep, house],
    ];
    let hitRead = 0;
    const controller = createVoxelSelectionController({
      isActive: () => true,
      nowMs: () => 0,
      getBridge: () => bridge,
      getDisplayedEntities: () => displayed,
      getVoxelHitEntities: () => hitOrders[Math.min(hitRead++, hitOrders.length - 1)]!,
      getViewportCellBounds: () => ({ minX: 0, minY: 0, maxX: 31, maxY: 31 }),
    });

    for (const expectedType of ['militia', 'house', 'sheep', 'house']) {
      expect(controller.selectEntityAtWorldPosition(0.25, 0.25, 0, 0)).toBe(true);
      expect(bridge.getSelectionState().selectedEntityType).toBe(expectedType);
    }
  });

  it('starts a new cycle at a different exact subpoint in the same cell', () => {
    const bridge = createSimulationBridge('tile-selection-cycle-fixture');
    const displayed = bridge.getRenderState().entities;
    const hits = [
      findEntity(displayed, 'militia'),
      findEntity(displayed, 'house'),
    ];
    const controller = createVoxelSelectionController({
      isActive: () => true,
      nowMs: () => 0,
      getBridge: () => bridge,
      getDisplayedEntities: () => displayed,
      getVoxelHitEntities: () => hits,
      getViewportCellBounds: () => ({ minX: 0, minY: 0, maxX: 31, maxY: 31 }),
    });

    expect(controller.selectEntityAtWorldPosition(0.25, 0.25, 0, 0)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('militia');
    expect(controller.selectEntityAtWorldPosition(0.75, 0.25, 16, 8)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityType).toBe('militia');
  });
});

function findEntity(
  entities: readonly ProjectedEntityView[],
  entityType: ProjectedEntityView['entityType'],
): ProjectedEntityView {
  const entity = entities.find((candidate) => candidate.entityType === entityType);
  if (!entity) throw new Error(`Missing ${entityType} fixture entity.`);
  return entity;
}
