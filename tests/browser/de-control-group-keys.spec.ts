// Work 142 M2b-2b-2b: Age of Empires II: Definitive Edition's (DE) control
// groups, pressed as a player presses them. Each key is the `definitive`
// default of GROUP_COMMAND_HOTKEYS in the install's `hotkeys.json` (`node
// scripts/dumpDeHotkeys.mjs GROUP_COMMAND_HOTKEYS`; spec §14.2 names each):
// Ctrl with a digit creates a group, the digit selects it, Shift with it appends
// the selection, Ctrl+Shift with it selects and centres (Ctrl+Shift+F10 for
// group 10), groups 11-20 are the same keys with Alt, and U ungroups. Until
// work 142 only 1-9 were bound, Ctrl with a digit and the digit, matched on the
// character typed, so Shift+1 ("!") did nothing and the numpad's 1 selected
// group 1, which DE's VK_1 does not.
//
// BOUNDS: `aoe2-prototype`, paused, at the browser suite's viewport; its
// three villagers and Scout of the human's, each selected by a real click on
// its drawn body; a US layout's keys as Playwright types them.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

interface Unit { id: number; x: number; y: number }

async function ownUnits(page: Page): Promise<{ villagers: Unit[]; scout: Unit }> {
  const units = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units
    .filter((unit) => unit.owner === 1).map(({ id, x, y, unitType }) => ({ id, x, y, unitType })));
  const villagers = units.filter((unit) => unit.unitType === 'villager').sort((a, b) => a.id - b.id);
  const scout = units.find((unit) => unit.unitType === 'scout');
  expect(villagers.length, 'the boot base holds three villagers of the human\'s').toBeGreaterThanOrEqual(3);
  expect(scout, 'the boot base holds a Scout of the human\'s').toBeDefined();
  return { villagers, scout: scout! };
}

const selectedIds = async (page: Page): Promise<number[]> => [...(await game.getSelectionState(page)).selectedEntityIds]
  .sort((a, b) => a - b);

/** Selects a unit by a real click on its drawn body. */
async function click(page: Page, unit: Unit): Promise<void> {
  await game.clickUnit(page, unit.id);
  await expect.poll(() => selectedIds(page)).toEqual([unit.id]);
}

async function clearSelection(page: Page): Promise<void> {
  await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
  await expect.poll(() => selectedIds(page)).toEqual([]);
}

/** Presses a key with nothing selected and returns whom it selected. */
async function recalled(page: Page, key: string): Promise<number[]> {
  await clearSelection(page);
  await page.keyboard.press(key);
  await game.waitForRenderedFrames(page, 3, 100);
  return selectedIds(page);
}

const ids = (...units: Unit[]): number[] => units.map((unit) => unit.id).sort((a, b) => a - b);

async function distanceFromCentre(page: Page, unit: Unit): Promise<number> {
  const bounds = await game.getGameCanvasBounds(page);
  const point = await game.getScreenPointForWorldPosition(page, unit.x + 0.5, unit.y + 0.5);
  return Math.hypot(point.x - (bounds.x + bounds.width / 2), point.y - (bounds.y + bounds.height / 2));
}

async function lookAway(page: Page, unit: Unit): Promise<void> {
  await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), { x: unit.x + 14, y: unit.y + 14 });
  expect(await distanceFromCentre(page, unit), 'the camera must start away from the unit').toBeGreaterThan(150);
}

test.describe("DE's control-group keys", () => {
  test('Ctrl with a digit creates a group, the digit selects it, Shift appends, and the numpad\'s digits are no group key', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const { villagers: [first, second], scout } = await ownUnits(page);
    await click(page, first!);
    await page.keyboard.press('Control+Digit1');
    await click(page, scout);
    await page.keyboard.press('Shift+Digit1');
    await game.waitForRenderedFrames(page, 3, 100);
    expect(await selectedIds(page), 'Shift+1 changed the selection').toEqual([scout.id]);
    expect(await recalled(page, 'Digit1'), 'Shift+1 did not append the Scout to group 1').toEqual(ids(first!, scout));
    await click(page, second!);
    await page.keyboard.press('Control+Digit0');
    expect(await recalled(page, 'Digit0'), 'Ctrl+0 and 0 are group 10').toEqual([second!.id]);
    expect(await recalled(page, 'Numpad1'), 'the numpad\'s 1 selected group 1').toEqual([]);
  });

  test('Alt makes the same keys groups 11 to 20, and a unit is in one group at a time', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const { villagers: [first, second], scout } = await ownUnits(page);
    await click(page, first!);
    await page.keyboard.press('Control+Alt+Digit1');
    await click(page, second!);
    await page.keyboard.press('Alt+Shift+Digit1');
    expect(await recalled(page, 'Alt+Digit1'), 'Ctrl+Alt+1, Alt+Shift+1 and Alt+1 are group 11').toEqual(ids(first!, second!));
    expect(await recalled(page, 'Digit1'), 'group 11 is not group 1').toEqual([]);
    await click(page, first!);
    await page.keyboard.press('Control+Digit2');
    expect(await recalled(page, 'Alt+Digit1'), 'creating group 2 left its villager in group 11').toEqual([second!.id]);
    await click(page, scout);
    await page.keyboard.press('Control+Alt+Digit0');
    expect(await recalled(page, 'Alt+Digit0'), 'Ctrl+Alt+0 and Alt+0 are group 20').toEqual([scout.id]);
  });

  test('Ctrl+Shift with a digit selects and centres, F10 for groups 10 and 20', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const { villagers: [first, second], scout } = await ownUnits(page);
    const cases: ReadonlyArray<readonly [Unit, string, string]> = [
      [first!, 'Control+Digit3', 'Control+Shift+Digit3'],
      [second!, 'Control+Digit0', 'Control+Shift+F10'],
      [scout, 'Control+Alt+Digit0', 'Control+Alt+Shift+F10'],
    ];
    for (const [unit, create, centre] of cases) {
      await click(page, unit);
      await page.keyboard.press(create);
      await lookAway(page, unit);
      await clearSelection(page);
      await page.keyboard.press(centre);
      await expect.poll(() => selectedIds(page), { message: `${centre} did not select the group of ${create}` }).toEqual([unit.id]);
      await expect.poll(() => distanceFromCentre(page, unit), { message: `${centre} did not centre on its group` }).toBeLessThan(4);
    }
  });

  test('U takes the selection out of its group', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const { villagers: [first, second] } = await ownUnits(page);
    await click(page, first!);
    await page.keyboard.press('Control+Digit1');
    await click(page, second!);
    await page.keyboard.press('Shift+Digit1');
    await click(page, first!);
    await page.keyboard.press('u');
    await game.waitForRenderedFrames(page, 3, 100);
    expect(await selectedIds(page), 'U changed the selection').toEqual([first!.id]);
    expect(await recalled(page, 'Digit1'), 'U left the villager in group 1').toEqual([second!.id]);
  });
});
