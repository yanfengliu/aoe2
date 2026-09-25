// A paused boot that confirms its seed with one light read, for specs that boot a frame slow enough to outlast
// waitForPausedBootWithSeed's five-second poll of full snapshots: the Natural ground's blend forced onto SwiftShader,
// and the frame-cost gate's regression. It pauses from the test API's first moment as that helper does, and again
// once booted.
import { expect, type Page } from '@playwright/test';

export async function waitForLightPausedBoot(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, null, { timeout: 60_000 });
  expect(await page.evaluate(() => window.__AOE2_TEST__!.getHudState().seed), 'the scenario booted').toBe(seed);
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
}
