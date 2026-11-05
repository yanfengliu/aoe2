// DE's global keys (work 142 M2b-2b), pressed as a player presses them. Each
// key is the `definitive` default of the install's `hotkeys.json`, read with
// `node scripts/dumpDeHotkeys.mjs` (spec §14.2 names each entry):
//  - Space is "Go to Selected Object" (GOTO_SELECTED_OBJECT, 19025) and Home
//    "Go to Last Notification" (CYCLE_FOCUS_AREA, 19024); until work 142 Space
//    jumped to the last raid, which is DE's Home.
//  - Game speed is the numpad's + and − alone (SPEED_UP VK_ADD, SPEED_DOWN
//    VK_SUBTRACT); until work 142 the main row's − slowed the game too.
//  - Ctrl+= and Ctrl+− zoom one wheel notch (ZOOM_IN2, ZOOM_OUT2) and
//    Ctrl+Backspace resets the zoom (RESET_ZOOM).
//  - Shift+Delete deletes every selected entity of the player's
//    (DELETE_UNITS, 19036); Delete still deletes the primary one (DELETE_UNIT).
// And every browser shortcut the game takes is the player's again in a text
// field (the coordinator's answer of 2026-11-05).
//
// BOUNDS: `aoe2-prototype` at the browser suite's viewport; a US layout's
// physical keys as Playwright types them; one raid, the scenario's first.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

async function distanceFromCentre(page: Page, worldX: number, worldY: number): Promise<number> {
  const bounds = await game.getGameCanvasBounds(page);
  const point = await game.getScreenPointForWorldPosition(page, worldX, worldY);
  return Math.hypot(point.x - (bounds.x + bounds.width / 2), point.y - (bounds.y + bounds.height / 2));
}

async function lookAway(page: Page, worldX: number, worldY: number): Promise<void> {
  await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), { x: worldX + 14, y: worldY + 14 });
  expect(await distanceFromCentre(page, worldX, worldY), 'the camera must start away from the target').toBeGreaterThan(150);
}

const cameraState = async (page: Page) => page.evaluate(() => window.__AOE2_TEST__!.getCameraState());
const speed = async (page: Page) => page.evaluate(() => window.__AOE2_TEST__!.getSimulationSpeed());
const zoom = async (page: Page) => (await cameraState(page))!.zoom;

