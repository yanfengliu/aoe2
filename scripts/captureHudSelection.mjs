// Capture the HUD with something actually selected.
//
// The default boot shows "No selection", which hides the densest part of the
// interface: the selection heading, stat grid, and command deck. This selects a
// unit (a villager by default) so those surfaces are in the frame, and can also
// open the game menu with MENU=1.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const label = process.env.LABEL ?? 'hud-selection';
const seed = process.env.SEED ?? 'aoe2-prototype';
const unitType = process.env.UNIT ?? 'villager';
const openMenu = process.env.MENU === '1';
// CLEAR=1 drops the selection panel after framing, so the unit itself is visible.
const clearAfter = process.env.CLEAR === '1';

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

  const selected = await page.evaluate((wanted) => {
    const api = window.__AOE2_TEST__;
    const unit = api.getEconomyState().units.find(
      (u) => u.owner === 1 && u.unitType === wanted,
    );
    if (!unit) return { ok: false, reason: `no owner-1 ${wanted} in this scenario` };
    if (!api.selectEntityAtCell(unit.x, unit.y)) {
      return { ok: false, reason: `nothing selectable at ${unit.x},${unit.y}` };
    }
    // Frame the unit — the default camera sits on the Town Center.
    api.centerCameraOnWorldPosition(unit.x, unit.y);
    return { ok: true, at: `${unit.x},${unit.y}` };
  }, unitType);

  if (!selected.ok) throw new Error(`Could not select a ${unitType}: ${selected.reason}`);
  console.log(`selected ${unitType} at ${selected.at}`);

  if (clearAfter) {
    await page.evaluate(() => { window.__AOE2_TEST__.clearSelection(); });
  }

  if (openMenu) {
    await page.locator('[data-hud="menu-button"]').click();
    await page.waitForTimeout(300);
  }

  await page.waitForTimeout(600);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
} finally {
  await browser.close();
}
