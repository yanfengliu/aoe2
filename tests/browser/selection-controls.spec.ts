import { expect, test, type Page } from '@playwright/test';

import {
  SELECTION_CONTROLS_BOX_SHEEP,
  SELECTION_CONTROLS_BOX_VILLAGERS,
  SELECTION_CONTROLS_HIDDEN_SHEEP,
  SELECTION_CONTROLS_MIXED_BOX,
  SELECTION_CONTROLS_OFF_SCREEN_VILLAGER,
  SELECTION_CONTROLS_SHARED_CELL,
} from '../../src/game/simulation/fixtures/selectionControls';
import * as game from './helpers/gameTestHelpers';

// Work 142, M1: selecting and commanding with the mouse as Definitive Edition
// does, by real clicks on the paused selection-controls fixture (spec §9.4,
// §14.5; the rules and their sources are in docs/work/142_selection-controls).
// - A live animal is a unit in DE: hidden by a building it is drawn as an
//   outline, and a left or right click on its drawn body reaches it. Before
//   work 142 a sheep was a resource here: no outline, and the Town Center
//   took the click (the coordinator's play, 2026-11-04).
// - DE's box takes every unit of yours inside it, livestock too, and never
//   another player's unit, an animal of nobody's, a resource or a building.
// - A double-click is two quick clicks at one place, and it takes the units of
//   that type drawn on screen.
// BOUND: one fixture at the suite's 800x600 and boot framing; one sheep behind
// one Town Center; villagers only for the double-click.
const SEED = 'selection-controls-fixture';

async function unitIdAt(page: Page, owner: number, unitType: string, cell: { x: number; y: number }): Promise<number[]> {
  return page.evaluate(({ owner, unitType, cell }) => window.__AOE2_TEST__!.getEconomyState().units
    .filter((unit) => unit.owner === owner && unit.unitType === unitType && unit.x === cell.x && unit.y === cell.y)
    .map((unit) => unit.id), { owner, unitType, cell });
}

async function sheepAt(page: Page, cell: { x: number; y: number }): Promise<number> {
  const id = await page.evaluate((cell) => window.__AOE2_TEST__!.getEconomyState().resources
    .find((resource) => resource.resourceType === 'sheep' && resource.x === cell.x && resource.y === cell.y)?.id ?? null, cell);
  expect(id, `no sheep stands on (${cell.x},${cell.y})`).not.toBeNull();
  return id!;
}

async function sheepFood(page: Page, id: number): Promise<number> {
  return page.evaluate((id) => window.__AOE2_TEST__!.getEconomyState().resources
    .find((resource) => resource.id === id)?.amount ?? -1, id);
}

// The click stack up the sheep's body, front first: proof the fixture hides
// it behind the Town Center, read the same way the click would read it.
async function townCenterDrawnOverSheep(page: Page, id: number): Promise<boolean> {
  return page.evaluate((id) => {
    const api = window.__AOE2_TEST__!;
    const shown = api.getDisplayedEntities().find((entity) => entity.id === id)!;
    for (let isoY = 0; isoY >= -40; isoY -= 1) {
      const stack = api.getClickStackAtWorldPosition(shown.x + 0.5 + isoY / 32, shown.y + 0.5 + isoY / 32);
      const sheep = stack.findIndex((entity) => entity.id === id);
      const townCenter = stack.findIndex((entity) => entity.entityType === 'town-center');
      if (sheep >= 0 && townCenter >= 0) return true;
    }
    return false;
  }, id);
}

async function stepUntil(page: Page, ticks: number, done: () => Promise<boolean>): Promise<boolean> {
  for (let stepped = 0; stepped < ticks; stepped += 10) {
    if (await done()) return true;
    await page.evaluate(() => { window.__AOE2_TEST__!.stepTicks(10, 100); });
  }
  return done();
}

