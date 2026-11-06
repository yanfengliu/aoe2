// Work 142 M2b-2b-2: Age of Empires II: Definitive Edition's (DE) "go to" and
// "select all" building keys, pressed as a player presses them. Each key is the
// `definitive` default of the install's `resources/_common/dat/hotkeys.json`,
// read with `node scripts/dumpDeHotkeys.mjs CYCLE_COMMAND_HOTKEYS
// GAME_COMMAND_HOTKEYS` (the card groups); spec §14.2 names each entry.
//  - Ctrl+letter goes to the player's next building of a type (the card group of
//    CYCLE_COMMAND_HOTKEYS, as H goes to the Town Center): it selects it and
//    centres the camera on it, and a second press goes to the next one.
//  - Ctrl+Shift+letter selects every building of the type the player owns (the
//    card group of GAME_COMMAND_HOTKEYS), Ctrl+Shift+H every Town Center and
//    Ctrl+Shift+Space every military building, and leaves the camera where it is.
// Until work 142 none of these keys did anything in the game, and each was the
// browser's (Ctrl+S saved the page, Ctrl+D bookmarked it).
//
// BOUNDS: the building-go-to-keys fixture (the showcase's grid of one completed
// building of the human's of each type, a second Barracks and Town Center of
// the human's, and a Barracks of player 2's in the human's sight) and
// `aoe2-prototype`, at the browser suite's viewport; a US layout's keys as
// Playwright types them, which reach the page directly (Chrome's own reserved
// keys, Ctrl+W among them, never reach a page and are not pressed here).

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const SEED = 'building-go-to-keys-fixture';

/** DE's go-to keys and the building type each reaches (entry, string id). */
const GO_TO_KEYS: ReadonlyArray<readonly [key: string, buildingType: string]> = [
  ['Control+m', 'market'], // GOTO_MARKET 19027
  ['Control+b', 'barracks'], // GOTO_BARRACKS 19269
  ['Control+a', 'archery-range'], // GOTO_ARCHERY_RANGE 19270
  ['Control+l', 'stable'], // GOTO_STABLE 19271
  ['Control+k', 'siege-workshop'], // GOTO_SIEGE_WORKSHOP 19272
  ['Control+d', 'dock'], // GOTO_DOCK 19273
  ['Control+y', 'monastery'], // GOTO_MONASTERY 19274
  ['Control+s', 'blacksmith'], // GOTO_BLACKSMITH 19275
  ['Control+i', 'mill'], // GOTO_MILL 19276
  ['Control+u', 'university'], // GOTO_UNIVERSITY 19277
  ['Control+v', 'castle'], // GOTO_CASTLE 19290
  ['Control+g', 'mining-camp'], // GOTO_MINING_CAMP 19291
  ['Control+z', 'lumber-camp'], // GOTO_LUMBER_CAMP 19292
  ['Control+j', 'outpost'], // GOTO_OUTPOST 419135
];

const MILITARY_BUILDINGS = ['barracks', 'archery-range', 'stable', 'siege-workshop', 'castle', 'monastery'];

/** DE's select-all keys and the building types each takes (entry, string id). */
const SELECT_ALL_KEYS: ReadonlyArray<readonly [key: string, buildingTypes: readonly string[]]> = [
  ['Control+Shift+m', ['market']], // SELECT_ALL_MARKETS 19131
  ['Control+Shift+b', ['barracks']], // SELECT_ALL_BARRACKS 19014
  ['Control+Shift+a', ['archery-range']], // SELECT_ALL_ARCHERY_RANGES 19015
  ['Control+Shift+l', ['stable']], // SELECT_ALL_STABLES 19016
  ['Control+Shift+k', ['siege-workshop']], // SELECT_ALL_SIEGE_WORKSHOPS 19017
  ['Control+Shift+d', ['dock']], // SELECT_ALL_DOCKS 19013
  ['Control+Shift+y', ['monastery']], // SELECT_ALL_MONASTERIES 19020
  ['Control+Shift+s', ['blacksmith']], // SELECT_ALL_BLACKSMITHS 19132
  ['Control+Shift+i', ['mill']], // SELECT_ALL_MILLS 19155
  ['Control+Shift+u', ['university']], // SELECT_ALL_UNIVERSITIES 19133
  ['Control+Shift+v', ['castle']], // SELECT_ALL_CASTLES 19018
  ['Control+Shift+g', ['mining-camp']], // SELECT_ALL_MINING_CAMPS 19156
  ['Control+Shift+z', ['lumber-camp']], // SELECT_ALL_LUMBER_CAMPS 19157
  ['Control+Shift+j', ['outpost']], // SELECT_ALL_OUTPOSTS 419134
  ['Control+Shift+h', ['town-center']], // SELECT_ALL_TOWN_CENTERS 19021
  ['Control+Shift+Space', MILITARY_BUILDINGS], // SELECT_ALL_MILITARY_BUILDINGS 19003, by its unit_list
];

