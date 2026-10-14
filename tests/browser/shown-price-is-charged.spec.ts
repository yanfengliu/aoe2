import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

// GATE — the browser half of "a shown price is the charged price" (spec §14.2,
// work 125). tests/ui/shownPriceCensus.test.ts holds the whole content table on
// the panel's DOM; this holds that a PLAYER reads the same figure — the
// tooltip the real mouse raises over the real button — and that the real
// click on that button takes exactly it from the stockpile the top bar shows.
//
// The reported defect: the Train Fishing Ship tooltip said 75 wood, the table
// row, while the Dock charged an Italian 64 (Fishing Ships cost them 15% less).
//
// BOUND. One civilization, one button, at the suite's 800x600 viewport. The
// Dock is selected through the test API; the price is read and paid through
// the mouse.
test('the Train Fishing Ship tooltip quotes an Italian the 64 wood the Dock charges', async ({ page }) => {
  await game.waitForBootWithSeed(page, 'naval-fixture', 'Italians');
  expect(await game.selectOwnedBuildingDirect(page, 1, 'dock')).toBe(true);

  const train = page.locator('[data-command="train-fishing-ship"]');
  await expect(train).toBeVisible();
  const tooltip = page.locator('[data-hud="tooltip"]');
  await train.hover();
  await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
  await expect(tooltip).toContainText('Cost: 64 wood.');

  const wood = (): Promise<number> => page.evaluate(
    () => window.__AOE2_TEST__!.getSnapshot().hudState.playerResources.wood,
  );
  const before = await wood();
  await train.click();
  // Nothing in this fixture gathers, so the stockpile moves only by the charge.
  await expect.poll(async () => before - (await wood())).toBe(64);
});
