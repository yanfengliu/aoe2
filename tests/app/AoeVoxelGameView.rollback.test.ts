// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  rendererDisposed: vi.fn(),
  pointerDisposed: vi.fn(),
}));

vi.mock('../../src/rendering/voxel/AoeVoxelWorldRenderer', () => ({
  AoeVoxelWorldRenderer: class FakeAoeVoxelWorldRenderer {
    readonly canvas: HTMLCanvasElement;

    constructor(options: { host: HTMLElement }) {
      this.canvas = options.host.ownerDocument.createElement('canvas');
      options.host.append(this.canvas);
    }

    present(): void {}
    frame(): void {}
    dispose(): void {
      fakes.rendererDisposed();
      this.canvas.remove();
    }
  },
}));

vi.mock('../../src/input/voxelCameraController', () => ({
  createVoxelCameraController: () => ({
    initialZoom: 1,
    maxZoom: 2,
    minimumBaseZoom: 0.5,
    resize: vi.fn(),
    setZoom: vi.fn(),
    resetEdgePanState: vi.fn(),
    screenToIso: () => ({ x: 0, y: 0 }),
    getState: () => ({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 800,
      height: 600,
      viewX: 0,
      viewY: 0,
      viewWidth: 800,
      viewHeight: 600,
      viewCorners: [],
    }),
  }),
}));

vi.mock('../../src/input/voxelSelectionController', () => ({
  createVoxelSelectionController: () => ({
    selectEntityAtWorldPosition: vi.fn(),
    issueContextCommandAtWorldPosition: vi.fn(),
    clearRecentSelectionClicks: vi.fn(),
  }),
}));

vi.mock('../../src/input/voxelPointerInputController', () => ({
  createVoxelPointerInputController: () => ({
    isDragSelecting: () => false,
    isMiddleDragging: () => false,
    getSelectionBoxState: () => null,
    getSelectionBoxKey: () => 'none',
    getPointerState: () => ({ x: 0, y: 0, hasMoved: false, isDown: false }),
    reset: vi.fn(),
    dispose: fakes.pointerDisposed,
  }),
}));

vi.mock('../../src/rendering/voxel/AoeVoxelPresentationCoordinator', () => ({
  createAoeVoxelPresentationCoordinator: () => ({
    syncFromBridge: () => {
      throw new Error('snapshot acceptance failed');
    },
    resetForBridgeSwap: vi.fn(),
    displayedEntities: () => [],
  }),
}));

import { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

describe('AoeVoxelGameView constructor rollback', () => {
  beforeEach(() => {
    fakes.rendererDisposed.mockClear();
    fakes.pointerDisposed.mockClear();
    document.body.replaceChildren();
  });

  it('disposes the pointer, GPU host, canvas, and installed listeners when initial presentation fails', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const windowRemove = vi.spyOn(window, 'removeEventListener');
    const documentRemove = vi.spyOn(document, 'removeEventListener');

    expect(() => new AoeVoxelGameView({
      host,
      // The view asks the bridge how big the map is while it builds the camera.
      bridge: { getMapSize: () => ({ width: 60, height: 36 }) } as SimulationBridge,
      pixelRatio: 1,
    })).toThrow('snapshot acceptance failed');

    expect(fakes.pointerDisposed).toHaveBeenCalledOnce();
    expect(fakes.rendererDisposed).toHaveBeenCalledOnce();
    expect(host.querySelector('canvas')).toBeNull();
    expect(windowRemove).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
