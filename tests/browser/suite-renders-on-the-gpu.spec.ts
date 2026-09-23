// GATE: on a Windows machine whose OS reports a display adapter on the PCI bus,
// the browser suite draws the game on THAT adapter, not on a CPU rasteriser
// (SwiftShader, or Direct3D's WARP).
//
// WHY. From 2026-04-11 to 2026-09-22 every spec drew through SwiftShader on a
// machine with an RTX 4090, because playwright.config.ts passed
// `--use-angle=swiftshader` on every platform. Nothing noticed for five months,
// because every spec passes on either rasteriser. Only a check that asks the
// running page which rasteriser it has can see the difference. The launch
// arguments now come from tests/browser/helpers/browserRasteriser.ts.
//
// THE WITNESS IS INDEPENDENT ON PURPOSE. "This machine has a GPU" comes from
// Windows' own adapter list, and "the page draws on it" comes from the game
// canvas's own WebGL context. Neither comes from the helper that picks the
// launch arguments. A check that asked the helper whether it requested the GPU
// would skip, not fail, when the helper regressed: that is code agreeing with
// itself. The browser cannot be the witness either. Under SwiftShader, Chromium
// lists only the SwiftShader device (CDP SystemInfo.getInfo, measured
// 2026-09-22), so a forced-CPU browser cannot say that a GPU exists.
//
// BOUND: what a green run does NOT prove.
//   * Windows only. Everywhere else the config draws on SwiftShader by design,
//     because GitHub's ubuntu runners have no GPU. This spec logs the renderer
//     there and SKIPS. It says nothing about CI.
//   * It also skips when Windows lists no PCI display adapter (other than
//     Microsoft's basic driver), and when BROWSER_RASTERISER=swiftshader asks
//     for the CPU on purpose.
//   * It checks ONE page at ONE point in the run. Chromium drops to SwiftShader
//     for the rest of a browser's life after repeated GPU-process crashes, and
//     a drop later in the run is not seen here.
//   * It proves which rasteriser draws, not how fast it is. The timings are in
//     the helper's header.
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

interface DisplayAdapter {
  readonly name: string;
  /** The PCI device id as four upper-case hex digits (e.g. `2684`), from PNPDeviceID. */
  readonly pciDeviceId: string | null;
}

/** Windows' own list of display adapters on the PCI bus. It is the witness that
 *  a GPU exists, and it does not depend on anything the launch arguments say. */
function windowsPciDisplayAdapters(): DisplayAdapter[] {
  let listing: string;
  try {
    listing = execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      'Get-CimInstance Win32_VideoController | ForEach-Object { "$($_.Name)|$($_.PNPDeviceID)" }',
    ], { encoding: 'utf8', timeout: 30_000, windowsHide: true });
  } catch (error) {
    throw new Error(
      'Could not list this machine\'s display adapters: powershell.exe running "Get-CimInstance '
      + `Win32_VideoController" failed (${(error as Error).message}). This gate needs that list as a `
      + 'witness that a GPU exists, independent of the suite\'s launch arguments.',
    );
  }
  const adapters: DisplayAdapter[] = [];
  for (const line of listing.split(/\r?\n/)) {
    const bar = line.lastIndexOf('|');
    if (bar < 0) continue;
    const name = line.slice(0, bar).trim();
    const pnpDeviceId = line.slice(bar + 1).trim();
    if (!/^PCI\\/i.test(pnpDeviceId) || /Microsoft Basic Display/i.test(name)) continue;
    adapters.push({ name, pciDeviceId: /DEV_([0-9A-F]{4})/i.exec(pnpDeviceId)?.[1]?.toUpperCase() ?? null });
  }
  return adapters;
}

/** ANGLE's Direct3D renderer string carries the adapter's name and its PCI device
 *  id, e.g. `ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 (0x00002684) Direct3D11 ...)`. */
function rendererNamesAdapter(renderer: string, adapter: DisplayAdapter): boolean {
  if (adapter.name.length > 0 && renderer.includes(adapter.name)) return true;
  return adapter.pciDeviceId !== null
    && renderer.toUpperCase().includes(`0X0000${adapter.pciDeviceId}`);
}

test.describe('browser suite rasteriser', () => {
  test('draws the game on the GPU Windows reports, not on a CPU rasteriser', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);

    // The game canvas's OWN context. getContext returns the one the renderer
    // already created, not a fresh one.
    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.voxel-world-canvas');
      const gl = canvas?.getContext('webgl2');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : null;
    });
    // Printed on every platform, so each run's log records what it drew with.
    console.log(`[rasteriser] the game page draws with: ${renderer ?? '(no answer)'}`);
    expect(
      renderer,
      'The game canvas (.voxel-world-canvas) should have a WebGL2 context whose '
      + 'WEBGL_debug_renderer_info names its renderer; it returned none.',
    ).not.toBeNull();

    test.skip(
      process.platform !== 'win32',
      `Off Windows the suite draws on SwiftShader by design (no GPU on CI's runners); drew with: ${renderer}`,
    );
    test.skip(
      process.env.BROWSER_RASTERISER === 'swiftshader',
      `BROWSER_RASTERISER=swiftshader asked for the CPU rasteriser; drew with: ${renderer}`,
    );
    const adapters = windowsPciDisplayAdapters();
    test.skip(
      adapters.length === 0,
      `Windows lists no PCI display adapter, so there is no GPU to draw on; drew with: ${renderer}`,
    );

    const listed = adapters
      .map((adapter) => `"${adapter.name}"${adapter.pciDeviceId ? ` (PCI device 0x${adapter.pciDeviceId})` : ''}`)
      .join(', ');
    expect(
      adapters.some((adapter) => rendererNamesAdapter(renderer!, adapter)),
      `The game page draws with "${renderer}", but Windows lists ${listed} on the PCI bus. The suite `
      + 'is rendering on a CPU rasteriser while a GPU sits idle. On Windows the launch arguments from '
      + 'rasteriserLaunchArgs() (tests/browser/helpers/browserRasteriser.ts, used by '
      + 'playwright.config.ts) must choose ANGLE\'s Direct3D 11 backend, `--use-angle=d3d11`. If they '
      + 'already do, Chromium refused the GPU on its own, and chrome://gpu in the same Playwright '
      + 'Chromium build shows why.',
    ).toBe(true);
  });
});
