// Which shader the Natural ground draws with (src/rendering/voxel/aoeDeGroundTier.ts): one surface sample per pixel
// when the game's WebGL context names a CPU rasteriser, the full blend everywhere else, and a stored override that
// only a tier's own name sets.
//
// Bound: names and storage only. That a page on SwiftShader draws the single-sample tier, what each tier draws,
// and what it costs are the browser suite's: de-ground-frame-cost.spec.ts and de-ground-full-blend.spec.ts.
import { describe, expect, it } from 'vitest';

import {
  deGroundTierFor,
  DE_GROUND_TIER_STORAGE_KEY,
  isCpuRasteriser,
  readDeGroundTierOverride,
  webglRendererName,
  type RendererNamingContext,
} from '../../src/rendering/voxel/aoeDeGroundTier';

const UNMASKED_RENDERER_WEBGL = 0x9246;
const RENDERER = 0x1f01;

function context(names: { unmasked?: string | null; renderer?: unknown; throws?: boolean }): RendererNamingContext {
  return {
    RENDERER,
    getExtension: () => (names.unmasked === undefined ? null : { UNMASKED_RENDERER_WEBGL }),
    getParameter: (parameter: number) => {
      if (names.throws) throw new Error('context lost');
      if (parameter === UNMASKED_RENDERER_WEBGL) return names.unmasked;
      if (parameter === RENDERER) return names.renderer;
      return null;
    },
  };
}

describe('the Natural ground tier', () => {
  it('draws one sample per pixel on every CPU rasteriser a WebGL context names', () => {
    for (const name of [
      // Chromium on Windows and on CI's Linux runners, and the name older Chromium gave it.
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)',
      'Google SwiftShader',
      // Direct3D's WARP, Mesa's CPU drivers and Apple's.
      'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'ANGLE (Mesa, llvmpipe (LLVM 15.0.7 256 bits), OpenGL 4.5)',
      'softpipe',
      'lavapipe',
      'Apple Software Renderer',
    ]) {
      expect(isCpuRasteriser(name), name).toBe(true);
      expect(deGroundTierFor(name), name).toBe('single-sample');
    }
  });

  it('keeps the blend on a graphics card, and when the context names no renderer', () => {
    for (const name of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6800 XT (0x000073BF) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
      'Mesa Intel(R) Xe Graphics (TGL GT2)',
      'Apple GPU',
      'Adreno (TM) 640',
      'Mali-G78',
      'WebKit WebGL',
    ]) {
      expect(isCpuRasteriser(name), name).toBe(false);
      expect(deGroundTierFor(name), name).toBe('blend');
    }
    expect(deGroundTierFor(null)).toBe('blend');
  });

  it('reads the unmasked renderer name, falls back to RENDERER, and reads nothing from a lost or absent context', () => {
    expect(webglRendererName(context({ unmasked: 'SwiftShader driver', renderer: 'WebKit WebGL' }))).toBe('SwiftShader driver');
    expect(webglRendererName(context({ renderer: 'llvmpipe' }))).toBe('llvmpipe');
    expect(webglRendererName(context({ unmasked: null, renderer: 'x' }))).toBeNull();
    expect(webglRendererName(context({ unmasked: '' }))).toBeNull();
    expect(webglRendererName(context({ unmasked: 'SwiftShader driver', throws: true }))).toBeNull();
    expect(webglRendererName(null)).toBeNull();
    expect(webglRendererName(undefined)).toBeNull();
  });

  it('takes a stored tier as the override, and ignores anything else in storage or a storage that throws', () => {
    const storage = (value: string | null) => ({ getItem: (key: string) => (key === DE_GROUND_TIER_STORAGE_KEY ? value : null) });
    expect(DE_GROUND_TIER_STORAGE_KEY).toBe('aoe2:de-ground-tier');
    expect(readDeGroundTierOverride(storage('blend'))).toBe('blend');
    expect(readDeGroundTierOverride(storage('single-sample'))).toBe('single-sample');
    expect(readDeGroundTierOverride(storage(null))).toBeNull();
    expect(readDeGroundTierOverride(storage('fast'))).toBeNull();
    expect(readDeGroundTierOverride(storage('Blend'))).toBeNull();
    expect(readDeGroundTierOverride({ getItem: () => { throw new Error('storage disabled'); } })).toBeNull();
    expect(readDeGroundTierOverride(null)).toBeNull();
  });
});