test.describe('selection and targeting as in DE (work 142)', () => {
  test('a sheep the Town Center hides is drawn as an outline, and a left click on it selects it', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const sheep = await sheepAt(page, SELECTION_CONTROLS_HIDDEN_SHEEP);
    expect(await townCenterDrawnOverSheep(page, sheep), 'the fixture no longer hides the sheep behind the Town Center').toBe(true);

    const outlined = await page.evaluate(() => window.__AOE2_TEST__!.getOccludedUnitStates().map((unit) => unit.id));
    expect(outlined, 'a hidden sheep is drawn as an outline, as a hidden unit is').toContain(sheep);

    await game.clickUnit(page, sheep);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    expect((await game.getSelectionState(page)).selectedEntityIds).toEqual([sheep]);
  });

  test('a right-click on a sheep the Town Center hides puts the selected villager to work on it', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const sheep = await sheepAt(page, SELECTION_CONTROLS_HIDDEN_SHEEP);
    const [villager] = await unitIdAt(page, 1, 'villager', SELECTION_CONTROLS_BOX_VILLAGERS[2]);
    await game.clickUnit(page, villager!);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');

    await game.clickUnit(page, sheep, 'right');
    const eaten = await stepUntil(page, 600, async () => (await sheepFood(page, sheep)) < 100);
    expect(eaten, 'the villager never took food from the sheep it was right-clicked onto').toBe(true);
  });

  test('a gather point set on a sheep the Town Center hides puts the next villager to work on it', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const sheep = await sheepAt(page, SELECTION_CONTROLS_HIDDEN_SHEEP);
    // The Town Center by its middle: nothing else is drawn there.
    const middle = await page.evaluate(() => window.__AOE2_TEST__!.getClickStackAtWorldPosition(10, 10).map((e) => e.entityType));
    expect(middle[0]).toBe('town-center');
    await game.clickWorldPosition(page, 10, 10);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');

    await game.clickUnit(page, sheep, 'right');
    await page.locator('[data-command="train-villager"]').click();
    const villagersBefore = (await game.getEconomyState(page)).units.filter((unit) => unit.owner === 1 && unit.unitType === 'villager').length;
    const trained = await stepUntil(page, 600, async () => (await game.getEconomyState(page)).units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'villager').length > villagersBefore);
    expect(trained, 'the Town Center trained no villager').toBe(true);
    const eaten = await stepUntil(page, 400, async () => (await sheepFood(page, sheep)) < 100);
    expect(eaten, 'the new villager never took food from the sheep its gather point was set on').toBe(true);
  });

  test('a box takes every unit of yours inside it, the sheep among them too, and names the group by its count', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const villagers = (await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitIdAt(page, 1, 'villager', cell)))).flat();
    const sheep = await sheepAt(page, SELECTION_CONTROLS_BOX_SHEEP);
    await game.dragSelectWorldRect(page, 13, 7, 16, 9);
    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText('4 Units Selected');
    expect([...(await game.getSelectionState(page)).selectedEntityIds].sort()).toEqual([...villagers, sheep].sort());
    await expect(page.locator('[data-selection-unit-count="villager"]')).toHaveText('x3');
    await expect(page.locator('[data-selection-unit-chip="sheep"]')).toHaveCount(1);
  });

  test('a box never takes another player\'s unit, a wild animal, a tree or a building', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const [villager] = await unitIdAt(page, 1, 'villager', SELECTION_CONTROLS_MIXED_BOX.villager);
    await game.dragSelectWorldRect(page, 5, 12, 7, 14);
    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect((await game.getSelectionState(page)).selectedEntityIds).toEqual([villager]);
  });

  test('two quick clicks on two villagers in one cell are two clicks, not a double-click', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const pair = await unitIdAt(page, 1, 'villager', SELECTION_CONTROLS_SHARED_CELL);
    expect(pair, 'the fixture puts two villagers in one cell').toHaveLength(2);
    // Points on the two bodies that a click takes first, far enough apart to be
    // two places and inverting to one ground cell: the case the old rule, "the
    // same ground cell", read as one double-click.
    const points = await page.evaluate((ids) => {
      const api = window.__AOE2_TEST__!;
      const column = (id: number) => {
        const shown = api.getDisplayedEntities().find((entity) => entity.id === id)!;
        const out: Array<{ wx: number; wy: number; cell: string }> = [];
        for (let isoY = 0; isoY >= -40; isoY -= 1) {
          const wx = shown.x + 0.5 + isoY / 32;
          const wy = shown.y + 0.5 + isoY / 32;
          // A tenth of a cell clear of every cell edge, so the pointer's own
          // inversion of the pixel cannot round it into the next cell.
          const clear = [wx, wy].every((value) => value - Math.floor(value) >= 0.1 && value - Math.floor(value) <= 0.9);
          if (clear && api.getClickStackAtWorldPosition(wx, wy)[0]?.id === id) {
            out.push({ wx, wy, cell: `${Math.floor(wx)},${Math.floor(wy)}` });
          }
        }
        return out;
      };
      const first = column(ids[0]!);
      const second = column(ids[1]!);
      for (const a of first) {
        for (const b of second) {
          const sa = api.worldToScreen(a.wx - 0.5, a.wy - 0.5);
          const sb = api.worldToScreen(b.wx - 0.5, b.wy - 0.5);
          if (a.cell === b.cell && Math.hypot(sa.x - sb.x, sa.y - sb.y) >= 10) return [sa, sb];
        }
      }
      return null;
    }, pair);
    expect(points, 'no two points on the two bodies share a ground cell 10 px apart').not.toBeNull();
    // Both clicks leave without waiting for the page, so they are milliseconds
    // apart on any host, well inside the double-click window (browser-specs
    // rule, 2026-09-23).
    const cdp = await page.context().newCDPSession(page);
    const sends = points!.flatMap(({ x, y }) => [
      cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 }),
      cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }),
      cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }),
    ]);
    await Promise.all(sends);
    await cdp.detach();

    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect((await game.getSelectionState(page)).selectedEntityIds).toEqual([pair[1]]);
  });

  test('a double-click takes the villagers drawn on screen and none beyond its edge', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, SEED);
    const [outside] = await unitIdAt(page, 1, 'villager', SELECTION_CONTROLS_OFF_SCREEN_VILLAGER);
    const view = await page.evaluate((outside) => {
      const api = window.__AOE2_TEST__!;
      const canvas = document.querySelector('.voxel-world-canvas')!.getBoundingClientRect();
      const corners = api.getCameraState()!.viewCorners;
      const shown = api.getDisplayedEntities()
        .filter((entity) => entity.kind === 'unit' && entity.owner === 1 && entity.entityType === 'villager');
      const onScreen = shown.filter((entity) => {
        const point = api.worldToScreen(entity.x, entity.y);
        return point.x >= canvas.left && point.x <= canvas.right && point.y >= canvas.top && point.y <= canvas.bottom;
      }).map((entity) => entity.id);
      const off = shown.find((entity) => entity.id === outside)!;
      const inCornerBox = off.x >= Math.min(...corners.map((c) => c.cellX)) && off.y >= Math.min(...corners.map((c) => c.cellY));
      const offPoint = api.worldToScreen(off.x, off.y);
      return { onScreen, inCornerBox, offTop: offPoint.y < canvas.top - 30 };
    }, outside!);
    expect(view.offTop, 'the fixture\'s villager at (0,0) must stand above the top edge, body and all').toBe(true);
    expect(view.inCornerBox, 'and inside the cell box of the view\'s corners, where the old rule looked').toBe(true);
    expect(view.onScreen).not.toContain(outside);

    const [target] = await unitIdAt(page, 1, 'villager', SELECTION_CONTROLS_BOX_VILLAGERS[0]);
    const point = await game.getUnitClickPoint(page, target!);
    await page.mouse.move(point.x, point.y);
    await page.mouse.dblclick(point.x, point.y);

    await expect(page.locator('[data-selection-name]')).toHaveText(`${view.onScreen.length} Villagers Selected`);
    expect([...(await game.getSelectionState(page)).selectedEntityIds].sort()).toEqual([...view.onScreen].sort());
  });
});
