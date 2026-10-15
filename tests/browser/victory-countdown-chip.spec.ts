// The top bar's Wonder/Relic timer states a Definitive Edition countdown (work 132).
//
// A countdown opens at DE's length for the players seated (spec section 4.3):
// 200 years on a two-player map, which are 16:40 of game time, and 300 on a
// six-player one, 25:00. The chip shows the time left; hovering it, with the
// real mouse, states the years left, and keeps stating them as the countdown
// runs under the resting pointer. The fixtures open a Wonder at seeding and
// a Relic on the first tick with no override, so this reads the rule's own
// length through the real page. The sim is paused and stepped by whole ticks, so
// the text is exact.
//
// BOUND: the text and the tooltip of the chip, not its pixels. The chip's slot
// is permanently reserved in the bar (spec section 14.1), which this change does
// not touch; the layout specs of the top bar still hold that.
import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

test.describe('the Wonder/Relic timer in the top bar', () => {
  test('states a fresh 200-year Wonder countdown as time, and its years on hover', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'wonder-default-clock-2p-fixture');
    // 100 ticks, 10 seconds of game time: 9,900 of the 10,000 ticks are left.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(100, 100));
    const chip = page.locator('[data-hud="countdown-chip"]');
    await expect(chip).toHaveAttribute('data-hud-countdown-active', 'true');
    await expect(chip.locator('[data-hud="countdown-label"]')).toHaveText('Wonder');
    await expect(chip.locator('[data-hud="countdown-value"]')).toHaveText('16:30');
    await expect(chip).toHaveAttribute('data-hud-countdown-years', '198');

    await chip.hover();
    const tooltip = page.locator('[data-hud="tooltip"]');
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
    await expect(tooltip).toContainText('Wonder victory in 198 years (16:30 of game time)');

    // The pointer stays on the chip while 5 more seconds of game time pass: the
    // tooltip follows the chip's time and years rather than keeping the first.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(50, 100));
    await expect(chip.locator('[data-hud="countdown-value"]')).toHaveText('16:25');
    await expect(tooltip).toContainText('Wonder victory in 197 years (16:25 of game time)');
  });

  test('states a six-player Relic countdown at 300 years, 25:00', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'relic-default-clock-6p-fixture');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(100, 100));
    const chip = page.locator('[data-hud="countdown-chip"]');
    await expect(chip).toHaveAttribute('data-hud-countdown-active', 'true');
    await expect(chip.locator('[data-hud="countdown-label"]')).toHaveText('Relic');
    // 15,000 ticks to open, 100 gone.
    await expect(chip.locator('[data-hud="countdown-value"]')).toHaveText('24:50');
    await expect(chip).toHaveAttribute('data-hud-countdown-years', '298');
    await chip.hover();
    await expect(page.locator('[data-hud="tooltip"]')).toContainText('Relic victory in 298 years (24:50 of game time)');
  });
});
