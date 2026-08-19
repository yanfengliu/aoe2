// Capture the HUD with a production building selected — the panel state that
// exercises the training queue, progress bar, and the widest command deck.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'hud-building';
const seed = process.env.SEED ?? 'aoe2-prototype';
const buildingType = process.env.BUILDING ?? 'town-center';
const queueTicks = Number(process.env.TICKS ?? '25');

const outputPath = `docs/devlog/artifacts/2026-04-23-default-map-${label}.png`;
await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4173/?seed=${seed}`);
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  await page.waitForTimeout(800);

  const result = await page.evaluate(({ wanted, ticks }) => {
    const api = window.__AOE2_TEST__;
    const building = api.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === wanted,
    );
    if (!building) return { ok: false, reason: `no owner-1 ${wanted}` };
    if (!api.selectEntityAtCell(building.x, building.y)) {
      return { ok: false, reason: `nothing selectable at ${building.x},${building.y}` };
    }
    return { ok: true, at: `${building.x},${building.y}`, x: building.x, y: building.y };
  }, { wanted: buildingType, ticks: queueTicks });

  if (!result.ok) throw new Error(`Could not set up ${buildingType}: ${result.reason}`);
  console.log(`selected ${buildingType} at ${result.at}`);

  // Start a unit so the queue row and its progress bar are populated. The
  // command deck is DOM, so this goes through the real button rather than a
  // bridge call the test API does not expose.
  const trainButton = page.locator('.hud-command-button:not(:disabled)').first();
  if (await trainButton.count() > 0) {
    await trainButton.click();
    await page.evaluate((ticks) => {
      window.__AOE2_TEST__.advanceTicks(ticks);
    }, queueTicks);
    await page.evaluate(({ x, y }) => {
      window.__AOE2_TEST__.selectEntityAtCell(x, y);
    }, { x: result.x, y: result.y });
  }

  await page.waitForTimeout(600);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
