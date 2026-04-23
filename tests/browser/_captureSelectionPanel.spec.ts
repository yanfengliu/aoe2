// Ad-hoc capture spec used by scripts/captureSelectionPanel flows.
// Not part of the shipped browser test suite; gitignored if needed.
import { test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const label = process.env.AOE2_CAPTURE_LABEL ?? 'screenshot';

test(`capture selection panel ${label}`, async ({ page }) => {
  test.setTimeout(90_000);
  await game.waitForBootWithSeed(page, 'mixed-selection-fixture');

  const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
  const renderedMilitia = await game.getRenderedOwnedUnits(page, 1, 'militia');
  const renderedScouts = await game.getRenderedOwnedUnits(page, 1, 'scout');
  const movables = [...renderedVillagers, ...renderedMilitia, ...renderedScouts];
  const minX = Math.min(...movables.map((unit) => unit.x + 0.5 - unit.size * 0.5));
  const maxX = Math.max(...movables.map((unit) => unit.x + 0.5 + unit.size * 0.5));
  const minY = Math.min(...movables.map((unit) => unit.y + 0.5 - unit.size * 0.5));
  const maxY = Math.max(...movables.map((unit) => unit.y + 0.5 + unit.size * 0.5));

  await game.dragSelectWorldRect(page, minX - 0.05, minY - 0.05, maxX + 0.05, maxY + 0.05);
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(400);

  const panel = page.locator('[data-hud="selection-panel"]').first();
  const box = (await panel.boundingBox()) ?? { x: 900, y: 40, width: 360, height: 660 };
  await page.screenshot({
    path: `docs/devlog/artifacts/2026-04-23-selection-panel-${label}.png`,
    clip: {
      x: Math.max(0, Math.round(box.x - 8)),
      y: Math.max(0, Math.round(box.y - 8)),
      width: Math.round(box.width + 16),
      height: Math.round(box.height + 16),
    },
  });
});
