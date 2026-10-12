import { expect, type Page } from '@playwright/test';

import type {
  BrowserTestSnapshot,
} from '../../../../src/app/bootstrap/browserTestApi';

export async function getSnapshot(
  page: Page,
): Promise<BrowserTestSnapshot> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSnapshot());
}

// The boot waits poll the HUD state alone. A full snapshot carries the render
// state of every entity, the 2,160 terrain tiles included, and one round trip
// of it cost 0.7-0.9 s on CI's SwiftShader runners (work 123), where these
// polls run before almost every spec. The HUD state is the same bridge read.
async function hudSeedAndTick(page: Page): Promise<{ seed: string; tick: number }> {
  return page.evaluate(() => {
    const hud = window.__AOE2_TEST__!.getHudState();
    return { seed: hud.seed, tick: hud.tick };
  });
}

/** The selection state alone, the same bridge read a full snapshot carries. */
export async function getSelectionState(page: Page): Promise<BrowserTestSnapshot['selectionState']> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSelectionState());
}

/** The HUD state alone. */
export async function getHudState(page: Page): Promise<BrowserTestSnapshot['hudState']> {
  return page.evaluate(() => window.__AOE2_TEST__!.getHudState());
}

/** The economy state alone. */
export async function getEconomyState(page: Page): Promise<BrowserTestSnapshot['economyState']> {
  return page.evaluate(() => window.__AOE2_TEST__!.getEconomyState());
}

/** The camera state alone. */
export async function getCameraState(page: Page): Promise<BrowserTestSnapshot['cameraState']> {
  return page.evaluate(() => window.__AOE2_TEST__!.getCameraState());
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
  await expect.poll(async () => (await hudSeedAndTick(page)).seed).toBe(seed);
  await expect.poll(async () => (await hudSeedAndTick(page)).tick).toBeGreaterThan(0);
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
  await expect.poll(async () => (await hudSeedAndTick(page)).seed).toBe(seed);
  await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
}

/**
 * Advances until `owner` has a COMPLETE building of this type, in chunks, and
 * returns the snapshot that first saw it.
 *
 * Prefer this over `advanceTicks(<a number someone measured once>)` around a
 * construction. A fixed count silently encodes today's build time and the
 * walk that precedes it: when DE build times landed on 2026-09-02 (Barracks
 * 240 -> 500 ticks, Watch Tower 220 -> 800, Town Center 300 -> 1500) three
 * browser specs failed at once, each on a number that had been right when it
 * was written. Waiting on the CONDITION says what the test means.
 *
 * Pass `at` whenever the fixture ALREADY has a complete building of this type
 * — a second Town Center is the case that caught this — or the wait is
 * satisfied by the one that was there at boot and returns instantly.
 */
export async function advanceUntilBuildingComplete(
  page: Page,
  owner: number,
  buildingType: string,
  maxTicks = 4_000,
  at?: { x: number; y: number },
): Promise<BrowserTestSnapshot> {
  const chunk = 250;
  let snapshot = await getSnapshot(page);
  for (let advanced = 0; advanced < maxTicks; advanced += chunk) {
    const done = snapshot.economyState.buildings.some(
      (building) => building.owner === owner
        && building.buildingType === buildingType
        && building.isComplete
        && (at === undefined || (building.x === at.x && building.y === at.y)),
    );
    if (done) return snapshot;
    snapshot = await page.evaluate(
      ([ticks, ms]) => window.__AOE2_TEST__!.advanceTicks(ticks, ms),
      [chunk, 100] as const,
    );
  }
  const where = at === undefined ? '' : ` at (${String(at.x)},${String(at.y)})`;
  throw new Error(
    `no complete ${buildingType} for owner ${String(owner)}${where} after ${String(maxTicks)} ticks`,
  );
}
