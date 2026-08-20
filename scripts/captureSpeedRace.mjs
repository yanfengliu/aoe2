// Watch three units cross the same ground, so per-unit movement speed is
// verified by looking at it rather than only by a tick count.
//
// The showcase's land row is one unit per cell along y=34; this orders a Hussar,
// a Villager, and a Mangonel due north together and photographs the field at
// intervals. If the table reaches the pixels, they fan out.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'speed-race';
const RACERS = ['hussar', 'villager', 'mangonel'];
const SAMPLE_MS = [0, 900, 1800, 3200];

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader'],
});

try {
  const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => { console.error('PAGE ERROR', error.message); });
  await page.goto('http://127.0.0.1:4173/?seed=unit-showcase-fixture');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, { timeout: 60_000 });
  await page.waitForTimeout(1000);

  // The showcase already puts every unit on the same row, so the racers start
  // level on y and only differ in x. Ordering the same northward distance makes
  // the fan-out the whole picture.
  const start = await page.evaluate((racers) => window.__AOE2_TEST__.getEconomyState().units
    .filter((unit) => unit.owner === 1 && racers.includes(unit.unitType))
    .map((unit) => ({ id: unit.id, unitType: unit.unitType, x: unit.x, y: unit.y })), RACERS);
  console.log('racers', JSON.stringify(start));

  await page.evaluate((racers) => {
    const api = window.__AOE2_TEST__;
    for (const unitType of racers) {
      const unit = api.getEconomyState().units
        .find((candidate) => candidate.owner === 1 && candidate.unitType === unitType);
      if (!unit) continue;
      api.selectEntityAtCell(unit.x, unit.y);
      api.issueMoveCommand(unit.x + 16, unit.y);
    }
    api.clearSelection();
  }, RACERS);

  await page.evaluate(() => { window.__AOE2_TEST__?.centerCameraOnWorldPosition(14, 15); });

  for (const [index, waitMs] of SAMPLE_MS.entries()) {
    await page.waitForTimeout(waitMs);
    const covered = await page.evaluate(([racers, origin]) => window.__AOE2_TEST__
      .getEconomyState().units
      .filter((unit) => unit.owner === 1 && racers.includes(unit.unitType))
      .map((unit) => {
        const from = origin.find((entry) => entry.id === unit.id);
        return `${unit.unitType} +${String(unit.x - (from?.x ?? unit.x))}`;
      }), [RACERS, start]);
    console.log(`sample ${String(index)}:`, covered.join('  '));
    const outputPath = `tmp/units/${label}-${String(index)}.png`;
    await mkdir(dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, fullPage: false });
  }
} finally {
  await browser.close();
}
