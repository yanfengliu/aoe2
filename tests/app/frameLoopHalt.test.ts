// @vitest-environment jsdom

// GATE for "one throw inside a frame kills the game permanently and silently"
// (defect register 2026-09-06). `AoeVoxelGameView.frame()` put its own
// `window.requestAnimationFrame(this.frame)` LAST, so any throw above it — the
// bridge step, the camera, the renderer — stopped the loop from ever being
// rescheduled, while the HUD's separate loop kept drawing a live-looking match.
//
// WHAT THIS COVERS: ANY thrown value out of the frame body, not only the
// `tick_reentrancy` EngineError that was reported (that exact message is one
// case below, pinned so the reported instance cannot come back alone). Also the
// other silent stop of the same class: `HudState.engineHalted`, which the bridge
// has always set on an engine tick failure and which no UI code read.
//
// BOUND, and what a green run here does NOT prove. This is jsdom with the
// renderer, camera, pointer and presentation coordinator mocked and a
// hand-driven animation-frame queue, so it says nothing about real WebGL, real
// rAF scheduling or throttling, or whether the engine's re-entrancy guard is
// reachable from the page at all. It asserts the CONTRACT of the loop: a frame
// that throws leaves the loop scheduled or the game visibly halted, the
// simulation does not keep stepping afterwards, and a player-visible notice
// names the cause. The rendered-pixel half is captured evidence, not this test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({
  rendererFrame: vi.fn(),
  presentationSync: vi.fn(),
}));

vi.mock('../../src/rendering/voxel/AoeVoxelWorldRenderer', () => ({
  AoeVoxelWorldRenderer: class FakeAoeVoxelWorldRenderer {
    readonly canvas: HTMLCanvasElement;

    constructor(options: { host: HTMLElement }) {
      this.canvas = options.host.ownerDocument.createElement('canvas');
      options.host.append(this.canvas);
    }

    present(): void {}
    frame(...args: unknown[]): void { fakes.rendererFrame(...args); }
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
    getPointerState: () => ({ x: 0, y: 0, hasMoved: false, isDown: false }),
    reset: vi.fn(),
    dispose: vi.fn(),
  }),
}));

vi.mock('../../src/rendering/voxel/AoeVoxelPresentationCoordinator', () => ({
  createAoeVoxelPresentationCoordinator: () => ({
    syncFromBridge: (...args: unknown[]) => { fakes.presentationSync(...args); },
    resetForBridgeSwap: vi.fn(),
    displayedEntities: () => [],
  }),
}));

import { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';
import { mountEngineHaltSurface } from '../../src/app/bootstrap/engineHaltSurface';
import type { SimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import type { EngineHaltDetails } from '../../src/game/simulation/types';

const REENTRANCY_MESSAGE =
  'world.step()/stepWithResult() was called re-entrantly from within a tick '
  + '(a system, command handler, or diff listener stepped the world). '
  + 'Drive ticks only from outside the tick loop.';

let scheduled: FrameRequestCallback[] = [];
let host: HTMLElement;
let hudRoot: HTMLElement;
let step: ReturnType<typeof vi.fn>;
let engineHalted: EngineHaltDetails | null;
let view: AoeVoxelGameView;

function makeView(): AoeVoxelGameView {
  return new AoeVoxelGameView({
    host,
    bridge: {
      getMapSize: () => ({ width: 60, height: 36 }),
      step,
      getHudState: () => ({ engineHalted }),
    } as unknown as SimulationBridge,
    pixelRatio: 1,
  });
}

/** Runs the next scheduled animation frame. Fails loudly when the loop is not
 *  scheduled, which is exactly the defect: the unfixed tree throws out of HERE
 *  on the first failing frame and never reschedules. */
function driveFrame(timeMs: number): void {
  const next = scheduled.shift();
  if (!next) throw new Error('the frame loop is not scheduled');
  next(timeMs);
}

beforeEach(() => {
  vi.useFakeTimers();
  scheduled = [];
  engineHalted = null;
  fakes.rendererFrame.mockReset();
  fakes.presentationSync.mockReset();
  step = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let handle = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    scheduled.push(cb);
    handle += 1;
    return handle;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  document.body.replaceChildren();
  host = document.createElement('div');
  hudRoot = document.createElement('div');
  document.body.append(host, hudRoot);
  view = makeView();
});

afterEach(() => {
  view.destroy();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('a frame that throws', () => {
  it('leaves the animation frame loop scheduled', () => {
    step.mockImplementation(() => { throw new Error('step exploded'); });
    view.start();
    expect(scheduled).toHaveLength(1);

    driveFrame(16);

    expect(scheduled).toHaveLength(1);
  });

  it('leaves the animation frame loop scheduled for the reported re-entrancy error', () => {
    step.mockImplementation(() => { throw new Error(REENTRANCY_MESSAGE); });
    view.start();

    driveFrame(16);

    expect(scheduled).toHaveLength(1);
    expect(view.getFrameHalt()?.message).toContain('re-entrantly');
  });

  it('stops the simulation instead of stepping a world left part-way through a tick', () => {
    step.mockImplementation(() => { throw new Error('step exploded'); });
    view.start();
    driveFrame(16);
    expect(step).toHaveBeenCalledTimes(1);

    driveFrame(32);
    driveFrame(48);

    expect(step).toHaveBeenCalledTimes(1);
    // The camera and the renderer keep answering, so the stopped match is still
    // there to look at rather than a frozen or blank canvas.
    expect(fakes.rendererFrame.mock.calls.length).toBeGreaterThan(2);
  });

  it('does not report a halt while frames are healthy', () => {
    view.start();
    driveFrame(16);
    driveFrame(32);

    expect(view.getFrameHalt()).toBeNull();
    expect(step).toHaveBeenCalledTimes(2);
  });

  it('stops the loop deliberately when the draw path fails too', () => {
    step.mockImplementation(() => { throw new Error('step exploded'); });
    view.start();
    driveFrame(16);
    fakes.rendererFrame.mockImplementation(() => { throw new Error('renderer exploded'); });

    driveFrame(32);

    // Nothing left to keep the loop alive for — but the notice is already up,
    // so this is a deliberate stop rather than the silent one.
    expect(scheduled).toHaveLength(0);
  });

  it('survives a thrown value that is not an Error', () => {
    step.mockImplementation(() => { throw 'plain string failure'; });
    view.start();

    driveFrame(16);

    expect(scheduled).toHaveLength(1);
    expect(view.getFrameHalt()?.message).toBe('plain string failure');
  });
});

describe('what the player sees when the match stops', () => {
  function mount() {
    return mountEngineHaltSurface({
      hudRoot,
      view,
      getEngineHalted: () => engineHalted,
      onReload: vi.fn(),
      pollIntervalMs: 50,
    });
  }

  it('replaces a live-looking HUD with a notice naming the cause and an action', () => {
    const surface = mount();
    const notice = hudRoot.querySelector<HTMLElement>('[data-hud="engine-halt"]')!;
    expect(notice.hidden).toBe(true);

    step.mockImplementation(() => { throw new Error(REENTRANCY_MESSAGE); });
    view.start();
    driveFrame(16);

    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain('The game stopped');
    expect(notice.querySelector('[data-hud="engine-halt-cause"]')?.textContent)
      .toContain('re-entrantly');
    expect(notice.querySelector('[data-hud="engine-halt-reload"]')).not.toBeNull();
    surface.dispose();
  });

  it('tells the player about an engine tick failure the bridge caught for itself', () => {
    // The second silent stop of the same class: the bridge parks the failure on
    // HudState.engineHalted and keeps returning from step(), so before this the
    // HUD drew a live match over a dead world with nothing said.
    const surface = mount();
    const notice = hudRoot.querySelector<HTMLElement>('[data-hud="engine-halt"]')!;
    view.start();
    driveFrame(16);
    expect(notice.hidden).toBe(true);

    engineHalted = {
      tick: 29_297, phase: 'systems', code: 'system_threw',
      systemName: 'ai-economy', message: 'gather target vanished',
    };
    vi.advanceTimersByTime(60);

    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toContain('gather target vanished');
    expect(notice.textContent).toContain('29297');
    expect(notice.textContent).toContain('ai-economy');
    surface.dispose();
  });

  it('keeps the first cause on screen when a later failure follows', () => {
    const surface = mount();
    const notice = hudRoot.querySelector<HTMLElement>('[data-hud="engine-halt"]')!;
    step.mockImplementation(() => { throw new Error('the first cause'); });
    view.start();
    driveFrame(16);
    fakes.rendererFrame.mockImplementation(() => { throw new Error('a later cause'); });
    driveFrame(32);

    expect(notice.textContent).toContain('the first cause');
    expect(notice.textContent).not.toContain('a later cause');
    surface.dispose();
  });

  it('stops polling the bridge once disposed', () => {
    const surface = mount();
    const notice = hudRoot.querySelector<HTMLElement>('[data-hud="engine-halt"]')!;
    surface.dispose();
    engineHalted = {
      tick: 10, phase: 'systems', code: 'system_threw',
      systemName: null, message: 'after teardown',
    };
    vi.advanceTimersByTime(200);

    expect(notice.isConnected).toBe(false);
  });
});
