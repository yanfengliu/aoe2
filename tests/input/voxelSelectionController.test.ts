import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { createVoxelSelectionController } from '../../src/input/voxelSelectionController';

// The double-click window is measured between the two clicks' OWN input times
// — the pointerup `timeStamp`s the pointer passes in — and never on a clock
// read while a click is being handled. On a slow page the handler runs late
// (the view renders a frame first, and a slow frame can fall between the two
// clicks), so a handler clock drops a real double-click: on SwiftShader two
// clicks 20 ms apart measured 305 ms (2026-09-23, register entry of that date).
// BOUND: the controller alone, on the double-click fixture's three villagers;
// the pointer controller's hand-off of `event.timeStamp` and the real page are
// covered by tests/browser/double-click-busy-page.spec.ts.
describe('voxel selection controller: the double-click is timed on the input clock', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function doubleClickFixture() {
    const bridge = createSimulationBridge('double-click-selection-fixture');
    const displayed = bridge.getRenderState().entities;
    const villager = findEntity(displayed, 'villager');
    const controller = createVoxelSelectionController({
      isActive: () => true,
      getBridge: () => bridge,
      getDisplayedEntities: () => displayed,
      getVoxelHitEntities: () => [villager],
      getViewportCellBounds: () => ({ minX: 0, minY: 0, maxX: 31, maxY: 31 }),
    });
    const click = (pointerTimeMs?: number): boolean => controller.selectEntityAtWorldPosition(
      villager.x + 0.5, villager.y + 0.5, 0, 0, pointerTimeMs,
    );
    return { bridge, click };
  }

  it('selects every villager when the second click lands inside the window, however late it is handled', () => {
    const { bridge, click } = doubleClickFixture();
    // The page handles the two clicks five seconds apart; the player made them 100 ms apart.
    let handlingAt = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => handlingAt);
    expect(click(1_000)).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(1);
    handlingAt = 5_000;
    expect(click(1_100)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({ selectedCount: 3, selectedEntityType: 'villager' });
  });

  it('keeps one villager when the clicks are further apart than the window, however quickly they are handled', () => {
    const { bridge, click } = doubleClickFixture();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    expect(click(1_000)).toBe(true);
    expect(click(1_400)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({ selectedCount: 1, selectedEntityType: 'villager' });
  });

  it('never reads two clicks without an input time as a double-click', () => {
    const { bridge, click } = doubleClickFixture();
    expect(click()).toBe(true);
    expect(click()).toBe(true);
    expect(bridge.getSelectionState().selectedCount).toBe(1);
  });
});

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

  it('targets a boar through an overlapping friendly villager for a group command', () => {
    const bridge = createSimulationBridge('boar-hunt-fixture');
    const displayed = bridge.getRenderState().entities;
    const villager = findEntity(displayed, 'villager');
    const boar = findEntity(displayed, 'boar');
    const controller = createVoxelSelectionController({
      isActive: () => true,
      getBridge: () => bridge,
      getDisplayedEntities: () => displayed,
      // Presented silhouettes rank units above resources. The controller must
      // keep that raw hit order for selection while choosing the actionable
      // boar for a selected villager group's context command.
      getVoxelHitEntities: () => [villager, boar],
      getViewportCellBounds: () => ({ minX: 0, minY: 0, maxX: 31, maxY: 31 }),
    });

    expect(bridge.selectUnitsInBox(12, 7, 14, 9)).toBe(true);
    expect(bridge.getSelectionState()).toMatchObject({
      selectedCount: 6,
      selectedEntityType: 'villager',
    });
    expect(controller.issueContextCommandAtWorldPosition(13.5, 8.5, 0, 0)).toBe(true);

    bridge.step(100);
    expect(
      bridge
        .getDebugSnapshot()
        .unitPaths.filter(
          (path) => path.commandType === 'attack' && path.toX === 13 && path.toY === 8,
        ),
    ).toHaveLength(6);
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
