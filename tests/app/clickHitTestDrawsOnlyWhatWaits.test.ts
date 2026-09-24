// @vitest-environment jsdom

// GATE for "every click drew a full frame of the world before it hit-tested,
// even with the latest snapshot already on screen" (defect register
// 2026-09-24, the stacked-entity click-cycle spec that failed on CI). A click
// hit-tests against the hit state the renderer has PRESENTED, so a snapshot
// still waiting to be drawn must be drawn first. The view drew one every time
// instead, so every click and right-click cost a full render, and a burst of
// them on a slow renderer queued frames the player never saw ahead of the ones
// they were waiting for.
//
// BOUND: jsdom, with the renderer, camera, pointer, selection controller and
// presentation coordinator mocked, so it holds the view's rule — draw only
// what waits, and select nothing through a hit state that is still not
// ready — and nothing about real WebGL. The real renderer's side is
// `tests/browser/game-selection-click.spec.ts`, whose search reads the click
// stack at about 50 points and must draw at most one frame.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  frame: vi.fn(),
  select: vi.fn((..._args: unknown[]) => true),
  command: vi.fn((..._args: unknown[]) => true),
  stack: vi.fn((..._args: unknown[]) => [] as unknown[]),
  // What the renderer reports: `onScreen` when the hit state it would test is
  // the latest accepted snapshot, and whether drawing a frame gets it there
  // (a lost context does not).
  renderer: { onScreen: true, frameMakesReady: true },
  // Set by a test to mean "something changed since the last frame", which the
  // real coordinator answers by presenting a new snapshot.
  changed: false,
}));

vi.mock('../../src/rendering/voxel/AoeVoxelWorldRenderer', () => ({
  AoeVoxelWorldRenderer: class FakeAoeVoxelWorldRenderer {
    readonly canvas: HTMLCanvasElement;

    constructor(options: { host: HTMLElement }) {
      this.canvas = options.host.ownerDocument.createElement('canvas');
      options.host.append(this.canvas);
    }

    present(): void { fakes.renderer.onScreen = false; }
    frame(...args: unknown[]): void {
      fakes.frame(...args);
      if (fakes.renderer.frameMakesReady) fakes.renderer.onScreen = true;
    }
    isInteractionReady(): boolean { return fakes.renderer.onScreen; }
    resetForBridgeSwap(): void {}
    dispose(): void { this.canvas.remove(); }
  },
}));

vi.mock('../../src/input/voxelCameraController', () => ({
  createVoxelCameraController: () => ({
    initialZoom: 1,
    maxZoom: 2,
    minimumBaseZoom: 0.5,
    resize: vi.fn(),
    setZoom: vi.fn(),
    update: vi.fn(),
    resetEdgePanState: vi.fn(),
    screenToIso: () => ({ x: 0, y: 0 }),
    getState: () => ({
      scrollX: 0, scrollY: 0, zoom: 1, width: 800, height: 600,
      viewX: 0, viewY: 0, viewWidth: 800, viewHeight: 600, viewCorners: [],
    }),
  }),
}));

vi.mock('../../src/input/voxelSelectionController', () => ({
  createVoxelSelectionController: () => ({
    selectEntityAtWorldPosition: fakes.select,
    issueContextCommandAtWorldPosition: fakes.command,
    entitiesAtWorldPosition: fakes.stack,
    clearRecentSelectionClicks: vi.fn(),
  }),
}));

vi.mock('../../src/input/voxelPointerInputController', () => ({
  createVoxelPointerInputController: () => ({
    isDragSelecting: () => false,
    isMiddleDragging: () => false,
    getSelectionBoxState: () => null,
    getPointerState: () => ({ x: 0, y: 0, hasMoved: false, isDown: false }),
    reset: vi.fn(),
    dispose: vi.fn(),
  }),
}));

vi.mock('../../src/rendering/voxel/AoeVoxelPresentationCoordinator', () => ({
  createAoeVoxelPresentationCoordinator: (deps: {
    present: (entities: unknown[], displayTimeMs: number, overlays: unknown) => void;
  }) => ({
    syncFromBridge: (force = false) => {
      if (!force && !fakes.changed) return;
      fakes.changed = false;
      deps.present([], 0, {});
    },
    resetForBridgeSwap: vi.fn(),
    displayedEntities: () => [],
  }),
}));

import { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';

let host: HTMLElement;
let view: AoeVoxelGameView;

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  document.body.replaceChildren();
  host = document.createElement('div');
  document.body.append(host);
  fakes.renderer.onScreen = true;
  fakes.renderer.frameMakesReady = true;
  fakes.changed = false;
  view = new AoeVoxelGameView({
    host,
    bridge: {
      getMapSize: () => ({ width: 60, height: 36 }),
      step: vi.fn(),
      getHudState: () => ({ engineHalted: null }),
    } as unknown as SimulationBridge,
    pixelRatio: 1,
  });
  // Construction presents and draws the first frame; the cases start after it.
  fakes.frame.mockClear();
  fakes.select.mockClear();
  fakes.command.mockClear();
  fakes.stack.mockClear();
});

afterEach(() => {
  view.destroy();
  vi.restoreAllMocks();
});

describe('a click hit-tests what is on screen, and draws only a snapshot that is waiting', () => {
  it('draws nothing for a left click, a right click or a stack read when the latest snapshot is on screen', () => {
    expect(view.selectEntityAtWorldPosition(3.5, 4.5, 10, 20, 1_000)).toBe(true);
    expect(view.issueContextCommandAtWorldPosition(3.5, 4.5, 10, 20)).toBe(true);
    view.entitiesAtWorldPosition(3.5, 4.5);

    expect(fakes.frame).not.toHaveBeenCalled();
    expect(fakes.select).toHaveBeenCalledWith(3.5, 4.5, 10, 20, 1_000);
    expect(fakes.command).toHaveBeenCalledTimes(1);
    expect(fakes.stack).toHaveBeenCalledTimes(1);
  });

  it('draws the waiting snapshot once, then hit-tests it, when something changed since the last frame', () => {
    fakes.changed = true;
    expect(view.selectEntityAtWorldPosition(3.5, 4.5, 10, 20, 1_000)).toBe(true);
    expect(fakes.frame).toHaveBeenCalledTimes(1);
    expect(fakes.select).toHaveBeenCalledTimes(1);

    fakes.changed = true;
    expect(view.issueContextCommandAtWorldPosition(3.5, 4.5, 10, 20)).toBe(true);
    expect(fakes.frame).toHaveBeenCalledTimes(2);
    expect(fakes.command).toHaveBeenCalledTimes(1);
  });

  it('selects nothing and commands nothing when even a drawn frame leaves the hit state not ready', () => {
    fakes.renderer.frameMakesReady = false;
    fakes.changed = true;
    expect(view.selectEntityAtWorldPosition(3.5, 4.5, 10, 20, 1_000)).toBe(false);
    fakes.changed = true;
    expect(view.issueContextCommandAtWorldPosition(3.5, 4.5, 10, 20)).toBe(false);
    fakes.changed = true;
    expect(view.entitiesAtWorldPosition(3.5, 4.5)).toEqual([]);

    expect(fakes.frame).toHaveBeenCalledTimes(3);
    expect(fakes.select).not.toHaveBeenCalled();
    expect(fakes.command).not.toHaveBeenCalled();
    expect(fakes.stack).not.toHaveBeenCalled();
  });
});
