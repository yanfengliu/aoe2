// Photograph a group arriving in each formation.
//
// Formations are a POSITIONAL change, so the only honest check is looking at
// where the units end up. This selects the showcase's unit band, sets a
// formation, orders it to open ground, waits for the walk, and captures.
//
// FORMATION picks one; omit it to walk all four.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'formation';
const ALL = ['line', 'staggered', 'box', 'flank'];
const formations = process.env.FORMATION ? [process.env.FORMATION] : ALL;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => { console.error('PAGE ERROR', error.message); });

  for (const formation of formations) {
    await page.goto('http://127.0.0.1:4173/?seed=unit-showcase-fixture');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, { timeout: 60_000 });
    await page.waitForTimeout(900);

    // The formation command goes through the recorded channel, so it does not
    // land until the next tick. Ordering the move in the SAME evaluate reads
    // the previous formation — set it, let a tick pass, then order.
    const selected = await page.evaluate((chosen) => {
      const api = window.__AOE2_TEST__;
      // The two unique-unit rows are the biggest mixed band on the map.
      if (!api.selectUnitsInBox(0, 33, 59, 35)) return 0;
      api.setSelectionFormation(chosen);
      return api.getSelectionState().selectedEntityIds.length;
    }, formation);
    await page.waitForTimeout(600);
    const ordered = await page.evaluate(() => {
      const api = window.__AOE2_TEST__;
      if (!api.selectUnitsInBox(0, 33, 59, 35)) return false;
      const issued = api.issueMoveCommand(26, 22);
      api.clearSelection();
      return issued;
    });
    console.log(`${formation}: selected ${String(selected)}, ordered ${String(ordered)}`);

    await page.evaluate(() => { window.__AOE2_TEST__?.centerCameraOnWorldPosition(26, 23); });
    await page.waitForTimeout(16000);

    const outputPath = `tmp/units/${label}-${formation}.png`;
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: false });
    console.log(`saved ${outputPath}`);
  }
} finally {
  await browser.close();
}
