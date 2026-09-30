// @vitest-environment jsdom
// Real createApp, game view, presentation coordinator and voxel adapter/renderer.
// Only the GPU runtime and unrelated HUD/audio surfaces are replaced.
import 'fake-indexeddb/auto';
import { RenderWorld } from 'voxel/core';
import type { DataTexture } from 'three';
import { AoeDeGround } from '../../src/rendering/voxel/aoeDeGround';
import type { DeGroundData } from '../../src/rendering/voxel/aoeDeGroundData';
import { AoeVoxelAdapter } from '../../src/rendering/voxel/aoeVoxelAdapter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReplayBridgeCell, ReplayController, ReplayControllerConfig } from '../../src/game/replay/ReplayController';
import type { ReplayBridge } from '../../src/game/simulation/replay/makeReplayBridge';
import type { AoeVoxelWorldRendererOptions } from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { FakeRuntime } from '../rendering/helpers/fakeVoxelRuntime';
import { recordCommandReplayFixture } from '../replay/replayCommandHelpers';

const state = vi.hoisted(() => ({
  runtime: null as unknown as FakeRuntime,
  controller: null as unknown as ReplayController,
  cell: null as unknown as ReplayBridgeCell,
  bridges: [] as ReplayBridge[],
  resizeIncoming: false,
}));
vi.mock('../../src/rendering/voxel/AoeVoxelWorldRenderer', async (load) => {
  const actual = await load<typeof import('../../src/rendering/voxel/AoeVoxelWorldRenderer')>();
  return { ...actual, AoeVoxelWorldRenderer: class extends actual.AoeVoxelWorldRenderer {
    constructor(options: AoeVoxelWorldRendererOptions) {
      super({ ...options, createRuntime: () => state.runtime });
    }
  } };
});
vi.mock('../../src/game/replay/ReplayController', async (load) => {
  const actual = await load<typeof import('../../src/game/replay/ReplayController')>();
  const { makeReplayBridge } = await import('../../src/game/simulation/replay/makeReplayBridge');
  return { ...actual, createReplayController(config: ReplayControllerConfig) {
    state.cell = config.bridgeCell;
    state.controller = actual.createReplayController({ ...config, makeReplayBridge(world, options) {
      const bridge = makeReplayBridge(world, options);
      if (state.resizeIncoming) {
        const render = bridge.getRenderState.bind(bridge);
        vi.spyOn(bridge, 'getRenderState').mockImplementation(() => {
          const current = render();
          if (!current.frame) throw new Error('Expected a projected frame for the resize control.');
          return { ...current, frame: { ...current.frame, mapWidth: current.frame.mapWidth + 1 } };
        });
      }
      vi.spyOn(bridge, 'disposeReplayRenderAdapter');
      state.bridges.push(bridge);
      return bridge;
    } });
    return state.controller;
  } };
});
vi.mock('../../src/ui/hud/createHudController', () => ({ createHudController: () => ({
  toastHandle: { showToast: vi.fn() }, destroy: vi.fn(),
  isGameMenuOpen: () => false, closeGameMenu: vi.fn(), toggleGameMenu: vi.fn(),
}) }));
vi.mock('../../src/audio/mountGameAudio', () => ({ WORLD_LOADED_EVENT: 'world-loaded', mountGameAudio: () => ({
  dispose: vi.fn(), getLastHomeAttackPosition: () => null,
}) }));

import { createApp } from '../../src/app/bootstrap/createApp';
import type { AoeVoxelGameView } from '../../src/app/AoeVoxelGameView';

