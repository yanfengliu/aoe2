// Which rasteriser the browser suite's Chromium draws WebGL with, and the launch
// arguments that choose it. playwright.config.ts is the only caller.
//
// WHY. From 002b7280 (2026-04-11) the config passed `--use-angle=swiftshader` on
// every platform, with no recorded reason, so every spec drew the game through
// SwiftShader — a CPU rasteriser — on a machine with an RTX 4090. Asked on the
// live game page (its own WebGL context, seed aoe2-prototype, 800x600,
// 2026-09-22): SwiftShader drew 14-15 frames a second, ANGLE on Direct3D 11
// drew 58-59 on the GPU. Removing the flag is NOT the fix: with no `--use-angle`
// at all, Playwright's headless shell still picks SwiftShader on its own (WebGL
// "unavailable_software"). The D3D11 backend has to be named.
//
// WHY ONLY WINDOWS GETS THE GPU. `d3d11` is ANGLE's Direct3D backend, and
// Direct3D exists only on Windows. GitHub's ubuntu runners have no GPU, and the
// CI browser job relies on SwiftShader for WebGL to exist at all
// (.github/workflows/ci.yml, "Install Chromium"). So off Windows this returns
// the argument the config always passed, and CI's command line is unchanged.
// A Windows machine with no GPU still gets working WebGL on the CPU: Direct3D
// falls back to WARP, or Chromium falls back to SwiftShader, which Playwright
// always permits with `--enable-unsafe-swiftshader`. That is where such a
// machine was before this change.
//
// BROWSER_RASTERISER=swiftshader forces the CPU path on any platform. Use it to
// reproduce CI's rendering locally, or to compare the two on one unchanged tree.
//
// The gate is tests/browser/suite-renders-on-the-gpu.spec.ts. It deliberately
// does NOT import this file: a check that asked this function whether the GPU
// was requested would skip rather than fail when this function regressed.

const FORCE_CPU = 'swiftshader';

export function rasteriserLaunchArgs(
  platform: NodeJS.Platform = process.platform,
  override: string | undefined = process.env.BROWSER_RASTERISER,
): string[] {
  if (override !== undefined && override !== '' && override !== FORCE_CPU) {
    throw new Error(
      `BROWSER_RASTERISER is "${override}", which the browser suite does not recognise. `
      + `Set it to "${FORCE_CPU}" to force the CPU rasteriser CI uses, or leave it unset `
      + 'to draw on the GPU on Windows (ANGLE Direct3D 11) and on SwiftShader elsewhere.',
    );
  }
  if (override === FORCE_CPU || platform !== 'win32') return ['--use-angle=swiftshader'];
  return ['--use-angle=d3d11'];
}
