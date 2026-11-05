// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreeRenderRuntimeOptions } from 'voxel/three';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { worldToIso } from '../../src/rendering/isometricProjection';
import { AoeVoxelWorldRenderer } from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { voxelEntityHitRegions } from '../../src/rendering/voxel/aoeVoxelHitProxy';
import { FakeRuntime, terrain } from './helpers/fakeVoxelRuntime';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('AoeVoxelWorldRenderer', () => {
  it('freezes Voxel ambient animation time while simulation display time is paused', () => {
    const runtime = new FakeRuntime();
    const renderer = new AoeVoxelWorldRenderer({
      host: document.createElement('div'),
      width: 320,
      height: 200,
      createRuntime: () => runtime,
    });
    const camera = {
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 320,
      height: 200,
      viewX: 0,
      viewY: 0,
      viewWidth: 320,
      viewHeight: 200,
      viewCorners: [],
    };

    renderer.present([terrain()], 500);
    renderer.frame(camera, 16);
    renderer.frame(camera, 1_000);
    expect(runtime.frame.mock.calls.map(([context]) => context.nowMs)).toEqual([500, 500]);

    renderer.resetForBridgeSwap();
    renderer.present([terrain()], 150);
    renderer.frame(camera, 16);
    expect(runtime.frame.mock.calls.at(-1)?.[0].nowMs).toBe(500);
    renderer.present([terrain()], 175);
    renderer.frame(camera, 16);
    expect(runtime.frame.mock.calls.at(-1)?.[0].nowMs).toBe(525);
  });

  it('owns one world canvas and drives snapshot, camera, frame, reset, and teardown', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const runtime = new FakeRuntime();
    let runtimeOptions: ThreeRenderRuntimeOptions | undefined;
    const renderer = new AoeVoxelWorldRenderer({
      host,
      width: 800,
      height: 600,
      pixelRatio: 1,
      createRuntime: (options) => {
        runtimeOptions = options;
        return runtime;
      },
    });

    expect(host.querySelectorAll('.voxel-world-canvas')).toHaveLength(1);
    expect(runtimeOptions?.canvas).toBe(host.querySelector('.voxel-world-canvas'));
    expect(runtimeOptions?.rendererParameters).toMatchObject({
      alpha: true,
      antialias: true,
    });
    expect(runtimeOptions?.daylight).toEqual({
      skyColor: 0xcfe7f1,
      groundColor: 0x4a3826,
      fillIntensity: 1.45,
      sunColor: 0xffdfa3,
      sunIntensity: 2.65,
      sunOffset: { x: -22, y: 36, z: -18 },
    });
    expect(runtimeOptions?.rendererParameters).not.toHaveProperty('preserveDrawingBuffer');

    renderer.present([terrain()], 0);
    const firstEpoch = runtime.accepted[0]!.descriptor.epoch;
    renderer.frame({
      scrollX: -400,
      scrollY: -300,
      zoom: 1,
      width: 800,
      height: 600,
      viewX: -400,
      viewY: -300,
      viewWidth: 800,
      viewHeight: 600,
      viewCorners: [],
    }, 16);

    expect(runtime.setView).toHaveBeenCalledWith({ x: 0, y: 0, z: 0 }, 1);
    expect(runtime.frame).toHaveBeenCalledWith({ nowMs: 0, deltaMs: 16, frameIndex: 0 });

    renderer.resetForBridgeSwap();
    renderer.present([terrain()], 100);
    expect(runtime.accepted[1]!.descriptor.epoch).not.toBe(firstEpoch);
    expect(runtime.accepted[1]!.revision).toBe(1);

    renderer.dispose();
    renderer.dispose();
    expect(runtime.dispose).toHaveBeenCalledTimes(1);
    expect(host.querySelector('.voxel-world-canvas')).toBeNull();
  });

  it('captures the voxel world directly without a Canvas2D composite path', () => {
    const host = document.createElement('div');
    const runtime = new FakeRuntime();
    const renderer = new AoeVoxelWorldRenderer({
      host,
      width: 320,
      height: 200,
      createRuntime: () => runtime,
    });
    const capture = renderer.captureWorld();

    expect(capture).toMatchObject({
      dataUrl: 'data:image/png;base64,fake',
      width: 320,
      height: 200,
    });
    expect(runtime.capture).toHaveBeenCalledTimes(1);
    expect('captureComposite' in renderer).toBe(false);
  });

  it('only exposes hit data for the snapshot actually presented by a running context', () => {
    const host = document.createElement('div');
    const runtime = new FakeRuntime();
    const renderer = new AoeVoxelWorldRenderer({
      host,
      width: 320,
      height: 200,
      createRuntime: () => runtime,
    });
    const villager: ProjectedEntityView = {
      ...terrain(),
      id: 7,
      kind: 'unit',
      layer: 'unit',
      entityType: 'villager',
      owner: 1,
      x: 2,
      y: 3,
      size: 0.7,
      currentHp: 40,
      maxHp: 40,
    };
    const point = worldToIso(villager.x + 0.5, villager.y + 0.5);

    renderer.present([villager], 0);
    renderer.frame({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 320,
      height: 200,
      viewX: 0,
      viewY: 0,
      viewWidth: 320,
      viewHeight: 200,
      viewCorners: [],
    }, 0);
    expect(renderer.isInteractionReady()).toBe(true);
    expect(renderer.findPresentedEntitiesAtIsoPoint(point.x, point.y, 'selection')[0]?.id)
      .toBe(villager.id);

    runtime.state = 'lost';
    renderer.present([{ ...villager, x: 4 }], 100);
    renderer.frame({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 320,
      height: 200,
      viewX: 0,
      viewY: 0,
      viewWidth: 320,
      viewHeight: 200,
      viewCorners: [],
    }, 100);
    expect(renderer.isInteractionReady()).toBe(false);
    expect(renderer.findPresentedEntitiesAtIsoPoint(point.x, point.y, 'selection')).toEqual([]);

    runtime.state = 'running';
    renderer.frame({
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      width: 320,
      height: 200,
      viewX: 0,
      viewY: 0,
      viewWidth: 320,
      viewHeight: 200,
      viewCorners: [],
    }, 16);
    expect(renderer.isInteractionReady()).toBe(true);
  });
  // Work 142, review round 2: a double-click looks for the bodies this hands
  // back, so it must hand back the body as presented, a walking villager's
  // gait and facing included, and not the recipe's still pose.
  it('hands back the presented polygons of a walking villager, which its still pose does not share', () => {
    const runtime = new FakeRuntime();
    const renderer = new AoeVoxelWorldRenderer({
      host: document.createElement('div'),
      width: 320,
      height: 200,
      createRuntime: () => runtime,
    });
    const camera = {
      scrollX: 0, scrollY: 0, zoom: 1, width: 320, height: 200,
      viewX: 0, viewY: 0, viewWidth: 320, viewHeight: 200, viewCorners: [],
    };
    const villager: ProjectedEntityView = {
      ...terrain(), id: 7, kind: 'unit', layer: 'unit', entityType: 'villager',
      owner: 1, x: 2, y: 3, size: 0.7, currentHp: 40, maxHp: 40,
    };
    expect(renderer.presentedHitPolygons(new Set([7])).size).toBe(0);
    renderer.present([villager], 0);
    renderer.frame(camera, 0);
    const walking = { ...villager, x: 3 };
    renderer.present([walking], 400);
    renderer.frame(camera, 400);

    const presented = renderer.presentedHitPolygons(new Set([7, 99]));
    expect([...presented.keys()]).toEqual([7]);
    const polygons = presented.get(7)!;
    expect(polygons.length).toBeGreaterThan(0);
    expect(polygons).not.toEqual(voxelEntityHitRegions(walking).map(({ polygon }) => polygon));
    // They are the body a click sees there.
    for (const polygon of polygons) {
      const middle = {
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
      };
      expect(renderer.findPresentedEntitiesAtIsoPoint(middle.x, middle.y, 'selection').map((entity) => entity.id)).toContain(7);
    }
  });
});
