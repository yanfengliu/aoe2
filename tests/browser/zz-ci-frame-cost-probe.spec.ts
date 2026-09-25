import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// THROWAWAY CI PROBE (never merged): prints the frame-cost verdicts on CI's hardware, auto tier and forced blend.
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


async function verdicts(page: Page, label: string, count: number): Promise<void> {
  for (let run = 0; run < count; run += 1) {
    const rounds: number[] = [];
    const seen: string[] = [];
    let tier = '';
    for (let round = 0; round < ROUNDS; round += 1) {
      const cost = { moebius: 0, de: 0 };
      for (const style of ['moebius', 'de'] as const) {
        await drawStyle(page, style);
        if (style === 'de') tier = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().groundTier);
        await frameCosts(page, WARM);
        cost[style] = lowerQuartile(await frameCosts(page, FRAMES));
      }
      rounds.push(cost.de / cost.moebius);
      seen.push(`${cost.moebius.toFixed(1)}/${cost.de.toFixed(1)}`);
    }
    const sorted = [...rounds].sort((a, b) => a - b);
    console.log(`[ci probe] ${label} run ${run}: verdict ${sorted[Math.floor(sorted.length / 2)]!.toFixed(3)} tier ${tier} rounds ${seen.join(', ')}`);
  }
}

test('ci probe: frame cost verdicts', async ({ page, browser, baseURL }) => {
  test.setTimeout(900_000);
  const started = Date.now();
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  console.log('[ci probe] renderer', await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().rasteriser), 'boot ms', Date.now() - started);
  await verdicts(page, 'auto', 4);
  console.log('[ci probe] auto total ms', Date.now() - started);
  await page.close();
  const context = await browser.newContext({ baseURL, viewport: { width: 800, height: 600 } });
  const forced = await context.newPage();
  await forced.addInitScript(() => { window.localStorage.setItem('aoe2:de-ground-tier', 'blend'); });
  await game.waitForPausedBootWithSeed(forced, 'aoe2-prototype');
  await verdicts(forced, 'forced blend', 2);
  await context.close();
});
