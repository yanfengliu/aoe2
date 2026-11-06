// Work 146, review round 0's FINDING-1: two quick Shift clicks at one place on
// a unit add every unit of its type on screen, and a quick Shift click on the
// ground beside a Shift-clicked unit is a click on the ground, which changes
// nothing (spec §9.4), as a plain click on the ground never forms a
// double-click. Before the repair it read as the pair's second half and added
// every villager.
// BOUND: the controller alone on the double-click fixture's three villagers,
// its hit test faked to put one villager under iso (0,0) and nothing under (3,0).

import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { createVoxelSelectionController } from '../../src/input/voxelSelectionController';
import { voxelEntityHitRegions } from '../../src/rendering/voxel/aoeVoxelHitProxy';

const WHOLE_FIXTURE_ON_SCREEN = { minX: -1024, minY: -64, maxX: 1024, maxY: 1056 };
const SHIFT = { shift: true, ctrl: false };

function shiftClickFixture() {
  const bridge = createSimulationBridge('double-click-selection-fixture');
  const displayed = bridge.getRenderState().entities;
  const villager = displayed.find((entity) => entity.kind === 'unit' && entity.entityType === 'villager')!;
  const controller = createVoxelSelectionController({
    isActive: () => true,
    getBridge: () => bridge,
    getDisplayedEntities: () => displayed,
    getVoxelHitEntities: (isoX) => (isoX === 0 ? [villager] : []),
    getViewIsoBounds: () => WHOLE_FIXTURE_ON_SCREEN,
    getDrawnPolygons: (ids) => new Map(displayed
      .filter((entity) => ids.has(entity.id))
      .map((entity) => [entity.id, voxelEntityHitRegions(entity).map(({ polygon }) => polygon)])),
  });
  const villagers = displayed.filter((entity) => entity.kind === 'unit' && entity.entityType === 'villager' && entity.owner === 1);
  return { bridge, controller, villager, villagers };
}

describe('Shift and the double-click (work 146)', () => {
  it('two quick Shift clicks on a villager add every villager on screen', () => {
    const { bridge, controller, villager, villagers } = shiftClickFixture();
    expect(villagers.length, 'the fixture has three villagers').toBe(3);
    expect(controller.selectEntityAtWorldPosition(villager.x + 0.5, villager.y + 0.5, 0, 0, 1_000, SHIFT)).toBe(true);
    expect(bridge.getSelectionState().selectedEntityIds).toEqual([villager.id]);
    expect(controller.selectEntityAtWorldPosition(villager.x + 0.5, villager.y + 0.5, 0, 0, 1_100, SHIFT)).toBe(true);
    expect([...bridge.getSelectionState().selectedEntityIds].sort()).toEqual(villagers.map((entity) => entity.id).sort());
  });

  it('a quick Shift click on the ground beside a Shift-clicked villager changes nothing', () => {
    const { bridge, controller, villager } = shiftClickFixture();
    const ground = { x: villager.x + 6.5, y: villager.y + 6.5 };
    expect(controller.entitiesAtWorldPosition(ground.x, ground.y), 'the ground point holds nothing').toEqual([]);
    expect(controller.selectEntityAtWorldPosition(villager.x + 0.5, villager.y + 0.5, 0, 0, 1_000, SHIFT)).toBe(true);
    expect(controller.selectEntityAtWorldPosition(ground.x, ground.y, 3, 0, 1_100, SHIFT)).toBe(false);
    expect(bridge.getSelectionState().selectedEntityIds).toEqual([villager.id]);
  });
});
