// Which rasteriser draws a frame for scripts/captureMapScreenshot.mjs (RASTERISER=swiftshader|gpu), and the
// refusal of a frame that some other rasteriser drew.
//
// WHY. Every capture before 2026-09-24 was drawn by SwiftShader, Chromium's CPU rasteriser, because the script
// launched Chromium with `--use-angle=swiftshader`. That is what CI's browser suite draws with, so it stays the
// default. A player's frame is drawn by their graphics card, and the two can differ in more than speed: float
// precision, derivatives, texture filtering. A shader change is therefore looked at on both. `gpu` names ANGLE's
// Direct3D 11 backend, which exists only on Windows (the same choice tests/browser/helpers/browserRasteriser.ts
// makes for the browser suite). Measured on this machine, 2026-09-24: `gpu` is drawn by "ANGLE (NVIDIA, NVIDIA
// GeForce RTX 4090 (0x00002684) Direct3D11 vs_5_0 ps_5_0, D3D11)" and `swiftshader` by "ANGLE (Google, Vulkan 1.3.0
// (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)".
//
// WHY THE FRAME IS ASKED, NOT THE LAUNCH ARGUMENTS. Chromium falls back to SwiftShader on its own when its GPU
// process fails, and Direct3D falls back to WARP, a CPU rasteriser, on a machine with no usable adapter. A capture
// labelled `gpu` but drawn on the CPU would make the comparison this option exists for a comparison of one
// rasteriser with itself. So the script asks the game canvas's own WebGL context which renderer drew it, and
// refuses a mismatch. A renderer it cannot name is refused too, because it cannot be told apart from either.
//
// BOUND. The check reads the renderer string once, after boot. A GPU process that crashes between that read and
// the screenshot is not seen. Off Windows only `swiftshader` exists.

/** The values RASTERISER takes; the first is the default. */
export const CAPTURE_RASTERISERS = Object.freeze(['swiftshader', 'gpu']);

// ANGLE's CPU rasterisers, as they appear in UNMASKED_RENDERER_WEBGL: SwiftShader, Direct3D's WARP, and the
// "Microsoft Basic Render Driver" that WARP reports itself as.
const CPU_RENDERER = /SwiftShader|WARP|Basic Render/i;

/**
 * The Chromium launch arguments that make `rasteriser` draw the capture. Throws, naming the value it was given and
 * the values it takes, when RASTERISER is not one of them or names the GPU on a platform without Direct3D.
 * @param {string | undefined} rasteriser the RASTERISER environment variable; unset or empty means `swiftshader`
 * @param {string} platform `process.platform`
 * @returns {{ rasteriser: 'swiftshader' | 'gpu', args: string[] }}
 */
export function captureRasteriserLaunch(rasteriser, platform) {
  const chosen = rasteriser === undefined || rasteriser === '' ? 'swiftshader' : rasteriser;
  if (chosen === 'swiftshader') return { rasteriser: 'swiftshader', args: ['--use-angle=swiftshader'] };
  if (chosen !== 'gpu') {
    throw new Error(
      'RASTERISER selects what draws the capture and must be "swiftshader" (the CPU rasteriser CI uses, the '
      + `default) or "gpu" (ANGLE Direct3D 11, Windows only); got "${chosen}".`,
    );
  }
  if (platform !== 'win32') {
    throw new Error(
      `RASTERISER=gpu draws through ANGLE's Direct3D 11 backend, which exists only on Windows; this is ${platform}. `
      + 'Capture with RASTERISER=swiftshader (the default) here.',
    );
  }
  return { rasteriser: 'gpu', args: ['--use-angle=d3d11'] };
}

/**
 * Refuses a frame drawn by a rasteriser other than the one asked for. `renderer` is the game canvas's
 * UNMASKED_RENDERER_WEBGL, or undefined when the page could not report it.
 * @param {'swiftshader' | 'gpu'} rasteriser
 * @param {string | undefined} renderer
 */
export function refuseFrameFromOtherRasteriser(rasteriser, renderer) {
  if (renderer === undefined || renderer.trim() === '') {
    throw new Error(
      `RASTERISER=${rasteriser} was asked for, but the world canvas did not name its renderer `
      + '(no WebGL context on .voxel-world-canvas, or no WEBGL_debug_renderer_info), so the capture cannot show '
      + 'which rasteriser drew it. Capture a build whose world canvas is WebGL.',
    );
  }
  const drawnOnCpu = CPU_RENDERER.test(renderer);
  if (rasteriser === 'gpu' && drawnOnCpu) {
    throw new Error(
      `RASTERISER=gpu was asked for, but the world canvas is drawn by "${renderer}", a CPU rasteriser: Chromium or `
      + 'Direct3D fell back from the graphics card. Check that this machine has a working GPU driver, or capture '
      + 'with RASTERISER=swiftshader.',
    );
  }
  if (rasteriser === 'swiftshader' && !/SwiftShader/i.test(renderer)) {
    throw new Error(
      `RASTERISER=swiftshader was asked for, but the world canvas is drawn by "${renderer}": Chromium did not honour `
      + '--use-angle=swiftshader, so this frame is not the CPU frame CI draws.',
    );
  }
}
