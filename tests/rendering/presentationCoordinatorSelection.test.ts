// The presentation coordinator presents again when the selection changes between ticks (a paused match, where the
// tick and the interpolation stand still), and reports the buildings and health bars of what it last presented.
// Work 150 M2b made both cheaper: the selection's key is read off a list once instead of on every frame, and the
// two lists, which only the browser test API reads, are built when asked for instead of on every frame. These
// cases hold what the page relies on through that change: a selection made or dropped is drawn at once, an
// unchanged list presents nothing, and the lists are the last presented entities', through a bridge swap and its
// rollback.
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';
import { createAoeVoxelPresentationCoordinator } from '../../src/rendering/voxel/AoeVoxelPresentationCoordinator';
import { terrain } from './helpers/fakeVoxelRuntime';

function view(id: number, overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return { ...terrain(), id, generation: 0, x: 3, y: 4, ...overrides };
}

const villager = (selected: boolean): ProjectedEntityView => view(7, {
  kind: 'unit', layer: 'unit', entityType: 'villager', owner: 1, selected, currentHp: 20, maxHp: 25,
});
const house = (): ProjectedEntityView => view(8, {
  kind: 'building', layer: 'building', entityType: 'house', owner: 1, x: 6, y: 6, footprintWidth: 2, footprintHeight: 2, currentHp: 550, maxHp: 550,
});

function harness(initial: ProjectedEntityView[]) {
  let state: RenderState = { tick: 5, entities: initial, frame: null };
  const presented: ProjectedEntityView[][] = [];
  const coordinator = createAoeVoxelPresentationCoordinator({
    getBridge: () => ({ getRenderState: () => state, getRenderInterpolationAlpha: () => 0 }),
    isActive: () => true,
    getPlacementPreviewState: () => null,
    getSelectionBoxState: () => null,
    screenToWorldPosition: () => ({ x: 0, z: 0 }),
    centerCameraOnWorldPosition: () => undefined,
    present: (entities) => { presented.push([...entities]); },
  });
  return {
    coordinator,
    presented,
    /** The bridge hands back a new list, as it does after any change between ticks. */
    hand(entities: ProjectedEntityView[]) { state = { ...state, entities }; },
  };
}

describe('the presentation coordinator between ticks', () => {
  it('presents again when a unit is selected, and again when it is dropped', () => {
    const { coordinator, presented, hand } = harness([terrain(), villager(false)]);
    coordinator.syncFromBridge();
    coordinator.syncFromBridge();
    expect(presented, 'one present for a list that did not change').toHaveLength(1);

    hand([terrain(), villager(true)]);
    coordinator.syncFromBridge();
    expect(presented, 'the selection is drawn at once').toHaveLength(2);
    expect(presented[1]!.find((entity) => entity.id === 7)?.selected).toBe(true);
    coordinator.syncFromBridge();
    expect(presented).toHaveLength(2);

    hand([terrain(), villager(false)]);
    coordinator.syncFromBridge();
    expect(presented, 'and so is its end').toHaveLength(3);
    expect(presented[2]!.find((entity) => entity.id === 7)?.selected).toBe(false);

    // A third list, with the selection it had: nothing the coordinator watches moved.
    hand([terrain(), villager(false)]);
    coordinator.syncFromBridge();
    expect(presented).toHaveLength(3);
  });

  it('reports the buildings and health bars of what it last presented, through a swap and its rollback', () => {
    const { coordinator, hand } = harness([terrain(), villager(false), house()]);
    expect(coordinator.getBuildingVisualStates()).toEqual([]);
    expect(coordinator.getEntityHealthBarStates()).toEqual([]);
    coordinator.syncFromBridge();
    expect(coordinator.getBuildingVisualStates().map((state) => [state.id, state.buildingType])).toEqual([[8, 'house']]);
    expect(coordinator.getEntityHealthBarStates().map((state) => [state.id, state.fillRatio])).toEqual([[7, 0.8], [8, 1]]);
    // Each read is the caller's own copy.
    expect(coordinator.getBuildingVisualStates()[0]).not.toBe(coordinator.getBuildingVisualStates()[0]);

    // The house is gone from the next list, but nothing presents it until the selection or the tick moves.
    hand([terrain(), villager(false)]);
    coordinator.syncFromBridge();
    expect(coordinator.getBuildingVisualStates()).toHaveLength(1);
    hand([terrain(), villager(true)]);
    coordinator.syncFromBridge();
    expect(coordinator.getBuildingVisualStates()).toEqual([]);
    expect(coordinator.getEntityHealthBarStates().map((state) => state.id)).toEqual([7]);

    const rollback = coordinator.resetForBridgeSwap();
    expect(coordinator.getEntityHealthBarStates()).toEqual([]);
    rollback();
    expect(coordinator.getEntityHealthBarStates().map((state) => state.id)).toEqual([7]);
  });
});
