import { expect, test, type Page } from '@playwright/test';

import { waitForLightPausedBoot } from './helpers/lightPausedBoot';

// GATE: on SwiftShader, the CPU rasteriser CI's browser suite draws with, the default view costs no more to draw in
// the Natural style than in Moebius.
//
// WHY. v0.3.233 made Natural the default after v0.3.232 gave it a textured ground. The ground blended four cells'
// surfaces in every fragment, and SwiftShader runs every branch of a shader and calls a routine for every texture
// read, so main's CI drew the live frame in 233.3 ms against Moebius's 116.6, every browser shard ran 50-60%
// longer and two frame-timed specs failed. The local suite draws on the GPU on Windows, where both styles cost
// 2.2-2.7 ms, so it saw none of it; v0.3.234 put Moebius back (docs/debugging/2026-09-24-de-ground-swiftshader-
// cost.md). The ground now draws one surface sample per pixel on a CPU rasteriser (aoeDeGroundTier.ts). This holds
// that, and anything else that makes the default frame dearer on SwiftShader in the Natural style.
//
// HOW. SwiftShader whatever the suite draws with (this file's launch arguments), the paused default view
// (aoe2-prototype at 800x600, the opening zoom), and both styles in ONE page, switched by the game menu's own row
// and alternated for ROUNDS rounds after one untimed switch each way, which builds both styles' programs. A frame's
// cost is the game's own animation-frame callback, waited on at both ends: every callback is wrapped, a one-pixel
// readPixels before it makes the page wait until the GPU process has caught up with this context, and one after it
// waits for everything the callback drew; a callback that drew no world frame is not counted. The first read syncs
// only this context's stream, not the compositor's, but SwiftShader works through both in one process, and adding it
// moved CI's reading of the single-sample tier from 0.92-0.98 of Moebius to 0.85-0.87 (the blend's from 1.92-1.97 to
// 2.12): work the two styles share stopped diluting the difference. (gl.finish() returns before SwiftShader
// has drawn, and the interval between animation frames does not measure a frame: the debugging record.) A round
// takes the lower quartile of FRAMES frames of each style after WARM frames, and the verdict is the median over
// rounds of Natural's quartile over Moebius's, so a burst of load on the machine moves a round, not the verdict. The
// HUD's frosted glass (backdrop-filter blur) is switched off first: the compositor redraws it every frame, and it
// held each frame to about 280 ms of wall time on four CPUs, most of this spec's run, while the timed callback draws
// none of it.
//
// BOUND. SwiftShader only; the GPU is not measured. One view: the paused opening frame at 800x600; more ground on
// screen, a moving world or a later game is not measured. Measured 2026-09-25: on CI (run 36100866192, four vCPUs)
// the single-sample ground drew at 0.85 to 0.87 of Moebius and the blend at 2.12, and this spec took about 12 s; on
// the development machine held to four CPUs by an affinity mask, 0.81 to 0.83 and 1.60 to 2.04; on its 32 threads,
// 0.59 to 0.61 and 0.97 to 1.40. SwiftShader spreads fragment work over every CPU, so on a machine with many a
// blend-sized regression can read under 1 and pass: this gate's teeth are on few CPUs, which is where CI runs it.

test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

const ROUNDS = 5;
const FRAMES = 8;
const WARM = 2;

type Style = 'moebius' | 'de';
const MENU_LABEL: Record<Style, string> = { moebius: 'Art style: Moebius', de: 'Art style: Natural' };

interface FrameCostProbe {
  measuring: boolean;
  costs: number[];
}

/** Wraps every animation-frame callback, before the game boots, so a world frame is timed on its own. */
async function installFrameCostProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const probe: FrameCostProbe = { measuring: false, costs: [] };
    (window as unknown as { __frameCostProbe: FrameCostProbe }).__frameCostProbe = probe;
    const request = window.requestAnimationFrame.bind(window);
    const pixel = new Uint8Array(4);
    window.requestAnimationFrame = (callback) => request((time) => {
      const canvas = probe.measuring ? document.querySelector<HTMLCanvasElement>('.voxel-world-canvas') : null;
      const gl = canvas?.getContext('webgl2');
      const api = window.__AOE2_TEST__;
      if (!gl || !api) {
        callback(time);
        return;
      }
      const drawnBefore = api.getWorldRendererState().framesDrawn;
      // The world canvas's own framebuffer is bound between frames, so neither read disturbs what Three binds.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const start = performance.now();
      callback(time);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const cost = performance.now() - start;
      if (api.getWorldRendererState().framesDrawn !== drawnBefore) probe.costs.push(cost);
    });
  });
}

/** The next `count` world frames' costs, in milliseconds. */
async function frameCosts(page: Page, count: number): Promise<number[]> {
  return page.evaluate(async (wanted) => {
    const probe = (window as unknown as { __frameCostProbe: FrameCostProbe }).__frameCostProbe;
    probe.costs = [];
    probe.measuring = true;
    const deadline = performance.now() + 60_000;
    while (probe.costs.length < wanted && performance.now() < deadline) {
      await new Promise((resolve) => { setTimeout(resolve, 20); });
    }
    probe.measuring = false;
    return probe.costs.slice(0, wanted);
  }, count);
}

