import { expect, test, type Page } from '@playwright/test';

import {
  SELECTION_CONTROLS_BOX_SHEEP,
  SELECTION_CONTROLS_BOX_VILLAGERS,
} from '../../src/game/simulation/fixtures/selectionControls';
import { SELECTION_CAP_BLOCK, SELECTION_CAP_WOUNDED } from '../../src/game/simulation/fixtures/selectionCap';
import * as game from './helpers/gameTestHelpers';

// Work 146 M2: Definitive Edition's group panel, by the real mouse and keyboard
// (spec §14.2; the sources are in docs/work/146_de-selection).
// - One icon per selected unit with its hit-point bar ("Learn to play", Lesson
//   5), sorted by type (a DE player, forum t/72939, 2020), all 60 of a full
//   selection at once (DE's cap; t/72939: "fitting more than 60 thumbnails" is
//   the only issue with a higher cap).
// - A click on an icon selects only that unit, Ctrl+click drops it,
//   Shift+click keeps its type and Ctrl+Shift+click drops its type (DE's
//   strings 43121-43122; AoK/HD's "Selection queue actions", openage).
// - A click held while the panel redraws still lands (the panel redraws on
//   every tick a building trains, and a press and a release on two drawings of
//   one button made no click).
// BOUND: the suite's 800x600 (the wrapped bar), 1280x720 (the unwrapped one)
// and 1280x600 (the unwrapped one clamped by a short window, review round 1);
// the selection-cap fixture's 64 Militia at zoom 0.8, three of them wounded;
// the selection-controls fixture's box of three villagers and a sheep; the
// default map's base; the default map's Town Center training.
const CAP = 'selection-cap-fixture';
const CONTROLS = 'selection-controls-fixture';
const DE_SELECTION_LIMIT = 60;
const MILITIA_HP = 40;
const MEMBER = '[data-selection-member]';

const selected = async (page: Page): Promise<number[]> => [...(await game.getSelectionState(page)).selectedEntityIds];

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

/** The panel's icons as drawn, in order: whose each is and its type. */
async function members(page: Page): Promise<Array<{ id: number; type: string }>> {
  return page.locator(MEMBER).evaluateAll((elements) => elements.map((element) => ({
    id: Number(element.getAttribute('data-selection-member')),
    type: element.getAttribute('data-selection-member-type') ?? '',
  })));
}

/** Clicks a unit's icon in the panel with the real mouse, refusing a point the
 *  icon does not own (another icon, a tooltip, the map). */
async function clickMember(page: Page, id: number): Promise<void> {
  const icon = page.locator(`[data-selection-member="${id}"]`);
  await expect(icon, `the panel draws no icon for unit ${id}`).toHaveCount(1);
  const box = (await icon.boundingBox())!;
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const owner = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-selection-member]')
    ?.getAttribute('data-selection-member') ?? null, point);
  expect(owner, `unit ${id}'s icon does not own its own centre (${Math.round(point.x)},${Math.round(point.y)})`).toBe(String(id));
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y);
}