test.describe("DE's global keys", () => {
  test('Space goes to the selected unit or building, and does nothing with nothing selected', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const villager = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.unitType === 'villager')!);
    await game.clickUnit(page, villager.id);
    await expect.poll(async () => (await game.getSelectionState(page))?.selectedEntityId).toBe(villager.id);
    await lookAway(page, villager.x + 0.5, villager.y + 0.5);
    await page.keyboard.press('Space');
    await expect.poll(() => distanceFromCentre(page, villager.x + 0.5, villager.y + 0.5), {
      message: 'Space did not bring the selected villager to the middle of the screen',
    }).toBeLessThan(4);

    await page.keyboard.press('h');
    const townCenter = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().buildings
      .find((building) => building.owner === 1 && building.buildingType === 'town-center')!);
    await expect.poll(async () => (await game.getSelectionState(page))?.selectedEntityId).toBe(townCenter.id);
    // A building's centre is its footprint's middle; its x and y are a corner.
    const centre = { x: townCenter.x + townCenter.footprintWidth / 2, y: townCenter.y + townCenter.footprintHeight / 2 };
    await lookAway(page, centre.x, centre.y);
    await page.keyboard.press('Space');
    await expect.poll(() => distanceFromCentre(page, centre.x, centre.y), {
      message: 'Space did not bring the selected Town Center to the middle of the screen',
    }).toBeLessThan(4);

    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    await lookAway(page, townCenter.x + 0.5, townCenter.y + 0.5);
    const before = await cameraState(page);
    await page.keyboard.press('Space');
    await game.waitForRenderedFrames(page, 6, 300);
    expect(await cameraState(page), 'Space moved the camera with nothing selected').toEqual(before);
  });

  test('Home goes to the last attack notification, which Space no longer does', async ({ page }) => {
    test.slow();
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    // The raid is found as attack-warning.spec.ts finds it: the match runs in
    // 10-tick steps until a villager of the human's loses HP, then until the
    // minimap marks the cell, which is the notification Home goes to.
    const raidTick = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let step = 0; step < 360; step += 1) {
        api.advanceTicks(10, 100);
        const hurt = api.getRenderState().entities.some((entity) => entity.owner === 1
          && entity.entityType === 'villager' && entity.currentHp !== null
          && entity.maxHp !== null && entity.currentHp < entity.maxHp);
        if (hurt) return api.getHudState().tick;
      }
      return null;
    });
    expect(raidTick, "no villager of the human's lost HP within 3600 ticks: nothing was tested").not.toBeNull();
    const minimap = page.locator('[data-hud="minimap"]');
    let cell: string | null = null;
    for (let step = 0; step < 5 && cell === null; step += 1) {
      if (step > 0) await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(10, 100));
      await game.waitForRenderedFrames(page, 3, 100);
      cell = await minimap.getAttribute('data-attack-warning-cell');
    }
    expect(cell, 'the raid raised no notification on the minimap').not.toBeNull();
    const [cellX, cellY] = cell!.split(',').map(Number) as [number, number];

    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    await lookAway(page, cellX + 0.5, cellY + 0.5);
    const before = await cameraState(page);
    await page.keyboard.press('Space');
    await game.waitForRenderedFrames(page, 6, 300);
    expect(await cameraState(page), 'Space jumped to the raid with nothing selected; that is DE\'s Home').toEqual(before);
    await page.keyboard.press('Home');
    await expect.poll(() => distanceFromCentre(page, cellX + 0.5, cellY + 0.5), {
      message: `Home did not go to the raid at ${cell!}`,
    }).toBeLessThan(4);
  });

  test("the numpad's + and − step the game speed, and the main row's keys do not", async ({ page }) => {
    await game.waitForBoot(page);
    expect(await speed(page)).toBe(1);
    await page.keyboard.press('NumpadAdd');
    await expect.poll(() => speed(page)).toBe(1.5);
    await page.keyboard.press('Minus');
    await page.keyboard.press('Shift+Equal');
    await game.waitForRenderedFrames(page, 3, 100);
    expect(await speed(page), "the main row's − or + changed the game speed").toBe(1.5);
    await page.keyboard.press('NumpadAdd');
    await expect.poll(() => speed(page)).toBe(2);
    await page.keyboard.press('NumpadSubtract');
    await expect.poll(() => speed(page)).toBe(1.5);
  });

  test('Ctrl+= and Ctrl+− zoom a wheel notch, and Ctrl+Backspace resets the zoom', async ({ page }) => {
    await game.waitForBoot(page);
    const start = await zoom(page);
    await page.keyboard.press('Control+Equal');
    await expect.poll(() => zoom(page), { message: 'Ctrl+= did not zoom in' }).toBeCloseTo(start + 0.1, 5);
    await page.keyboard.press('Control+Minus');
    await page.keyboard.press('Control+Minus');
    await expect.poll(() => zoom(page), { message: 'Ctrl+− did not zoom out' }).toBeCloseTo(start - 0.1, 5);
    await page.keyboard.press('Control+Backspace');
    await expect.poll(() => zoom(page), { message: 'Ctrl+Backspace did not reset the zoom' }).toBeCloseTo(start, 5);
  });

  test('Delete removes the primary selected unit, and Shift+Delete every selected one', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const alive = async (ids: number[]): Promise<number[]> => page.evaluate((wanted) => {
      const units = new Set(window.__AOE2_TEST__!.getEconomyState().units.map((unit) => unit.id));
      return wanted.filter((id) => units.has(id));
    }, ids);
    // A double-click on a villager's drawn body takes every villager on
    // screen (M1's rule), and no sheep, which a box over them would take too.
    const box = async (): Promise<{ ids: number[]; primary: number | null }> => {
      const villager = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units
        .find((unit) => unit.owner === 1 && unit.unitType === 'villager')!.id);
      const point = await game.getUnitClickPoint(page, villager);
      await page.mouse.dblclick(point.x, point.y, { button: 'left' });
      await expect.poll(async () => (await game.getSelectionState(page))?.selectedEntityIds.length ?? 0).toBeGreaterThan(1);
      const state = (await game.getSelectionState(page))!;
      return { ids: await alive(state.selectedEntityIds), primary: state.selectedEntityId };
    };
    const first = await box();
    expect(first.ids, 'the primary selected entity must be one of the villagers').toContain(first.primary);
    await page.keyboard.press('Delete');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(2, 100));
    await expect.poll(() => alive(first.ids), { message: 'Delete removed other than the primary unit' })
      .toEqual(first.ids.filter((id) => id !== first.primary));

    const second = await box();
    await page.keyboard.press('Shift+Delete');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(2, 100));
    await expect.poll(() => alive(second.ids), { message: 'Shift+Delete left selected units standing' }).toEqual([]);
  });

  test('every browser shortcut the game takes still reaches a focused text field', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('Alt+m');
    const field = page.locator('[data-testid="annotation-form-text"]');
    await field.click();
    await field.fill('alpha beta');
    const before = { zoom: await zoom(page), speed: await speed(page), camera: await cameraState(page) };
    await page.evaluate(() => {
      const log: Array<{ code: string; prevented: boolean }> = [];
      (window as unknown as { keyLog: typeof log }).keyLog = log;
      window.addEventListener('keydown', (event) => { log.push({ code: event.code, prevented: event.defaultPrevented }); });
    });
    for (const key of ['Control+Backspace', 'Space', 'NumpadAdd', 'NumpadSubtract', 'Shift+Delete', 'Control+Equal', 'Control+Minus', 'Home']) {
      await page.keyboard.press(key);
    }
    const log = await page.evaluate(() => (window as unknown as { keyLog: Array<{ code: string; prevented: boolean }> }).keyLog);
    expect(log.filter((entry) => !['ControlLeft', 'ShiftLeft'].includes(entry.code)), 'a game key took a key typed into a text field')
      .toEqual(['Backspace', 'Space', 'NumpadAdd', 'NumpadSubtract', 'Delete', 'Equal', 'Minus', 'Home'].map((code) => ({ code, prevented: false })));
    await expect(field).toHaveValue('alpha  +-');
    expect(await field.evaluate((element: HTMLTextAreaElement) => element.selectionStart), 'Home did not reach the field').toBe(0);
    expect({ zoom: await zoom(page), speed: await speed(page), camera: await cameraState(page) }).toEqual(before);
  });
});