/** Switches the style through the game menu's own art-style row. Its click handler is called directly rather than
 *  through a pointer: art-style-setting.spec.ts drives the real click, and here every Playwright action waits two
 *  frames for the page to settle, which on SwiftShader is seconds per switch. */
async function drawStyle(page: Page, style: Style): Promise<void> {
  const drawn = await page.evaluate((label) => {
    const row = document.querySelector<HTMLButtonElement>('[data-hud="menu-art-style-cycle"]')!;
    for (let clicks = 0; clicks < 2 && row.getAttribute('aria-label') !== label; clicks += 1) row.click();
    return { label: row.getAttribute('aria-label'), style: window.__AOE2_TEST__!.getWorldRendererState().artStyle };
  }, MENU_LABEL[style]);
  expect(drawn, `the menu row asked for ${style}`).toEqual({ label: MENU_LABEL[style], style });
}

/** Median luma of the world canvas at up to 200 visible cell centres: lit ground, or not. */
async function visibleGroundLuma(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const frame = api.getRenderState().frame!;
    const capture = api.captureWorldFrame();
    const image = new Image();
    image.src = capture.dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const rect = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
    const scale = image.width / rect.width;
    const lumas: number[] = [];
    for (const index of frame.visibleCells.slice(0, 200)) {
      const point = api.worldToScreen(index % frame.mapWidth, Math.floor(index / frame.mapWidth));
      const x = Math.round((point.x - rect.left) * scale);
      const y = Math.round((point.y - rect.top) * scale);
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const [r, g, b] = context.getImageData(x, y, 1, 1).data;
      lumas.push(0.2126 * r! + 0.7152 * g! + 0.0722 * b!);
    }
    lumas.sort((a, b) => a - b);
    return lumas[Math.floor(lumas.length / 2)] ?? 0;
  });
}

function lowerQuartile(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 4)]!;
}

test('draws the default view in the Natural style for no more than Moebius costs, on SwiftShader', async ({ page }) => {
  // Measured 2026-09-25: about 12 s on CI, 10 s on the development machine's 32 threads, and 21-41 s on four masked
  // CPUs of that busy machine.
  test.setTimeout(120_000);
  await installFrameCostProbe(page);
  // A frame as slow as the regression this gate exists for outlasts waitForPausedBootWithSeed's snapshot poll.
  await waitForLightPausedBoot(page, 'aoe2-prototype');
  await page.addStyleTag({ content: '* { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }' });
  const renderer = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().rasteriser);
  expect(renderer, 'the renderer the game canvas\'s WebGL context names').toMatch(/SwiftShader/);

  for (const style of ['de', 'moebius'] as const) {
    await drawStyle(page, style);
    expect((await frameCosts(page, 2)).length, `world frames drawn in ${style} before timing`).toBe(2);
  }
  const rounds: Array<{ moebius: number; de: number }> = [];
  let deTier = '';
  let deGround = '';
  for (let round = 0; round < ROUNDS; round += 1) {
    const cost = { moebius: 0, de: 0 };
    for (const style of ['moebius', 'de'] as const) {
      await drawStyle(page, style);
      await frameCosts(page, WARM);
      const costs = await frameCosts(page, FRAMES);
      expect(costs.length, `world frames timed in ${style}`).toBe(FRAMES);
      cost[style] = lowerQuartile(costs);
      if (style === 'de') {
        // Read after the timed frames: the runtime drops the voxel chunks when a frame presents the switched
        // snapshot, so a read right after the switch can still count Moebius's twelve.
        const state = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState());
        deTier = state.groundTier;
        deGround = `${state.ground}, ${String(state.metrics.chunks)} terrain chunks`;
      }
    }
    rounds.push(cost);
  }
  const ratios = rounds.map((round) => round.de / round.moebius).sort((a, b) => a - b);
  const verdict = ratios[Math.floor(ratios.length / 2)]!;
  const seen = rounds.map((round) => `${round.moebius.toFixed(1)}/${round.de.toFixed(1)}`).join(', ');
  console.log(`[frame cost] Natural over Moebius ${verdict.toFixed(3)} (Moebius/Natural lower-quartile ms per round: ${seen}; Natural ground tier ${deTier}; ${renderer})`);
  expect(
    verdict,
    `Natural's default frame costs ${verdict.toFixed(3)} of Moebius's on SwiftShader (median over rounds; `
      + `Moebius/Natural ms per round: ${seen}; the Natural ground drew with the ${deTier} tier). More than Moebius `
      + 'makes CI\'s browser suite slower with Natural the default: see this file\'s header.',
  ).toBeLessThanOrEqual(1);
  expect(deTier, 'the ground\'s tier on a CPU rasteriser, read from the renderer the page has').toBe('single-sample');
  // A Natural frame that drew no ground at all would be cheap too. The page is still in Natural here.
  expect(deGround, 'what drew the ground in the Natural rounds').toBe('textured, 0 terrain chunks');
  expect(await visibleGroundLuma(page), 'median luma of visible ground in the Natural style').toBeGreaterThan(40);
});