/** Holds modifier keys down through a real mouse gesture, and lets them go. */
async function holding(page: Page, keys: readonly ('Shift' | 'Control')[], gesture: () => Promise<void>): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  try {
    await gesture();
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

/** Boxes the selection-controls fixture's three villagers and its sheep, by the real mouse. */
async function boxTheGroup(page: Page): Promise<number[]> {
  await game.dragSelectWorldRect(page, 13, 7, 16, 9);
  await page.mouse.up({ button: 'left' });
  await expect(page.locator('[data-selection-name]')).toHaveText('4 Units Selected');
  return selected(page);
}

/** Boxes 60 of the selection-cap fixture's 64 Militia, by the real mouse. */
async function boxSixtyMilitia(page: Page): Promise<number[]> {
  const block = SELECTION_CAP_BLOCK;
  await page.evaluate(({ x, y }) => {
    const api = window.__AOE2_TEST__!;
    api.setCameraZoom(0.8);
    api.centerCameraOnWorldPosition(x, y);
  }, { x: block.maxX, y: block.maxY });
  await game.waitForRenderedFrames(page, 2);
  await game.dragSelectWorldRect(page, block.minX, block.minY, block.maxX + 1, block.maxY + 1);
  await page.mouse.up({ button: 'left' });
  const ids = await selected(page);
  expect(ids, 'the box did not take DE\'s 60').toHaveLength(DE_SELECTION_LIMIT);
  await expect(page.locator('[data-selection-name]')).toHaveText(`${DE_SELECTION_LIMIT} Militia Selected`);
  return ids;
}

test.describe('the group panel as in DE (work 146 M2)', () => {
  for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1280, height: 600 }]) {
    test(`a selection of 60 draws 60 icons, each with its hit-point bar, inside the bar at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, CAP);
      const ids = await boxSixtyMilitia(page);
      await expect(page.locator(MEMBER)).toHaveCount(DE_SELECTION_LIMIT);
      expect((await members(page)).map((member) => member.id), 'the icons are not the selection, in its order').toEqual(ids);
      expect(new Set((await members(page)).map((member) => member.type))).toEqual(new Set(['militia']));

      // Every icon is drawn inside the bar's visible box, and the bar holds them
      // with no scroll, as do the stance and formation buttons beside them.
      const layout = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-hud="selection-panel"]')!;
        const box = panel.getBoundingClientRect();
        const inside = (element: Element): boolean => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && rect.left >= box.left && rect.right <= box.right
            && rect.top >= box.top && rect.bottom <= box.bottom;
        };
        const icons = [...panel.querySelectorAll('[data-selection-member]')];
        const commands = [...panel.querySelectorAll('[data-command^="stance-"], [data-command^="formation-"]')];
        return {
          outside: icons.filter((icon) => !inside(icon)).map((icon) => icon.getAttribute('data-selection-member')),
          commandsOutside: commands.filter((button) => !inside(button)).map((button) => button.getAttribute('data-command')),
          commands: commands.length,
          scroll: { scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight, scrollWidth: panel.scrollWidth, clientWidth: panel.clientWidth },
        };
      });
      expect(layout.outside, 'icons drawn outside the bar').toEqual([]);
      expect(layout.commands, 'the Militia\'s stance and formation buttons are drawn').toBe(8);
      expect(layout.commandsOutside, 'stance or formation buttons pushed outside the bar').toEqual([]);
      expect(layout.scroll.scrollHeight, `the bar scrolls to hold the group: ${JSON.stringify(layout.scroll)}`).toBeLessThanOrEqual(layout.scroll.clientHeight);
      expect(layout.scroll.scrollWidth).toBeLessThanOrEqual(layout.scroll.clientWidth);

      // Each icon's bar is its unit's hit points: three Militia stand wounded.
      const bars = await page.locator(MEMBER).evaluateAll((elements) => elements.map((element) => {
        const track = element.querySelector<HTMLElement>('[data-selection-member-hp]');
        const fill = track?.querySelector<HTMLElement>('[data-selection-member-hp-fill]');
        return {
          id: Number(element.getAttribute('data-selection-member')),
          hp: track?.getAttribute('data-selection-member-hp') ?? null,
          ratio: track && fill && track.getBoundingClientRect().width > 0
            ? fill.getBoundingClientRect().width / track.getBoundingClientRect().width
            : null,
        };
      }));
      const wounded = new Map<number, number>();
      for (const { cell, hp } of SELECTION_CAP_WOUNDED) wounded.set(await unitAt(page, 1, cell), hp);
      for (const bar of bars) {
        const hp = wounded.get(bar.id) ?? MILITIA_HP;
        expect(bar.hp, `unit ${bar.id}'s bar names the wrong hit points`).toBe(`${hp}/${MILITIA_HP}`);
        expect(bar.ratio, `unit ${bar.id}'s bar is not drawn`).not.toBeNull();
        expect(Math.abs(bar.ratio! - hp / MILITIA_HP), `unit ${bar.id}'s bar is ${bar.ratio} full at ${hp}/${MILITIA_HP}`).toBeLessThan(0.08);
      }
      expect(bars.filter((bar) => wounded.has(bar.id)), 'the wounded Militia are not in the selection').toHaveLength(SELECTION_CAP_WOUNDED.length);
    });
  }

  test('the stance and formation tiles stand where they stood whatever the group\'s size, at 800x600', async ({ page }) => {
    // Below 1120px the icons sit ahead of the deck, and a group that loses
    // units in a fight must not move the tiles under the player's cursor.
    await game.waitForPausedBootWithSeed(page, CAP);
    const block = SELECTION_CAP_BLOCK;
    const stance = async (): Promise<number[]> => page.evaluate(() => {
      const rect = document.querySelector('[data-command="stance-aggressive"]')!.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    });
    await page.evaluate(({ x, y }) => {
      const api = window.__AOE2_TEST__!;
      api.setCameraZoom(0.8);
      api.centerCameraOnWorldPosition(x, y);
    }, { x: block.maxX, y: block.maxY });
    await game.waitForRenderedFrames(page, 2);
    // A small box: one row of icons (sixteen fit a row at this size).
    await game.dragSelectWorldRect(page, block.minX, block.minY + 3, block.minX + 2, block.minY + 4);
    await page.mouse.up({ button: 'left' });
    const few = (await selected(page)).length;
    expect(few, 'the small box took no group of one row').toBeGreaterThanOrEqual(2);
    expect(few, 'the small box took no group of one row').toBeLessThanOrEqual(16);
    await expect(page.locator('[data-selection-name]')).toHaveText(`${few} Militia Selected`);
    await game.waitForRenderedFrames(page, 2);
    const forFew = await stance();
    await boxSixtyMilitia(page);
    await game.waitForRenderedFrames(page, 2);
    expect(await stance(), `the stance tiles moved between a group of ${few} and a group of sixty`).toEqual(forFew);
  });

  for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }]) {
    test(`a group's heading keeps its height whatever the group's work, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      // Review round 2: the work line wrapped onto three lines pushed the
      // icons out of the band above 1120px and the tiles under the line below.
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, CAP);
      await boxSixtyMilitia(page);
      await game.waitForRenderedFrames(page, 2);
      const layout = async () => page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('[data-hud="selection-panel"]')!;
        const rect = (element: Element | null | undefined): number[] => {
          const box = element!.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height];
        };
        return {
          heading: rect(panel.querySelector('.hud-selection-heading')),
          lastIcon: rect([...panel.querySelectorAll('[data-selection-member]')].at(-1)),
          stance: rect(panel.querySelector('[data-command="stance-aggressive"]')),
          scrolls: panel.scrollHeight > panel.clientHeight,
        };
      });
      const idle = await layout();
      // No fixture reaches five kinds of work at once, the most the breakdown
      // lists (selectionActivity.ts), so the longest such line is written into
      // the paused panel, which does not redraw while nothing changes.
      await page.evaluate(() => {
        document.querySelector('[data-selection-activity-multi]')!.textContent = '12 attacking · 12 building · 12 gathering · 12 dropping off · 12 moving · …';
      });
      const working = await layout();
      expect(working.heading[3], 'the heading grew with its work').toBe(idle.heading[3]);
      expect(working.lastIcon, 'the icons moved with the heading\'s work').toEqual(idle.lastIcon);
      expect(working.stance, 'the stance tiles moved with the heading\'s work').toEqual(idle.stance);
      expect(working.scrolls, 'the bar scrolls with the heading\'s work').toBe(false);
    });
  }

  test('a box over the default map\'s base draws its units sorted by type', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    // The screen rectangle around every unit and sheep of the human's, padded.
    const box = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const points = api.getDisplayedEntities()
        .filter((entity) => entity.owner === 1 && (entity.kind === 'unit' || entity.entityType === 'sheep'))
        .map((entity) => api.worldToScreen(entity.x, entity.y));
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      return { x0: Math.min(...xs) - 30, y0: Math.min(...ys) - 50, x1: Math.max(...xs) + 30, y1: Math.max(...ys) + 20 };
    });
    for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y1]] as const) {
      const onCanvas = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('voxel-world-canvas') ?? false, { x, y });
      expect(onCanvas, `the box corner (${Math.round(x)},${Math.round(y)}) is under the HUD`).toBe(true);
    }
    await page.mouse.move(box.x0, box.y0);
    await page.mouse.down();
    await page.mouse.move((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, { steps: 4 });
    await page.mouse.move(box.x1, box.y1, { steps: 4 });
    await page.mouse.up();
    const ids = await selected(page);
    const kinds = await page.evaluate((list) => {
      const economy = window.__AOE2_TEST__!.getEconomyState();
      return list.map((id) => economy.units.find((unit) => unit.id === id)?.unitType
        ?? economy.resources.find((resource) => resource.id === id)?.resourceType ?? '?');
    }, ids);
    const runs = (list: readonly string[]): string[] => list.filter((kind, index) => index === 0 || list[index - 1] !== kind);
    expect(new Set(kinds), 'the box took the base\'s villagers, Scout and sheep').toEqual(new Set(['villager', 'scout', 'sheep']));
    expect(runs(kinds).length, `the box listed its units by type already (${kinds.join(', ')}), so this case shows nothing`).toBeGreaterThan(3);
    // The HUD draws a selection on its next frame (work 146 M2's full gate read
    // the panel before it, under load).
    await expect(page.locator('[data-selection-name]')).toHaveText(`${ids.length} Units Selected`);
    const drawn = await members(page);
    expect(drawn.map((member) => member.id).sort(), 'the icons are not the selection').toEqual([...ids].sort());
    // Each type's icons together, the types where the selection first lists them.
    expect(runs(drawn.map((member) => member.type)), `the icons are not sorted by type: ${drawn.map((member) => member.type).join(', ')}`)
      .toEqual([...new Set(kinds)]);
  });

  test('a click on an icon selects only that unit, and Ctrl+click takes it out', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const villagers = await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(page, 1, cell)));
    const sheep = await sheepAt(page, SELECTION_CONTROLS_BOX_SHEEP);
    const boxed = await boxTheGroup(page);
    expect([...boxed].sort()).toEqual([...villagers, sheep].sort());
    // One icon per unit, the villagers together and the sheep after them.
    expect(await members(page)).toEqual([
      ...boxed.filter((id) => id !== sheep).map((id) => ({ id, type: 'villager' })),
      { id: sheep, type: 'sheep' },
    ]);
    const tooltip = await page.locator(`[data-selection-member="${villagers[0]}"]`).getAttribute('data-tooltip');
    expect(tooltip).toBe('Click to select only this Villager. Hold down CTRL and click to unselect this unit. '
      + 'Hold down SHIFT and click to select all units of this type. Hold down CTRL+SHIFT and click to unselect all units of this type.');

    await holding(page, ['Control'], () => clickMember(page, villagers[1]!));
    expect(await selected(page), 'Ctrl+click on an icon did not take its unit out').toEqual(boxed.filter((id) => id !== villagers[1]));
    await expect(page.locator('[data-selection-name]')).toHaveText('3 Units Selected');
    await expect(page.locator(MEMBER)).toHaveCount(3);

    await clickMember(page, villagers[2]!);
    expect(await selected(page), 'a click on an icon did not select only its unit').toEqual([villagers[2]]);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
  });

  test('Shift+click on an icon keeps its type, and Ctrl+Shift+click takes its type out', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, CONTROLS);
    const villagers = await Promise.all(SELECTION_CONTROLS_BOX_VILLAGERS.map((cell) => unitAt(page, 1, cell)));
    const sheep = await sheepAt(page, SELECTION_CONTROLS_BOX_SHEEP);
    const boxed = await boxTheGroup(page);

    await holding(page, ['Shift'], () => clickMember(page, villagers[0]!));
    expect(await selected(page), 'Shift+click on a villager\'s icon did not keep only the villagers')
      .toEqual(boxed.filter((id) => id !== sheep));
    await expect(page.locator('[data-selection-name]')).toHaveText('3 Villagers Selected');

    const again = await boxTheGroup(page);
    await holding(page, ['Control', 'Shift'], () => clickMember(page, villagers[1]!));
    expect(await selected(page), 'Ctrl+Shift+click on a villager\'s icon did not take every villager out').toEqual([sheep]);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    expect(again).toEqual(boxed);

    await boxTheGroup(page);
    await holding(page, ['Shift'], () => clickMember(page, sheep));
    expect(await selected(page), 'Shift+click on the sheep\'s icon did not keep only the sheep').toEqual([sheep]);
  });

  test('a click held on the card while the panel redraws still lands', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('h');
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    const train = page.locator('[data-command="train-villager"]');
    await train.click();
    await expect.poll(async () => (await game.getSelectionState(page)).queue.length).toBe(1);

    // Pressed, then held until the villager in training has moved on since the
    // press and frames have been drawn after it, which redraws the panel;
    // released over the same button. The button's centre is read in one task
    // of the page's, as the panel redraws on every tick here. Review round 1:
    // the moment of the press is read after the press, or ticks before it
    // could count.
    const centre = await page.evaluate(() => {
      const rect = document.querySelector('[data-command="train-villager"]')!.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    });
    const remaining = async (): Promise<number> => (await game.getSelectionState(page)).queue[0]?.remainingTicks ?? -1;
    await page.mouse.move(centre.x, centre.y);
    await page.mouse.down();
    try {
      const atPress = await remaining();
      await expect.poll(remaining, { message: 'the villager in training did not move on while the button was held' })
        .toBeLessThan(atPress);
      await game.waitForRenderedFrames(page, 3);
    } finally {
      await page.mouse.up();
    }
    await expect.poll(async () => (await game.getSelectionState(page)).queue.length, {
      message: 'a click held through the panel\'s redraw did not queue a villager',
    }).toBe(2);
  });
});
