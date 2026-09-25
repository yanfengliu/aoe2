// Which of its two shaders the Natural ground draws with (spec §14.5): the full blend of surfaces, or one surface
// sample per pixel when the WebGL renderer is a CPU rasteriser.
//
// WHY. SwiftShader, the CPU rasteriser CI's browser suite draws with, runs every branch of a shader and calls a
// routine for every texture read, and on the default map most known ground genuinely blends two surfaces. At
// 800x600 on four CPUs the blend cost 118-121 ms a frame against Moebius's 68-73, and one sample per pixel 67-77
// (docs/debugging/2026-09-24-de-ground-swiftshader-cost.md). With Natural the default in v0.3.233, CI's live
// frame doubled (233.3 ms against 116.6) and two frame-timed specs failed. On an RTX 4090 every arm took 2.2 to
// 2.7 ms, so a graphics card keeps the blend.
//
// DETECTED, NOT CONFIGURED. The tier comes from the renderer the game's own WebGL context names, never from a
// build flag or a URL: Chromium falls back to SwiftShader on its own when a GPU is blocklisted or its GPU process
// fails, and a player whose browser did that is the player who needs the cheap ground. A context that names no
// renderer keeps the blend.
//
// The one override is DE_GROUND_TIER_STORAGE_KEY in localStorage, read when the renderer is built. It exists so
// a browser spec can draw the blend on SwiftShader, which is what CI draws with: without it CI would never run
// the shader a player with a graphics card sees (tests/browser/de-ground-full-blend.spec.ts).

/** `blend`: the four nearest cells' surfaces blended, as a graphics card draws it. `single-sample`: each
 *  fragment's own cell's surface (or sand or dirt), from one read of the surface texture. */
export type DeGroundTier = 'blend' | 'single-sample';

export const DE_GROUND_TIERS: readonly DeGroundTier[] = ['blend', 'single-sample'];

export const DE_GROUND_TIER_STORAGE_KEY = 'aoe2:de-ground-tier';

// CPU rasterisers as WebGL names them: Chromium's SwiftShader ("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device
// (Subzero) (0x0000C0DE)), SwiftShader driver)"), Direct3D's WARP ("Microsoft Basic Render Driver"), Mesa's
// llvmpipe, softpipe and lavapipe, and Apple's software renderer.
const CPU_RASTERISER = /SwiftShader|llvmpipe|softpipe|lavapipe|Basic Render Driver|Apple Software Renderer/i;

/** Whether a WebGL renderer name is a CPU rasteriser's. */
export function isCpuRasteriser(renderer: string): boolean {
  return CPU_RASTERISER.test(renderer);
}

/** The tier a renderer draws the ground with. An unnamed renderer keeps the blend. */
export function deGroundTierFor(renderer: string | null): DeGroundTier {
  return renderer !== null && isCpuRasteriser(renderer) ? 'single-sample' : 'blend';
}

/** The part of a WebGL context that names its renderer. */
export interface RendererNamingContext {
  getExtension(name: 'WEBGL_debug_renderer_info'): { readonly UNMASKED_RENDERER_WEBGL: number } | null;
  getParameter(parameter: number): unknown;
  readonly RENDERER: number;
}

/** The renderer a WebGL context draws with: the unmasked name where the browser gives one, else RENDERER. Null
 *  when there is no context, it is lost, or the browser names nothing. */
export function webglRendererName(context: RendererNamingContext | null | undefined): string | null {
  if (!context) return null;
  try {
    const info = context.getExtension('WEBGL_debug_renderer_info');
    const name = context.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : context.RENDERER);
    return typeof name === 'string' && name !== '' ? name : null;
  } catch {
    return null;
  }
}

export interface DeGroundTierStorage {
  getItem(key: string): string | null;
}

function defaultStorage(): DeGroundTierStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** The stored override, or null to detect. Anything but a tier's name is ignored, and a storage that throws is
 *  read as no override: a question about looks must not stop the game from booting. */
export function readDeGroundTierOverride(storage = defaultStorage()): DeGroundTier | null {
  if (!storage) return null;
  try {
    const stored = storage.getItem(DE_GROUND_TIER_STORAGE_KEY);
    return DE_GROUND_TIERS.find((tier) => tier === stored) ?? null;
  } catch {
    return null;
  }
}