interface PlacedBuilding { id: number; owner: number; buildingType: string; x: number; y: number; footprintWidth: number; footprintHeight: number }

const buildings = async (page: Page): Promise<PlacedBuilding[]> => page.evaluate(() => window.__AOE2_TEST__!
  .getEconomyState().buildings.map(({ id, owner, buildingType, x, y, footprintWidth, footprintHeight }) => (
    { id, owner, buildingType, x, y, footprintWidth, footprintHeight })));

const selectedIds = async (page: Page): Promise<number[]> => [...(await game.getSelectionState(page)).selectedEntityIds]
  .sort((a, b) => a - b);

const cameraState = async (page: Page) => page.evaluate(() => window.__AOE2_TEST__!.getCameraState());

async function distanceFromCentre(page: Page, building: PlacedBuilding): Promise<number> {
  const bounds = await game.getGameCanvasBounds(page);
  const point = await game.getScreenPointForWorldPosition(
    page, building.x + building.footprintWidth / 2, building.y + building.footprintHeight / 2,
  );
  return Math.hypot(point.x - (bounds.x + bounds.width / 2), point.y - (bounds.y + bounds.height / 2));
}

async function lookAway(page: Page, building: PlacedBuilding): Promise<void> {
  await page.evaluate(({ x, y }) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x, y), {
    x: building.x + building.footprintWidth / 2 + 12, y: building.y + building.footprintHeight / 2 + 12,
  });
  expect(await distanceFromCentre(page, building), 'the camera must start away from the building').toBeGreaterThan(150);
}

/** Records each keydown's code and whether the page took it (its default prevented). */
async function logKeys(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: Array<{ code: string; prevented: boolean }> = [];
    (window as unknown as { keyLog: typeof log }).keyLog = log;
    window.addEventListener('keydown', (event) => {
      if (!['ControlLeft', 'ShiftLeft'].includes(event.code)) log.push({ code: event.code, prevented: event.defaultPrevented });
    });
  });
}
const keyLog = async (page: Page) => page.evaluate(
  () => (window as unknown as { keyLog: Array<{ code: string; prevented: boolean }> }).keyLog,
);
const codeOf = (key: string): string => {
  const last = key.split('+').at(-1)!;
  return last.length === 1 ? `Key${last.toUpperCase()}` : last;
};

