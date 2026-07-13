// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
  createVoxelCameraController,
  type VoxelPointerState,
} from '../../src/input/voxelCameraController';
import { isoToWorld } from '../../src/rendering/isometricProjection';

function harness() {
  const canvas = document.createElement('canvas');
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 800 },
    clientHeight: { configurable: true, value: 600 },
  });
  canvas.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  });
  document.body.append(canvas);
  const keys = new Set<string>();
  let pointer: VoxelPointerState = { x: 400, y: 300, hasMoved: false, isDown: false };
  const controller = createVoxelCameraController({
    canvas,
    mapWidth: 60,
    mapHeight: 36,
    getPressedKeys: () => keys,
    getPointerState: () => pointer,
    isDragSelecting: () => false,
    isMiddleDragging: () => false,
  });
  controller.resize(800, 600);
  return {
    controller,
    keys,
    setPointer(next: VoxelPointerState) {
      pointer = next;
    },
  };
}

describe('voxel camera controller', () => {
  it('round-trips a centered world cell through screen and iso coordinates', () => {
    const { controller } = harness();
    controller.centerOnWorldPosition(10.5, 12.5);

    expect(controller.getScreenPointForCell(10, 12)).toEqual({ x: 400, y: 300 });
    const iso = controller.screenToIso(400, 300);
    const world = isoToWorld(iso.x, iso.y);
    expect(world.cellX).toBeCloseTo(10.5);
    expect(world.cellY).toBeCloseTo(12.5);
  });

  it('uses injected key state and elapsed time for deterministic panning', () => {
    const { controller, keys } = harness();
    controller.centerOnWorldPosition(30, 18);
    const before = controller.getState();

    keys.add('KeyD');
    controller.update(1_000, 250);
    keys.clear();

    expect(controller.getState().scrollX).toBeGreaterThan(before.scrollX + 40);
  });

  it('clamps zoom and middle-drag panning to the playable world', () => {
    const { controller } = harness();
    controller.centerOnWorldPosition(30, 18);
    controller.setZoom(Number.POSITIVE_INFINITY);
    expect(controller.getState().zoom).toBe(controller.maxZoom);

    const before = controller.getState();
    controller.panByMiddleDrag(80, -40);
    const after = controller.getState();
    expect(after.scrollX).toBeLessThan(before.scrollX);
    expect(after.scrollY).toBeGreaterThan(before.scrollY);

    controller.setZoom(0);
    expect(controller.getState().zoom).toBeGreaterThanOrEqual(controller.minimumBaseZoom);
  });
});
