import { describe, expect, it } from 'vitest';

import type {
  ProjectedEntityView,
  RenderState,
} from '../../src/game/simulation/types';
import {
  createAoeVoxelPresentationCoordinator,
  type AoeVoxelPresentationCoordinator,
} from '../../src/rendering/voxel/AoeVoxelPresentationCoordinator';

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

function harness(initial: RenderState): {
  coordinator: AoeVoxelPresentationCoordinator;
  set(next: RenderState, alpha: number): void;
  presented(): readonly ProjectedEntityView[];
} {
  let state = initial;
  let alpha = 0;
  let displayed: readonly ProjectedEntityView[] = [];
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
    present: (entities) => { displayed = entities.map((entity) => ({ ...entity })); },
  });
  return {
    coordinator,
    set(next, nextAlpha) {
      state = next;
      alpha = nextAlpha;
    },
    presented: () => displayed,
  };
}

function renderState(tick: number, x: number): RenderState {
  return { tick, entities: [unit(x)], frame: null };
}

describe('AoeVoxelPresentationCoordinator displayed positions', () => {
  it('draws a unit that steps as continuously advancing, from the tick its first step lands', () => {
    const { coordinator, set, presented } = harness(renderState(0, 1));
    coordinator.syncFromBridge(true);
    expect(presented()[0]).toMatchObject({ x: 1, y: 4 });

    // The sim's first fine step: motion is drawn at once, at cadence speed,
    // strictly between the rest position and the new sim position.
    set(renderState(1, 1.25), 0.25);
    coordinator.syncFromBridge();
    const early = presented()[0]!.x;
    expect(early).toBeGreaterThan(1);
    expect(early).toBeLessThan(1.25);

    // Later in the same tick it has moved further, and still trails the sim.
    set(renderState(1, 1.25), 0.75);
    coordinator.syncFromBridge();
    const later = presented()[0]!.x;
    expect(later).toBeGreaterThan(early);
    expect(later).toBeLessThan(1.25);

    // A tick on which the sim did NOT step still draws the root moving —
    // the pulse the owner saw was exactly this frame standing still.
    set(renderState(2, 1.25), 0.5);
    coordinator.syncFromBridge();
    expect(presented()[0]!.x).toBeGreaterThan(later);
    expect(presented()[0]!.x).toBeLessThanOrEqual(1.25);
  });

  it('draws a unit first sighted at a non-adjacent tick where the sim says, not sliding from any earlier state', () => {
    // Presented at tick 0 without the unit (fogged), then at tick 4 with it:
    // the ticks in between were never presented, so there is nothing honest
    // to blend from and the sighting is drawn at its sim position.
    const { coordinator, set, presented } = harness({ tick: 0, entities: [], frame: null });
    coordinator.syncFromBridge(true);
    set(renderState(4, 5), 0.5);
    coordinator.syncFromBridge();
    expect(presented()[0]).toMatchObject({ x: 5, y: 4 });
  });

  it('keeps gliding when the host coalesces several ticks into one sync', () => {
    // The live frame loop coalesces up to 2.5 ticks a frame (250 ms bound; 5
    // at double speed) and the test API's advanceTicks(N) any number — and on
    // a machine drawing slower than 10 fps, EVERY frame does. A gap is
    // bracketed by two observed sim positions, so it is ordinary walking seen
    // at its endpoints, not a discontinuity: the drawn root keeps its history
    // and keeps gliding, still trailing the sim. Snapping here was the first
    // cut's defect and it stood the picture still on exactly those machines
    // (v0.3.192; only a jump past 1.5 tiles or a rewind snaps now).
    const { coordinator, set, presented } = harness(renderState(0, 1));
    coordinator.syncFromBridge(true);
    set(renderState(1, 1.25), 0.5);
    coordinator.syncFromBridge();
    const beforeGap = presented()[0]!.x;
    expect(beforeGap).toBeLessThan(1.25);

    set(renderState(4, 2), 0.5);
    coordinator.syncFromBridge();
    const acrossGap = presented()[0]!.x;
    expect(acrossGap).toBeGreaterThan(beforeGap);
    expect(acrossGap).toBeLessThan(2);

    set(renderState(5, 2.25), 0.5);
    coordinator.syncFromBridge();
    const resumed = presented()[0]!.x;
    expect(resumed).toBeGreaterThan(acrossGap);
    expect(resumed).toBeLessThan(2.25);
  });

  it('snaps to the sim position after a bridge swap instead of gliding from the old game', () => {
    const { coordinator, set, presented } = harness(renderState(0, 1));
    coordinator.syncFromBridge(true);
    set(renderState(1, 1.25), 0.5);
    coordinator.syncFromBridge();
    expect(presented()[0]!.x).toBeLessThan(1.25);

    coordinator.resetForBridgeSwap();
    set(renderState(0, 1.25), 0.5);
    coordinator.syncFromBridge(true);
    expect(presented()[0]).toMatchObject({ x: 1.25, y: 4 });
  });
});
