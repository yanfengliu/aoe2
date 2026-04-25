import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'screenshot';
const outputPath = `docs/devlog/artifacts/2026-04-24-sheep-selection-${label}.png`;

await mkdir(dirname(outputPath), { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({
    viewport: { width: 800, height: 600 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/?seed=sheep-movement-fixture');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, {
    timeout: 60_000,
  });
  await page.waitForTimeout(500);

  // Advance simulation ticks so the human villager at (20, 18) claims the
  // adjacent unclaimed sheep at (19, 18), (19, 19), and (20, 19). At least
  // 2 sheep need to belong to the human player before we can demonstrate
  // the multi-icon grid. Throw on budget exhaustion so the screenshot
  // never silently captures a single-villager state and still gets saved.
  const claimedSheep = await page.evaluate(() => {
    const api = window.__AOE2_TEST__;
    if (!api) {
      return 0;
    }
    let claimed = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      api.advanceTicks(1, 100);
      claimed = api.getSnapshot().economyState.resources.filter(
        (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
      ).length;
      if (claimed >= 2) {
        return claimed;
      }
    }
    return claimed;
  });
  if (claimedSheep < 2) {
    throw new Error(
      `expected human player to own >=2 sheep before capture, got ${claimedSheep} after 60 ticks`,
    );
  }

  // Drive multi-selection via the bridge directly so we avoid panning the
  // viewport-locked Playwright camera over to the sheep cluster.
  const selectionResult = await page.evaluate(() => {
    const api = window.__AOE2_TEST__;
    if (!api) {
      return { didSelect: false, count: 0 };
    }
    const didSelect = api.selectUnitsInBox(18, 17, 21, 20);
    return { didSelect, count: api.getSelectionState().selectedCount };
  });
  if (!selectionResult.didSelect || selectionResult.count < 2) {
    throw new Error(
      `selectUnitsInBox returned didSelect=${selectionResult.didSelect} count=${selectionResult.count}; capture would not exercise the multi-icon grid`,
    );
  }
  await page.waitForTimeout(300);

  const panel = page.locator('[data-hud="selection-panel"]').first();
  const box = await panel.boundingBox();
  if (!box) {
    throw new Error('selection panel boundingBox() returned null; HUD did not render');
  }
  await page.screenshot({
    path: outputPath,
    clip: {
      x: Math.max(0, Math.round(box.x - 8)),
      y: Math.max(0, Math.round(box.y - 8)),
      width: Math.round(box.width + 16),
      height: Math.round(box.height + 16),
    },
  });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
