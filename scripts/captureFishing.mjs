// Capture a Fishing Ship actually working: trained at the Dock, sent to fish,
// and framed on the bay so the whole naval loop is visible in one frame.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'fishing';
const seed = process.env.SEED ?? 'naval-fixture';
const ticks = Number(process.env.TICKS ?? '260');

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

  // Select the Dock and order ships through the real command button — the
  // test API has no train method, so this goes through the DOM the player uses.
  const dock = await page.evaluate(() => {
    const api = window.__AOE2_TEST__;
    const found = api.getEconomyState().buildings.find(
      (b) => b.owner === 1 && b.buildingType === 'dock',
    );
    if (found) api.selectEntityAtCell(found.x, found.y);
    return found ? { x: found.x, y: found.y } : null;
  });
  if (!dock) throw new Error('no dock in this scenario');

  const trainButton = page.locator('.hud-command-button:not(:disabled)').first();
  for (let i = 0; i < 2; i += 1) {
    await trainButton.click();
    await page.waitForTimeout(120);
  }

  const result = await page.evaluate(({ runTicks, dockCell }) => {
    const api = window.__AOE2_TEST__;
    for (let i = 0; i < 900; i += 1) {
      api.advanceTicks(1);
      if (api.getEconomyState().units.filter((u) => u.unitType === 'fishing-ship').length >= 2) break;
    }
    const fish = api.getEconomyState().resources.filter((r) => r.resourceType === 'fish');
    const ships = api.getEconomyState().units.filter((u) => u.unitType === 'fishing-ship');
    ships.forEach((ship, index) => {
      const target = fish[index % Math.max(1, fish.length)];
      if (!target) return;
      api.selectEntityAtCell(ship.x, ship.y);
      api.issueContextCommand(target.x, target.y);
    });
    api.advanceTicks(runTicks);
    api.clearSelection();
    api.centerCameraOnWorldPosition(dockCell.x + 4, dockCell.y + 2);
    return {
      ok: true,
      food: api.getHudState().playerResources.food,
      ships: api.getEconomyState().units.filter((u) => u.unitType === 'fishing-ship').length,
    };
  }, { runTicks: ticks, dockCell: dock });

  console.log(`fishing: ${result.ships} ship(s), food=${result.food}`);

  await page.waitForTimeout(600);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