let view: AoeVoxelGameView | null = null;
beforeEach(() => {
  document.body.innerHTML = '<div id="game-root"></div><div id="hud-root"></div>';
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  state.runtime = new FakeRuntime();
  state.bridges = [];
  state.resizeIncoming = false;
});
afterEach(async () => {
  state.controller?.exitReplay();
  view?.destroy();
  view = null;
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('real app replay presentation replacement', () => {
  it('restores the committed app/view after actual snapshot validation rejects a partially prepared adapter', async () => {
    const { bundle } = recordCommandReplayFixture();
    const renderWorld = new RenderWorld();
    state.runtime.acceptSnapshot.mockImplementation((snapshot) => {
      const result = renderWorld.acceptSnapshot(snapshot);
      if (result.status === 'accepted') state.runtime.accepted.push(snapshot);
      return result;
    });
    state.runtime.dispose.mockImplementation(() => renderWorld.dispose());
    view = await createApp();
    const committed = state.cell.current();
    const displayed = view.getDisplayedEntities();
    const snapshot = state.runtime.accepted.at(-1)!;
    const create = AoeVoxelAdapter.prototype.createSnapshot;
    vi.spyOn(AoeVoxelAdapter.prototype, 'createSnapshot').mockImplementationOnce(function (this: AoeVoxelAdapter, ...args) {
      return { ...create.apply(this, args), revision: -1 };
    });
    expect(() => state.controller.enterReplay(bundle)).toThrow('Voxel snapshot rejected');
    expect(state.cell.current()).toBe(committed);
    expect(view.getDisplayedEntities()).toEqual(displayed);
    expect(renderWorld.epoch).toBe(snapshot.descriptor.epoch);
    expect(renderWorld.acceptedRevision).toBe(snapshot.revision);
    expect(() => view!.syncFromBridge()).not.toThrow();
    expect(state.bridges.at(-1)!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
  });

  it.each(['same-size', 'resized'] as const)('rolls back %s Natural ground bytes/resources after an accepted incoming snapshot fails updating ground', async (size) => {
    const { bundle } = recordCommandReplayFixture();
    const renderWorld = new RenderWorld();
    state.runtime.acceptSnapshot.mockImplementation((snapshot) => {
      const result = renderWorld.acceptSnapshot(snapshot);
      if (result.status === 'accepted') state.runtime.accepted.push(snapshot);
      return result;
    });
    state.runtime.dispose.mockImplementation(() => renderWorld.dispose());
    const grounds: AoeDeGround[] = [];
    const update = AoeDeGround.prototype.update;
    const updateSpy = vi.spyOn(AoeDeGround.prototype, 'update').mockImplementation(function (this: AoeDeGround, data: DeGroundData) {
      grounds.push(this);
      update.call(this, data);
    });
    view = await createApp();
    expect(view.artStyleId()).toBe('de');
    expect(grounds).toHaveLength(1);
    const ground = grounds[0]!;
    const committed = state.cell.current();
    const displayed = view.getDisplayedEntities();
    const snapshot = state.runtime.accepted.at(-1)!;
    const uniforms = ground.mesh.material.userData.deGroundUniforms;
    const cells = uniforms.deCells.value as DataTexture;
    const fields = uniforms.deFields.value as DataTexture;
    const cellBytes = new Uint8Array(cells.image.data as Uint8Array);
    const fieldBytes = new Uint8Array(fields.image.data as Uint8Array);
    const geometry = ground.mesh.geometry;
    const geometryDisposed = vi.spyOn(geometry, 'dispose');
    const cellsDisposed = vi.spyOn(cells, 'dispose');
    const fieldsDisposed = vi.spyOn(fields, 'dispose');
    const canvas = document.querySelector('.voxel-world-canvas')!;
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, button: 0, buttons: 1 }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 70, clientY: 70, buttons: 1 }));
    const selectionBox = view.getSelectionBoxState();
    expect(selectionBox).not.toBeNull();
    state.resizeIncoming = size === 'resized';
    let rejectedGroundCells!: DataTexture;
    let rejectedGeometry = geometry;
    let rejectedCellsDisposed = cellsDisposed;
    let rejectedGeometryDisposed = geometryDisposed;
    updateSpy.mockImplementationOnce(function (this: AoeDeGround, data: DeGroundData) {
      update.call(this, data);
      expect(data.width !== cells.image.width).toBe(size === 'resized');
      expect(Array.from(data.cells)).not.toEqual(Array.from(cellBytes));
      rejectedGroundCells = uniforms.deCells.value;
      rejectedGeometry = this.mesh.geometry;
      if (size === 'resized') {
        rejectedCellsDisposed = vi.spyOn(rejectedGroundCells, 'dispose');
        rejectedGeometryDisposed = vi.spyOn(rejectedGeometry, 'dispose');
      }
      throw new Error('post-accept ground update failed');
    });
    expect(() => state.controller.enterReplay(bundle)).toThrow('post-accept ground update failed');
    expect(state.cell.current()).toBe(committed);
    expect(renderWorld.epoch).toBe(snapshot.descriptor.epoch);
    expect(renderWorld.acceptedRevision).toBe(snapshot.revision);
    expect(view.getDisplayedEntities()).toEqual(displayed);
    expect(view.getSelectionBoxState()).toEqual(selectionBox);
    expect(uniforms.deCells.value).toBe(cells);
    expect(uniforms.deFields.value).toBe(fields);
    expect(ground.mesh.geometry).toBe(geometry);
    expect(Array.from(cells.image.data as Uint8Array)).toEqual(Array.from(cellBytes));
    expect(Array.from(fields.image.data as Uint8Array)).toEqual(Array.from(fieldBytes));
    expect(geometryDisposed).not.toHaveBeenCalled();
    expect(cellsDisposed).not.toHaveBeenCalled();
    expect(fieldsDisposed).not.toHaveBeenCalled();
    if (size === 'resized') {
      expect(rejectedCellsDisposed).toHaveBeenCalledTimes(1);
      expect(rejectedGeometryDisposed).toHaveBeenCalledTimes(1);
    }
    state.resizeIncoming = false;
    state.controller.enterReplay(bundle);
    expect(view.getSelectionBoxState()).toBeNull();
    state.controller.exitReplay();
    expect(state.cell.current()).toBe(committed);
  });

  it.each(['entry', 'scrub', 'replacement', 'exit'] as const)('keeps the committed app/view owner after a renderer rejects %s', async (operation) => {
    const { bundle } = recordCommandReplayFixture();
    view = await createApp();
    const live = state.cell.current();
    if (operation !== 'entry') state.controller.enterReplay(bundle);
    const committed = state.cell.current();
    const committedReplay = state.bridges.at(-1);
    const displayed = view.getDisplayedEntities();
    const camera = view.getCameraState();
    const accepted = state.runtime.accepted.at(-1);
    const artStyle = view.artStyleId();
    state.runtime.acceptSnapshot.mockImplementationOnce(() => ({
      status: 'rejected', code: 'test-rejection', path: 'snapshot', message: 'incoming frame rejected',
    }));
    expect(() => operation === 'scrub'
      ? state.controller.scrubTo(bundle.metadata.endTick)
      : operation === 'exit' ? state.controller.exitReplay()
        : state.controller.enterReplay(bundle, bundle.metadata.endTick)).toThrow('Voxel snapshot rejected');
    expect(state.cell.current()).toBe(committed);
    expect(view.getDisplayedEntities()).toEqual(displayed);
    expect(view.getCameraState()).toEqual(camera);
    expect(view.artStyleId()).toBe(artStyle);
    expect(state.runtime.accepted.at(-1)).toBe(accepted);
    if (operation !== 'exit') expect(state.bridges.at(-1)!.disposeReplayRenderAdapter).toHaveBeenCalledTimes(1);
    if (operation !== 'entry') expect(committedReplay!.disposeReplayRenderAdapter).not.toHaveBeenCalled();
    expect(() => view!.syncFromBridge()).not.toThrow();
    expect(state.runtime.accepted.at(-1)).toBe(accepted);
    state.controller.enterReplay(bundle, bundle.metadata.endTick);
    expect(state.cell.current()).not.toBe(committed);
    state.controller.exitReplay();
    expect(state.cell.current()).toBe(live);
    expect(() => view!.syncFromBridge()).not.toThrow();
  });
});
