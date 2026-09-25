// @vitest-environment jsdom
//
// The Natural ground's tier comes from the renderer the game's own WebGL context names (aoeDeGroundTier.ts): the
// world renderer asks the context the runtime's renderer factory built, asks again when a lost context comes back
// (it can come back as SwiftShader), and lets a stored override win over what it finds.
//
// Bound: fake contexts naming renderers. That a real SwiftShader page draws the single-sample tier is
// tests/browser/de-ground-frame-cost.spec.ts's, and that the forced blend draws there is de-ground-full-blend's.

import type { MeshLambertMaterial, ToneMapping } from 'three';
import { Mesh } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ThreeRenderRuntimeOptions } from 'voxel/three';

import type { RendererNamingContext } from '../../src/rendering/voxel/aoeDeGroundTier';
import { AoeVoxelWorldRenderer, type ToneMappedRenderer } from '../../src/rendering/voxel/AoeVoxelWorldRenderer';
import { FakeRuntime } from './helpers/fakeVoxelRuntime';

const SWIFTSHADER = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)';
const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  document.body.replaceChildren();
});

function namingContext(named: { current: string | null }): RendererNamingContext {
  return {
    RENDERER: 0x1f01,
    getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
    getParameter: (parameter: number) => (parameter === 0x9246 ? named.current : null),
  };
}

function build(renderer: string | null, options: { getContext?: boolean } = {}) {
  const named = { current: renderer };
  let seen: ThreeRenderRuntimeOptions | null = null;
  const world = new AoeVoxelWorldRenderer({
    host: document.createElement('div'),
    width: 320,
    height: 200,
    artStyleId: 'de',
    createRuntime: (runtimeOptions) => { seen = runtimeOptions; return new FakeRuntime(); },
    createWebGLRenderer: (): ToneMappedRenderer => ({
      domElement: { width: 320, height: 200 },
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      getSize: (target) => target,
      getPixelRatio: () => 1,
      dispose: vi.fn(),
      toneMapping: -1 as ToneMapping,
      toneMappingExposure: -1,
      ...(options.getContext === false ? {} : { getContext: () => namingContext(named) }),
    }),
  });
  // A real ThreeRenderRuntime calls the factory once, while it is being constructed.
  seen!.rendererFactory!({});
  const material = (): MeshLambertMaterial => {
    const mesh = seen!.scene?.getObjectByName('aoe2-de-ground');
    if (!(mesh instanceof Mesh)) throw new Error('The runtime was not lent a scene holding aoe2-de-ground.');
    return mesh.material as MeshLambertMaterial;
  };
  return { world, named, material };
}

describe('AoeVoxelWorldRenderer ground tier', () => {
  it('draws one sample per pixel when the context names SwiftShader', () => {
    const { world, material } = build(SWIFTSHADER);
    expect(world.state().rasteriser).toBe(SWIFTSHADER);
    expect(world.state().groundTier).toBe('single-sample');
    expect(material().defines).toHaveProperty('DE_GROUND_SINGLE_SAMPLE');
    world.dispose();
  });

  it('keeps the blend on a graphics card, and on a renderer that names nothing', () => {
    const gpu = build(RTX);
    expect(gpu.world.state().groundTier).toBe('blend');
    expect(gpu.material().defines?.DE_GROUND_SINGLE_SAMPLE).toBeUndefined();
    gpu.world.dispose();
    const unnamed = build(null);
    expect(unnamed.world.state()).toMatchObject({ groundTier: 'blend', rasteriser: null });
    unnamed.world.dispose();
    const noContext = build(SWIFTSHADER, { getContext: false });
    expect(noContext.world.state()).toMatchObject({ groundTier: 'blend', rasteriser: null });
    noContext.world.dispose();
  });

  it('lets a stored tier win over the renderer, both ways', () => {
    window.localStorage.setItem('aoe2:de-ground-tier', 'blend');
    const forcedBlend = build(SWIFTSHADER);
    expect(forcedBlend.world.state()).toMatchObject({ groundTier: 'blend', rasteriser: SWIFTSHADER });
    forcedBlend.world.dispose();
    window.localStorage.setItem('aoe2:de-ground-tier', 'single-sample');
    const forcedSingle = build(RTX);
    expect(forcedSingle.world.state().groundTier).toBe('single-sample');
    forcedSingle.world.dispose();
  });

  it('asks again when a lost context is restored, which can come back as SwiftShader', () => {
    const { world, named } = build(RTX);
    expect(world.state().groundTier).toBe('blend');
    named.current = SWIFTSHADER;
    world.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(world.state()).toMatchObject({ groundTier: 'single-sample', rasteriser: SWIFTSHADER });
    world.dispose();
    // Disposed, it stops listening.
    named.current = RTX;
    world.canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(world.state()).toMatchObject({ groundTier: 'single-sample', rasteriser: SWIFTSHADER });
  });
});
