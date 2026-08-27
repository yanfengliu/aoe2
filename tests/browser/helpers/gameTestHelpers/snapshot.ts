import { expect, type Page } from '@playwright/test';

import type {
  BrowserTestSnapshot,
} from '../../../../src/app/bootstrap/browserTestApi';

export async function getSnapshot(
  page: Page,
): Promise<BrowserTestSnapshot> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSnapshot());
}

export async function waitForBoot(page: Page): Promise<void> {
  await waitForBootWithSeed(page, 'aoe2-prototype');
}

// `civ` pins the human player's civilization via the real ?civ= param — needed
// since v0.3.138, when tech-tree denials made the default Britons unable to
// reach camels, eagles, hand cannoneers, or Parthian Tactics.
export async function waitForBootWithSeed(page: Page, seed: string, civ?: string): Promise<void> {
  await page.goto(`/?seed=${seed}${civ ? `&civ=${civ}` : ''}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect.poll(async () => (await getSnapshot(page)).hudState.seed).toBe(seed);
  await expect.poll(async () => {
    const snapshot = await getSnapshot(page);
    return snapshot.hudState.tick;
  }).toBeGreaterThan(0);
}

export async function waitForPausedBootWithSeed(page: Page, seed: string): Promise<void> {
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto(`/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect.poll(async () => (await getSnapshot(page)).hudState.seed).toBe(seed);
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
}
