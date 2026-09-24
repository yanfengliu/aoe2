// scripts/captureMapScreenshot.mjs draws a capture with the rasteriser RASTERISER names (swiftshader, the default
// and CI's, or gpu, ANGLE Direct3D 11 on Windows) and refuses a frame that another rasteriser drew. The renderer
// strings below are the ones the game canvas reported on this machine on 2026-09-24, one per rasteriser, plus the
// two CPU fallbacks Direct3D reports when a machine has no usable adapter.
//
// BOUND. These cases hold the rules in scripts/captureRasteriser.mjs: the launch arguments and the refusal. They do
// not launch Chromium, so they do not prove that the capture script calls the refusal, nor that Chromium honours
// the arguments. Both were checked by capturing with each value (`drawn by ...` in the script's output), and the
// last case here reads the script's source for the two calls.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAPTURE_RASTERISERS,
  captureRasteriserLaunch,
  refuseFrameFromOtherRasteriser,
} from '../../scripts/captureRasteriser.mjs';

const RTX_4090_D3D11 = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SWIFTSHADER = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
const WARP = 'ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';
const WARP_NAMED = 'ANGLE (Microsoft, WARP (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)';

describe('RASTERISER launch arguments', () => {
  it('draws on SwiftShader, as CI does, when RASTERISER is unset or empty', () => {
    expect(CAPTURE_RASTERISERS[0]).toBe('swiftshader');
    for (const unset of [undefined, '']) {
      expect(captureRasteriserLaunch(unset, 'win32')).toEqual({
        rasteriser: 'swiftshader', args: ['--use-angle=swiftshader'],
      });
      expect(captureRasteriserLaunch(unset, 'linux').args).toEqual(['--use-angle=swiftshader']);
    }
    expect(captureRasteriserLaunch('swiftshader', 'linux').args).toEqual(['--use-angle=swiftshader']);
  });

  it('draws on the graphics card through ANGLE Direct3D 11 when RASTERISER=gpu on Windows', () => {
    expect(captureRasteriserLaunch('gpu', 'win32')).toEqual({ rasteriser: 'gpu', args: ['--use-angle=d3d11'] });
  });

  it('refuses RASTERISER=gpu off Windows, naming the platform and the value that works there', () => {
    expect(() => captureRasteriserLaunch('gpu', 'linux')).toThrow(/exists only on Windows; this is linux.*RASTERISER=swiftshader/);
    expect(() => captureRasteriserLaunch('gpu', 'darwin')).toThrow(/this is darwin/);
  });

  it('refuses a value it does not know, naming it and both values it takes', () => {
    for (const wrong of ['GPU', 'd3d11', 'cpu', 'swiftshader ']) {
      expect(() => captureRasteriserLaunch(wrong, 'win32')).toThrow(
        new RegExp(`must be "swiftshader".*or "gpu".*got "${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      );
    }
  });
});

describe('a frame drawn by another rasteriser is refused', () => {
  it('accepts a GPU frame labelled gpu and a SwiftShader frame labelled swiftshader', () => {
    expect(() => refuseFrameFromOtherRasteriser('gpu', RTX_4090_D3D11)).not.toThrow();
    expect(() => refuseFrameFromOtherRasteriser('swiftshader', SWIFTSHADER)).not.toThrow();
  });

  it('refuses a gpu label on a frame Chromium or Direct3D drew on the CPU', () => {
    for (const cpu of [SWIFTSHADER, WARP, WARP_NAMED]) {
      expect(() => refuseFrameFromOtherRasteriser('gpu', cpu)).toThrow(/RASTERISER=gpu was asked for.*a CPU rasteriser/);
    }
  });

  it('refuses a swiftshader label on a frame anything but SwiftShader drew', () => {
    for (const other of [RTX_4090_D3D11, WARP]) {
      expect(() => refuseFrameFromOtherRasteriser('swiftshader', other)).toThrow(
        /RASTERISER=swiftshader was asked for.*did not honour --use-angle=swiftshader/,
      );
    }
  });

  it('refuses a frame whose renderer it cannot name, whatever was asked for', () => {
    for (const asked of ['gpu', 'swiftshader'] as const) {
      for (const unnamed of [undefined, '', '  ']) {
        expect(() => refuseFrameFromOtherRasteriser(asked, unnamed)).toThrow(/did not name its renderer/);
      }
    }
  });

  it('is what the capture script launches with and asks of every frame', () => {
    const script = readFileSync(
      fileURLToPath(new URL('../../scripts/captureMapScreenshot.mjs', import.meta.url)), 'utf8',
    );
    expect(script).toMatch(/captureRasteriserLaunch\(process\.env\.RASTERISER, process\.platform\)/);
    expect(script).toMatch(/args: launch\.args/);
    expect(script).toMatch(/refuseFrameFromOtherRasteriser\(launch\.rasteriser, drawnBy\)/);
    expect(script).not.toMatch(/--use-angle=/);
  });
});
