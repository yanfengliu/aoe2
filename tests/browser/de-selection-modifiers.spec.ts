import { expect, test, type Page } from '@playwright/test';

import {
  SELECTION_CONTROLS_BOX_SHEEP,
  SELECTION_CONTROLS_BOX_VILLAGERS,
  SELECTION_CONTROLS_MIXED_BOX,
} from '../../src/game/simulation/fixtures/selectionControls';
import { SELECTION_CAP_BLOCK } from '../../src/game/simulation/fixtures/selectionCap';
import * as game from './helpers/gameTestHelpers';

// Work 146 M1: DE's modifier clicks and drags and its selection cap, by the
// real mouse and keyboard on paused fixtures (spec §9.4; the sources are in
// docs/work/146_de-selection).
// - Shift adds to the selection, by a click or a box ("Learn to play", Lesson
//   1). Here a Shift+click on a selected unit keeps it, and one on the ground or
//   on something a box cannot take changes nothing (unsourced; Shift only adds).
// - Ctrl+click takes a selected unit out (forums.ageofempires.com t/74555), and
//   on anything else changes nothing (a DE player, Steam 2019: holding Ctrl,
//   "only the ones i already selected remain").
// - A selection holds at most 60 (forum thread 226116, 2023).
// BOUND: the suite's 800x600; the selection-controls fixture at its boot
// framing, and the selection-cap fixture's 64 Militia at zoom 0.8.
const CONTROLS = 'selection-controls-fixture';
const CAP = 'selection-cap-fixture';
const DE_SELECTION_LIMIT = 60;
// A ground cell of the selection-controls fixture with nothing on it, on screen.
const EMPTY_GROUND = { x: 11.5, y: 3.5 } as const;

async function unitAt(page: Page, owner: number, cell: { x: number; y: number }): Promise<number> {
  const id = await page.evaluate(({ owner, cell }) => window.__AOE2_TEST__!.getEconomyState().units
    .find((unit) => unit.owner === owner && unit.x === cell.x && unit.y === cell.y)?.id ?? null, { owner, cell });
  expect(id, `no unit of player ${owner} on (${cell.x},${cell.y})`).not.toBeNull();
  return id!;
}

async function sheepAt(page: Page, cell: { x: number; y: number }): Promise<number> {
  const id = await page.evaluate((cell) => window.__AOE2_TEST__!.getEconomyState().resources
    .find((resource) => resource.resourceType === 'sheep' && resource.x === cell.x && resource.y === cell.y)?.id ?? null, cell);
  expect(id, `no sheep on (${cell.x},${cell.y})`).not.toBeNull();
  return id!;
}

const selected = async (page: Page): Promise<number[]> => [...(await game.getSelectionState(page)).selectedEntityIds];

/** Clicks the unit where the world canvas draws it, refusing a point a HUD
 *  panel covers: a click there would change nothing, and "changed nothing"
 *  is what several of these cases assert. */
async function clickUnitOnCanvas(page: Page, id: number): Promise<void> {
  await clickOnCanvas(page, await game.getUnitClickPoint(page, id), `unit ${id}`);
}

async function clickOnCanvas(page: Page, point: { x: number; y: number }, what: string): Promise<void> {
  const onCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('voxel-world-canvas') ?? false, point);
  expect(onCanvas, `${what}'s click point (${Math.round(point.x)},${Math.round(point.y)}) is under the HUD`).toBe(true);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}

/** Clicks the empty ground cell on the world canvas. */
async function clickEmptyGround(page: Page): Promise<void> {
  const point = await page.evaluate((cell) => window.__AOE2_TEST__!.worldToScreen(cell.x - 0.5, cell.y - 0.5), EMPTY_GROUND);
  await clickOnCanvas(page, point, 'the empty ground');
}

/** Holds a modifier key down through a real mouse gesture, and lets it go. */
async function holding(page: Page, key: 'Shift' | 'Control', gesture: () => Promise<void>): Promise<void> {
  await page.keyboard.down(key);
  try {
    await gesture();
  } finally {
    await page.keyboard.up(key);
  }
}

/** Nothing the human owns stands on the empty ground cell the tests click. */
async function expectEmptyGround(page: Page): Promise<void> {
  const stack = await page.evaluate((cell) => window.__AOE2_TEST__!.getClickStackAtWorldPosition(cell.x, cell.y).map((entity) => entity.id), EMPTY_GROUND);
  expect(stack, 'the ground cell the tests click holds nothing').toEqual([]);
}