test.describe("DE's go-to and select-all building keys", () => {
  test('each Ctrl+letter selects the player\'s building of its type and centres on it, and the browser keeps none', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const placed = await buildings(page);
    await logKeys(page);
    for (const [key, buildingType] of GO_TO_KEYS) {
      const own = placed.filter((entry) => entry.owner === 1 && entry.buildingType === buildingType).sort((a, b) => a.id - b.id);
      expect(own.length, `the fixture gives the human a ${buildingType}`).toBeGreaterThan(0);
      await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
      await lookAway(page, own[0]!);
      await page.keyboard.press(key);
      await expect.poll(() => selectedIds(page), { message: `${key} did not select the human's ${buildingType}` })
        .toEqual([own[0]!.id]);
      await expect.poll(() => distanceFromCentre(page, own[0]!), {
        message: `${key} did not bring the ${buildingType} to the middle of the screen`,
      }).toBeLessThan(4);
    }
    expect(await keyLog(page), 'the browser kept a go-to key').toEqual(GO_TO_KEYS.map(([key]) => ({ code: codeOf(key), prevented: true })));
  });

  test('a second press goes to the next building of the type, and on round to the first, never another player\'s', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const placed = await buildings(page);
    const own = placed.filter((entry) => entry.owner === 1 && entry.buildingType === 'barracks').sort((a, b) => a.id - b.id);
    expect(own.length, 'the fixture gives the human two Barracks').toBe(2);
    expect(placed.some((entry) => entry.owner === 2 && entry.buildingType === 'barracks'), 'the fixture gives player 2 a Barracks').toBe(true);
    for (const expected of [own[0]!, own[1]!, own[0]!]) {
      await lookAway(page, expected);
      await page.keyboard.press('Control+b');
      await expect.poll(() => selectedIds(page), { message: 'Ctrl+B did not go to the next Barracks of the human\'s' })
        .toEqual([expected.id]);
      await expect.poll(() => distanceFromCentre(page, expected)).toBeLessThan(4);
    }
  });

  test('each Ctrl+Shift+letter selects every building of its type the player owns and leaves the camera', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const placed = await buildings(page);
    await logKeys(page);
    for (const [key, buildingTypes] of SELECT_ALL_KEYS) {
      const own = placed.filter((entry) => entry.owner === 1 && buildingTypes.includes(entry.buildingType)).map((entry) => entry.id)
        .sort((a, b) => a - b);
      expect(own.length, `the fixture gives the human a ${buildingTypes.join(' or ')}`).toBeGreaterThan(0);
      await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
      const before = await cameraState(page);
      await page.keyboard.press(key);
      await expect.poll(() => selectedIds(page), { message: `${key} did not select every ${buildingTypes.join(', ')} of the human's` })
        .toEqual(own);
      await game.waitForRenderedFrames(page, 3, 100);
      expect(await cameraState(page), `${key} moved the camera`).toEqual(before);
    }
    const twoOrMore = SELECT_ALL_KEYS.filter(([, types]) => placed.filter((entry) => entry.owner === 1 && types.includes(entry.buildingType)).length > 1);
    expect(twoOrMore.map(([key]) => key), 'the fixture must hold two Barracks, two Town Centers and the military buildings')
      .toEqual(['Control+Shift+b', 'Control+Shift+h', 'Control+Shift+Space']);
    expect(await keyLog(page), 'the browser kept a select-all key').toEqual(SELECT_ALL_KEYS.map(([key]) => ({ code: codeOf(key), prevented: true })));
  });

  test('the panel shows a select-all key\'s buildings one icon each, as it shows a group of units', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    // The bar keeps one height and one top edge whatever is selected (spec §14.2).
    const bar = async () => page.evaluate(() => {
      const rect = document.querySelector('[data-hud="selection-panel"]')!.getBoundingClientRect();
      return { top: rect.top, height: rect.height };
    });
    await game.waitForRenderedFrames(page, 2);
    const empty = await bar();
    await page.keyboard.press('Control+Shift+Space');
    await expect(page.locator('[data-selection-name]')).toHaveText('7 Units Selected');
    await game.waitForRenderedFrames(page, 2);
    const grouped = await bar();
    expect(Math.abs(grouped.top - empty.top) + Math.abs(grouped.height - empty.height),
      `the bar moved or changed its height for a group of buildings: ${JSON.stringify({ empty, grouped })}`).toBeLessThanOrEqual(1);
    // DE's group panel: one icon per building (work 146 M2), where the panel
    // drew one chip per type with an "x2" count.
    const icons = page.locator('[data-selection-member]');
    await expect(icons, 'the group\'s buildings are not drawn in the panel').toHaveCount(7);
    const types = await icons.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-selection-member-type')));
    expect([...new Set(types)].sort()).toEqual([...MILITARY_BUILDINGS].sort());
    await expect(page.locator('[data-selection-member-type="barracks"]')).toHaveCount(2);
    await page.keyboard.press('Control+Shift+b');
    await expect(page.locator('[data-selection-name]')).toHaveText('2 Barracks Selected');
    await expect(page.locator('[data-selection-member-type="barracks"]')).toHaveCount(2);
  });

  test('a group of several building types shows its primary\'s card in DE\'s slot order, and the card\'s keys press it', async ({ page }) => {
    // Review round 9: the group has no shared type, and the card's keys and
    // slot order read the type from the group, so Q pressed nothing.
    await game.waitForPausedBootWithSeed(page, SEED);
    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    await page.keyboard.press('Control+Shift+Space');
    await expect(page.locator('[data-selection-name]')).toHaveText('7 Units Selected');
    const primary = (await game.getSelectionState(page)).selectedEntityId;
    const castle = (await buildings(page)).find((entry) => entry.id === primary);
    expect(castle?.buildingType, 'the primary of the group is its oldest building, the Castle').toBe('castle');
    // CASTLE_HOTKEYS: the unique unit Q (UNIQUE_UNIT), the Trebuchet W, the Petard E.
    await expect.poll(() => page.locator('[data-hud="selection-panel"] [data-command^="train-"]')
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-command'))))
      .toEqual(['train-longbowman', 'train-trebuchet', 'train-petard']);
    await page.keyboard.press('q');
    // The match is paused: the order is carried out on the next ticks.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(2, 100));
    await expect.poll(() => page.evaluate((id) => window.__AOE2_TEST__!.getEconomyState().buildings
      .find((building) => building.id === id)!.queue.map((entry) => entry.unitType), primary), {
      message: 'Q on the group\'s card did not train the Castle\'s unique unit',
    }).toEqual(['longbowman']);
  });

  test('on the default map Ctrl+Shift+H selects the Town Center, and a key with no building of its type changes nothing', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const townCenter = (await buildings(page)).find((entry) => entry.owner === 1 && entry.buildingType === 'town-center')!;
    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    const before = await cameraState(page);
    await page.keyboard.press('Control+Shift+h');
    await expect.poll(() => selectedIds(page), { message: 'Ctrl+Shift+H did not select the Town Center' }).toEqual([townCenter.id]);
    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    await logKeys(page);
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Control+Shift+b');
    await game.waitForRenderedFrames(page, 3, 100);
    expect(await selectedIds(page), 'a key for a building the player lacks selected something').toEqual([]);
    expect(await cameraState(page), 'a key for a building the player lacks moved the camera').toEqual(before);
    expect(await keyLog(page), 'the browser kept a key whose building the player lacks')
      .toEqual([{ code: 'KeyB', prevented: true }, { code: 'KeyB', prevented: true }]);
  });
});
