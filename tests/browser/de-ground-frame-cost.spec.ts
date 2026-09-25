import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

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
// (aoe2-prototype at 800x600, the opening zoom), and both styles in ONE page, switched through the game menu's row,
// alternating for ROUNDS rounds. A frame's cost is the time from the animation frame's start to a one-pixel
// readPixels returning in a callback queued after the game's own, which waits for every draw of the frame (the
// debugging record's method: gl.finish() returns before SwiftShader has drawn, and the interval between animation
// frames holds near a millisecond whatever a frame costs, because the GPU process pipelines frames). A round takes
// the lower quartile of FRAMES frames of each style after WARM frames, and the verdict is the median over rounds of
// Natural's quartile over Moebius's, so a burst of load on the machine moves a round rather than the verdict.
//
// BOUND. SwiftShader only; the GPU is not measured. One view: the paused opening frame at 800x600; a view with more
// ground on screen, a moving world or a later game is not measured. Measured on 2026-09-25 on the development
// machine with SwiftShader's Subzero backend (CI's Linux Chromium uses its LLVM backend): on four CPUs, CI's count,
// reproduced with an affinity mask, the single-sample ground drew at 0.87-0.89 of Moebius and the full blend at
// 1.81; on all 32 threads 0.75 and 1.09, because SwiftShader spreads fragment work over every CPU and the ground's
// share of the frame shrinks. So a regression that costs less than about 1.1 times Moebius on 32 threads passes
// here while costing more on CI's four CPUs; the margin is widest where CI runs.

test.use({ launchOptions: { args: ['--use-angle=swiftshader'] } });

const ROUNDS = 6;
const FRAMES = 10;
const WARM = 4;

type Style = 'moebius' | 'de';
const MENU_LABEL: Record<Style, string> = { moebius: 'Art style: Moebius', de: 'Art style: Natural' };

async function drawStyle(page: Page, style: Style): Promise<void> {
  await page.keyboard.press('Escape');
  const row = page.locator('[data-hud="menu-art-style-cycle"]');
  for (let clicks = 0; clicks < 2 && (await row.getAttribute('aria-label')) !== MENU_LABEL[style]; clicks += 1) {
    await row.click();
  }
  await expect(row).toHaveAccessibleName(MENU_LABEL[style]);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
  const drawn = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().artStyle);
  expect(drawn, `the menu row asked for ${style}`).toBe(style);
}

/** Each frame's cost, in milliseconds: animation frame start to a one-pixel read that waits for its draws. */
async function frameCosts(page: Page, count: number): Promise<number[]> {
  return page.evaluate(async (frames) => {
    const canvas = document.querySelector<HTMLCanvasElement>('.voxel-world-canvas')!;
    const gl = canvas.getContext('webgl2')!;
    const pixel = new Uint8Array(4);
    const costs: number[] = [];
    for (let index = 0; index < frames; index += 1) {
      costs.push(await new Promise<number>((resolve) => {
        requestAnimationFrame((frameStart) => {
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          resolve(performance.now() - frameStart);
        });
      }));
    }
    return costs;
  }, count);
}

function lowerQuartile(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 4)]!;
}

test('draws the default view in the Natural style for no more than Moebius costs, on SwiftShader', async ({ page }) => {
  // Measured 2026-09-25: 14 s on the development machine's four masked CPUs; CI's frames are slower.
  test.setTimeout(120_000);
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  const renderer = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().rasteriser);
  expect(renderer, 'the renderer the game canvas\'s WebGL context names').toMatch(/SwiftShader/);

  const rounds: Array<{ moebius: number; de: number; ratio: number }> = [];
  let deTier = '';
  for (let round = 0; round < ROUNDS; round += 1) {
    const cost = { moebius: 0, de: 0 };
    for (const style of ['moebius', 'de'] as const) {
      await drawStyle(page, style);
      if (style === 'de') deTier = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().groundTier);
      await frameCosts(page, WARM);
      cost[style] = lowerQuartile(await frameCosts(page, FRAMES));
    }
    rounds.push({ ...cost, ratio: cost.de / cost.moebius });
  }
  const ratios = rounds.map((round) => round.ratio).sort((a, b) => a - b);
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
});
