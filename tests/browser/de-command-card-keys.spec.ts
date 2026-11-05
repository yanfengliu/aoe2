// Work 142 M2a: the villager's command card and the Villager and Town Center
// keys as in Age of Empires II: Definitive Edition (DE). Every key and card
// rule here is sourced from the install's `resources/_common/dat/hotkeys.json`,
// the `definitive` profile of each entry's `defaults_list` (names from the
// English string table): see `src/ui/hud/commandCardKeys.ts`.
//
// Real input only: units are selected by a real click on their drawn body
// (`clickUnit`) or by the real H key, and every key is a real keyboard press,
// because a registry entry proves nothing about what a keyboard does.
//
// Bound: the default map (`aoe2-prototype`) at boot, Dark Age, one villager or
// the Town Center selected. Other cards' keys are work 142 M2b.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

async function clickFirstVillager(page: Page): Promise<void> {
  const id = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units.find(
    (unit) => unit.owner === 1 && unit.unitType === 'villager',
  )?.id ?? null);
  expect(id, 'the default map starts the human with a villager').not.toBeNull();
  await game.clickUnit(page, id!);
  await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
}

async function selectTownCenterWithH(page: Page): Promise<void> {
  await page.keyboard.press('h');
  await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
}

const armedGroundOrder = async (page: Page): Promise<string | null> => page.evaluate(
  () => window.__AOE2_TEST__!.getArmedGroundOrder(),
);

test.describe('DE command card and its keys (work 142 M2a)', () => {
  test('a villager\'s card has no stance or formation buttons; a Scout\'s keeps both', async ({ page }) => {
    await game.waitForBoot(page);
    await clickFirstVillager(page);
    // DE files stances and formations under "Military Units" (hotkeys.json
    // MILITARY_UNITS_HOTKEYS, string 20014); a villager's card has neither.
    await expect(page.locator('[data-command-group="build"]')).toBeAttached();
    await expect(page.locator('[data-command-group="stance"]')).toHaveCount(0);
    await expect(page.locator('[data-command-group="formation"]')).toHaveCount(0);

    const scout = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    )?.id ?? null);
    expect(scout, 'the default map starts the human with a Scout Cavalry').not.toBeNull();
    await game.clickUnit(page, scout!);
    await expect(page.locator('[data-selection-name]')).toHaveText('Scout Cavalry');
    await expect(page.locator('[data-command-group="stance"] [data-command]')).toHaveCount(4);
    await expect(page.locator('[data-command-group="formation"] [data-command]')).toHaveCount(4);
  });

  test('Q opens the Economic page and W the Military page; the next key builds from it', async ({ page }) => {
    await game.waitForBoot(page);
    await clickFirstVillager(page);
    const placing = page.locator('[data-placement-mode]');
    const buildGroup = page.locator('[data-command-group="build"]');

    // One key only opens a page: nothing is being placed yet.
    await page.keyboard.press('q');
    await expect(buildGroup).toHaveAttribute('data-build-page', 'economic');
    await expect(placing).toHaveCount(0);
    // VILLAGER_BUILD_HOUSE: Q on the Economic page.
    await page.keyboard.press('q');
    await expect(placing).toHaveText('Placing: House');
    await page.keyboard.press('Escape');
    await expect(placing).toHaveCount(0);

    // BUILD_MILITARY is W; VILLAGER_BUILD_BARRACKS is Q on the Military page.
    await page.keyboard.press('w');
    await expect(buildGroup).toHaveAttribute('data-build-page', 'military');
    await expect(placing).toHaveCount(0);
    await page.keyboard.press('q');
    await expect(placing).toHaveText('Placing: Barracks');
    await page.keyboard.press('Escape');

    // After a building is chosen the card is back on its first page: Q, W is
    // the Mill (VILLAGER_BUILD_MILL), not the Military page.
    await page.keyboard.press('q');
    await page.keyboard.press('w');
    await expect(placing).toHaveText('Placing: Mill');
    await page.keyboard.press('Escape');

    // A click on a page tab opens that page for the keys, as DE's button does.
    await page.locator('button[data-build-page="military"]').click();
    await page.keyboard.press('s');
    await expect(placing).toHaveText('Placing: Palisade Wall');
  });

  test('the Town Center trains a Villager on Q and researches Loom on A', async ({ page }) => {
    await game.waitForBoot(page);
    await selectTownCenterWithH(page);
    const queue = page.locator('[data-selection-queue-item] .hud-queue-name');
    await expect(queue).toHaveCount(0);
    // TOWN_CENTER_CREATE_VILLAGER: Q.
    await page.keyboard.press('q');
    await expect(queue).toHaveCount(1);
    await expect(queue.first()).toContainText('Villager');
    // TOWN_CENTER_LOOM: A. It no longer arms attack-move with the Town Center selected.
    await page.keyboard.press('a');
    await expect(queue).toHaveCount(2);
    await expect(queue.nth(1)).toContainText('Loom');
    expect(await armedGroundOrder(page)).toBeNull();
  });

  test('the Town Center rings the bell on B and sends everyone back on F', async ({ page }) => {
    await game.waitForBoot(page);
    await selectTownCenterWithH(page);
    // TOWN_CENTER_RING_TOWN_BELL: B; TOWN_CENTER_BACK_TO_WORK: F.
    await page.keyboard.press('b');
    const backToWork = page.locator('[data-command="action-back-to-work"]');
    await expect(backToWork, 'B rang the bell: a villager took shelter and the card offers Back to Work').toBeAttached({ timeout: 20_000 });
    await page.keyboard.press('f');
    await expect(backToWork, 'F sent the sheltered villagers back to work').toHaveCount(0, { timeout: 20_000 });
  });

  test('a key with no button on a DE card does nothing', async ({ page }) => {
    await game.waitForBoot(page);
    await selectTownCenterWithH(page);
    // UNGARRISON is G, and an empty Town Center has no Ungarrison button:
    // G no longer arms attack-ground with the Town Center selected.
    await page.keyboard.press('g');
    expect(await armedGroundOrder(page)).toBeNull();
    await expect(page.locator('[data-selection-queue-item]')).toHaveCount(0);

    // A villager's first page has nothing on A (DE's Drop Off Resources is not
    // in this game): A no longer arms attack-move with a villager selected.
    await clickFirstVillager(page);
    await page.keyboard.press('a');
    expect(await armedGroundOrder(page)).toBeNull();
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);
  });

  test('W, A, S and D are command keys and never move the camera; the arrow keys do', async ({ page }) => {
    await game.waitForBoot(page);
    await page.locator('.voxel-world-canvas').click();
    const scroll = async (): Promise<{ x: number; y: number }> => page.evaluate(() => {
      const camera = window.__AOE2_TEST__!.getSnapshot().cameraState;
      return { x: camera?.scrollX ?? 0, y: camera?.scrollY ?? 0 };
    });
    for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
      const before = await scroll();
      await page.keyboard.down(key);
      try {
        // FRAMES, not a sleep: the pan accrues per rendered frame, so only a
        // window that drew frames can show the camera held still.
        await game.waitForRenderedFrames(page, 12);
      } finally {
        await page.keyboard.up(key);
      }
      expect(await scroll(), `${key} held for 12 frames moved the camera`).toEqual(before);
    }
    // DE's SCROLL_HOTKEYS are the arrow keys alone.
    expect(await game.panWithKeyUntilMoved(page, 'ArrowRight', 40)).toBeGreaterThanOrEqual(40);
  });
});