test.describe('selecting with Shift and Ctrl as in DE (work 146)', () => {
  test('Shift+click adds a unit to the selection, and Shift+click on a selected unit keeps it', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const [a, b] = await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.slice(0, 2).map((cell) => unitAt(page, 1, cell)));
    await clickUnitOnCanvas(page, a!);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');

    await holding(page, 'Shift', () => clickUnitOnCanvas(page, b!));
    expect(await selected(page), 'Shift+click did not add the second villager').toEqual([a, b]);
    await expect(page.locator('[data-selection-name]')).toHaveText('2 Villagers Selected');

    await holding(page, 'Shift', () => clickUnitOnCanvas(page, a!));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Shift+click on a selected villager changed the selection').toEqual([a, b]);
  });

  test('Shift+drag adds the units in the box to the selection, and an empty Shift box keeps it', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const first = await unitAt(page, 1, SELECTION_CONTROLS_MIXED_BOX.villager);
    const boxed = [
      ...(await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(page, 1, cell)))),
      await sheepAt(page, SELECTION_CONTROLS_BOX_SHEEP),
    ];
    await clickUnitOnCanvas(page, first);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');

    await holding(page, 'Shift', async () => {
      await game.dragSelectWorldRect(page, 13, 7, 16, 9);
      await page.mouse.up({ button: 'left' });
    });
    const afterBox = await selected(page);
    expect(afterBox[0], 'the Shift box dropped what was selected').toBe(first);
    expect([...afterBox].sort(), 'Shift+drag did not add the box to the selection').toEqual([first, ...boxed].sort());
    await expect(page.locator('[data-selection-name]')).toHaveText('5 Units Selected');

    await expectEmptyGround(page);
    await holding(page, 'Shift', async () => {
      await game.dragSelectWorldRect(page, EMPTY_GROUND.x - 0.4, EMPTY_GROUND.y - 0.4, EMPTY_GROUND.x + 0.4, EMPTY_GROUND.y + 0.4);
      await page.mouse.up({ button: 'left' });
    });
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'an empty Shift box changed the selection').toEqual(afterBox);
  });

  test('Shift+click on the ground or on another player\'s unit keeps the selection', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const mine = await unitAt(page, 1, SELECTION_CONTROLS_BOX_VILLAGERS[0]);
    const theirs = await unitAt(page, 2, SELECTION_CONTROLS_MIXED_BOX.enemyVillager);
    await clickUnitOnCanvas(page, mine);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');

    await holding(page, 'Shift', () => clickUnitOnCanvas(page, theirs));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Shift+click on another player\'s villager changed the selection').toEqual([mine]);

    await expectEmptyGround(page);
    await holding(page, 'Shift', () => clickEmptyGround(page));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Shift+click on the ground changed the selection').toEqual([mine]);
  });

  test('Ctrl+click takes a selected unit out, and on anything else changes nothing', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const [a, b, c] = await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(page, 1, cell)));
    const sheep = await sheepAt(page, SELECTION_CONTROLS_BOX_SHEEP);
    const outside = await unitAt(page, 1, SELECTION_CONTROLS_MIXED_BOX.villager);
    await game.dragSelectWorldRect(page, 13, 7, 16, 9);
    await page.mouse.up({ button: 'left' });
    await expect(page.locator('[data-selection-name]')).toHaveText('4 Units Selected');
    const boxed = await selected(page);

    await holding(page, 'Control', () => clickUnitOnCanvas(page, b!));
    expect(await selected(page), 'Ctrl+click did not take the selected villager out').toEqual(boxed.filter((id) => id !== b));
    await expect(page.locator('[data-selection-name]')).toHaveText('3 Units Selected');
    expect([...(await selected(page))].sort()).toEqual([a, c, sheep].sort());

    await holding(page, 'Control', () => clickUnitOnCanvas(page, outside));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Ctrl+click on a villager not selected changed the selection').toEqual(boxed.filter((id) => id !== b));

    await expectEmptyGround(page);
    await holding(page, 'Control', () => clickEmptyGround(page));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Ctrl+click on the ground changed the selection').toEqual(boxed.filter((id) => id !== b));
  });

  test('a box over 64 Militia selects 60, and Shift adds a 61st only once Ctrl has dropped one', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CAP);
    const block = SELECTION_CAP_BLOCK;
    // Zoomed out and centred on the block's front corner, the whole block is
    // drawn between the top bar and the panel a selection of 60 opens.
    await page.evaluate(({ x, y }) => {
      const api = window.__AOE2_TEST__!;
      api.setCameraZoom(0.8);
      api.centerCameraOnWorldPosition(x, y);
    }, { x: block.maxX, y: block.maxY });
    await game.waitForRenderedFrames(page, 2);
    const byRow = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'militia')
      .sort((left, right) => left.y - right.y || left.x - right.x || left.id - right.id)
      .map((unit) => unit.id));
    expect(byRow, 'the fixture gives the human 64 Militia').toHaveLength(64);

    await game.dragSelectWorldRect(page, block.minX, block.minY, block.maxX + 1, block.maxY + 1);
    await page.mouse.up({ button: 'left' });
    // The box lists the Militia by where each is drawn, row by row, which a
    // sub-cell offset can reorder within a row; which 60 it keeps is its own.
    const first60 = await selected(page);
    expect(first60, 'the box did not stop at DE\'s 60').toHaveLength(DE_SELECTION_LIMIT);
    expect(byRow, 'the box took something other than the Militia').toEqual(expect.arrayContaining(first60));
    await expect(page.locator('[data-selection-name]')).toContainText(`${DE_SELECTION_LIMIT} `);

    // The front-most of the four left out, so nothing is drawn over it.
    const leftOut = await page.evaluate((chosen) => window.__AOE2_TEST__!.getEconomyState().units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'militia' && !chosen.includes(unit.id))
      .sort((left, right) => (right.x + right.y) - (left.x + left.y) || right.x - left.x)[0]!.id, first60);
    await holding(page, 'Shift', () => clickUnitOnCanvas(page, leftOut));
    await game.waitForRenderedFrames(page, 2);
    expect(await selected(page), 'Shift+click added a 61st unit').toEqual(first60);

    const dropped = await unitAt(page, 1, { x: block.maxX, y: block.minY });
    expect(first60, 'the box took the block\'s right-hand corner').toContain(dropped);
    await holding(page, 'Control', () => clickUnitOnCanvas(page, dropped));
    expect((await selected(page)).length, 'Ctrl+click did not take a Militia out').toBe(DE_SELECTION_LIMIT - 1);
    await holding(page, 'Shift', () => clickUnitOnCanvas(page, leftOut));
    const after = await selected(page);
    expect(after, 'with room again, Shift+click did not add the Militia').toContain(leftOut);
    expect(after).not.toContain(dropped);
    expect(after).toHaveLength(DE_SELECTION_LIMIT);
  });
});
