// DE's game speeds (spec §4.5, work 149), driven as a player drives them: the
// lobby's row with the real Start Match, and the numpad's + and − (DE's
// SPEED_UP VK_ADD and SPEED_DOWN VK_SUBTRACT) in the running match, read back
// from the Time chip the player reads and from the view's multiplier.
//
// BOUNDS: the lobby's default map; the row driven by its own keyboard (a
// focused select's arrow keys), not by its pop-up list; Chromium's key codes
// for the numpad. The pace each multiplier gives, and that every speed plays
// the same match, are `tests/simulation/gameSpeedPace.test.ts`.

import { expect, test, type Page } from '@playwright/test';

const speed = async (page: Page) => page.evaluate(() => window.__AOE2_TEST__!.getSimulationSpeed());
const readout = (page: Page) => page.locator('[data-hud="speed"]');

async function startFromLobby(page: Page): Promise<void> {
  await page.locator('[data-setup="start"]').click();
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
}

test.describe("DE's game speeds", () => {
  test("the lobby offers DE's four speeds and starts on Normal, which Start Match boots at", async ({ page }) => {
    await page.goto('/');
    const row = page.locator('[data-setup="speed"]');
    await expect(row.locator('option')).toHaveText(['Slow (1.0x)', 'Casual (1.5x)', 'Normal (1.7x)', 'Fast (2.0x)']);
    await expect(row).toHaveValue('normal');
    await startFromLobby(page);
    expect(new URL(page.url()).searchParams.get('speed')).toBe('normal');
    expect(await speed(page)).toBe(1.7);
    await expect(readout(page)).toHaveText('(1.7)');
    await expect(page.locator('[data-hud="time"]')).toHaveText(/^\d\d:\d\d$/);
  });

  test("a speed chosen in the row boots, and the numpad's keys step DE's four and stop at the ends", async ({ page }) => {
    await page.goto('/');
    const row = page.locator('[data-setup="speed"]');
    await row.focus();
    await page.keyboard.press('ArrowUp');
    await expect(row).toHaveValue('casual');
    await startFromLobby(page);
    expect(new URL(page.url()).searchParams.get('speed')).toBe('casual');
    expect(await speed(page)).toBe(1.5);
    await expect(readout(page)).toHaveText('(1.5)');

    const steps: Array<[string, number]> = [
      ['NumpadSubtract', 1], ['NumpadSubtract', 1],
      ['NumpadAdd', 1.5], ['NumpadAdd', 1.7], ['NumpadAdd', 2], ['NumpadAdd', 2],
      ['NumpadSubtract', 1.7],
    ];
    for (const [key, expected] of steps) {
      await page.keyboard.press(key);
      await expect.poll(() => speed(page), { message: `${key} should leave the speed at ${expected}` }).toBe(expected);
      await expect(readout(page)).toHaveText(`(${expected.toFixed(1)})`);
    }
  });
});
