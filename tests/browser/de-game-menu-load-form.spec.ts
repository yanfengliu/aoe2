// Load Game opens its form under its own row, in view (work 148, spec §14.1).
//
// Before work 148 the form opened after the Settings rows, which in the
// icon-only menu left 143px of its 214px in view at 1280x720 and 23px at
// 800x600, its Restore and Cancel buttons below the panel's edge at both, and
// it widened the panel from 280px to 326px. A one-column menu is taller, so
// there the form would have opened wholly out of sight. It is now the next
// thing under the Load Game row: in view at the three sizes measured here (a
// window under 522px tall cuts its foot), the panel as wide as it was, the row that opened it and everything above it where they were (the
// panel hangs from a fixed top and grows downward), the Tab order following
// what is drawn.
//
// The last case holds what did NOT change, measured on v0.3.280: the click
// leaves focus on the Load button, Escape closes the menu and leaves the form
// open inside it, and the menu reopens with focus on its first action.
//
// Bound: three window sizes, the form with its paste box (no browser save
// exists in a fresh context, so "From pasted JSON" is the selected source); a
// successful Restore is held by game-combat-and-meta-meta.spec.ts, not here.
// The menu's other cases are de-game-menu.spec.ts and
// de-game-menu-text-room.spec.ts.
import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  MENU_ACTIONS,
  MENU_SIZES,
  clickName,
  expectSameBox,
  expectWholePixels,
  openMenu,
  readMenu,
  rowOf,
} from './helpers/gameMenu';

test.describe('Load Game opens its form under its own row', () => {
  for (const size of MENU_SIZES) {
    test(`at ${size.width}x${size.height} Load Game opens its form under its own row, in view`, async ({ page }) => {
      await openMenu(page, size);
      const before = await readMenu(page);
      const loadRowBefore = rowOf(before, 'load-button');

      await clickName(page, 'load-button');
      await expect(page.locator('[data-hud="load-panel"]')).toBeVisible();
      const form = await page.evaluate(() => {
        const panel = document.querySelector<HTMLElement>('.hud-game-menu__panel')!.getBoundingClientRect();
        const read = (hook: string) => {
          const element = document.querySelector<HTMLElement>(`[data-hud="${hook}"]`)!;
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
          return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            inPanelView: rect.top >= panel.top && rect.bottom <= panel.bottom && rect.left >= panel.left && rect.right <= panel.right,
            takesPointer: hit !== null && element.contains(hit),
          };
        };
        return {
          form: read('load-panel'),
          restore: read('load-confirm'),
          cancel: read('load-cancel'),
          focus: document.activeElement?.getAttribute('data-hud') ?? null,
          surface: (() => {
            const style = getComputedStyle(document.querySelector<HTMLElement>('[data-hud="load-panel"]')!);
            return { shadow: style.boxShadow, backdrop: style.backdropFilter };
          })(),
        };
      });
      const after = await readMenu(page);
      const loadRowAfter = rowOf(after, 'load-button');
      console.log(`[menu-load] ${size.width}x${size.height}: the form is ${(form.form.bottom - form.form.top).toFixed(1)}px tall, `
        + `${(form.form.top - loadRowAfter.box.bottom).toFixed(1)}px under Load Game, and ends `
        + `${(after.panel.bottom - form.form.bottom).toFixed(1)}px above the panel's end`);

      // The form is the next thing under the row that opened it, whole inside
      // the panel's view, and its two buttons take the pointer.
      expect(form.form.top, 'the form starts under the Load Game row').toBeGreaterThanOrEqual(loadRowAfter.box.bottom);
      expect(form.form.top - loadRowAfter.box.bottom, 'directly under it').toBeLessThanOrEqual(12);
      expect(form.form.inPanelView, 'the whole form is in the panel\'s view').toBe(true);
      for (const [name, button] of [['Restore', form.restore], ['Cancel', form.cancel]] as const) {
        expect(button.inPanelView, `${name} is in the panel's view`).toBe(true);
        expect(button.bottom, `${name} is inside the window`).toBeLessThanOrEqual(size.height);
        expect(button.takesPointer, `${name} takes the pointer`).toBe(true);
      }
      // The form is a section of the list, not a surface floating over it. As
      // a dialog surface it carried the modal drop shadow and a backdrop blur,
      // which made it a layer painted over the rows under it: its shadow fell
      // on the first of them and dimmed its name (seen in a capture; nothing
      // else here looks at pixels).
      expect(form.surface.shadow, 'the form casts no shadow on the rows under it').toBe('none');
      expect(form.surface.backdrop, 'the form is not a layer over the rows under it').toBe('none');
      // Nothing the player was using moved: the clicked row and the rows above
      // it are where they were, and the panel is as wide as it was.
      expect(form.focus, 'focus stays on Load Game, as before the labels').toBe('load-button');
      expectSameBox(loadRowAfter.box, loadRowBefore.box, 'the Load Game row');
      for (const action of MENU_ACTIONS.slice(0, 2)) {
        expectSameBox(rowOf(after, action.hook).box, rowOf(before, action.hook).box, action.hook);
      }
      expect(Math.abs(after.panel.width - before.panel.width), 'the panel is as wide as it was').toBeLessThanOrEqual(0.01);
      expect(Math.abs(after.panel.left - before.panel.left)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(after.panel.top - before.panel.top), 'the panel hangs from the top it had').toBeLessThanOrEqual(0.01);
      // The rows the form pushed down still start on whole pixels.
      expectWholePixels(after, 'with the Load form open');

      // The Tab order follows what is drawn: from Load Game through the form,
      // Cancel last, then the next action.
      // Every stop, in order: a fresh context has no browser save, so that
      // source is disabled and the pasted one is the selected radio, with its
      // paste box showing. (Until review round 7 this loop only required the
      // LAST stop inside the form to be Cancel, so a Tab that went round the
      // form twice, or skipped the paste box and Restore, passed.)
      const stops = ['load-source-paste', 'load-paste-textarea', 'load-confirm', 'load-cancel', 'menu-tech-tree'];
      const visited: string[] = [];
      for (let press = 0; press < stops.length; press += 1) {
        await page.keyboard.press('Tab');
        visited.push(await page.evaluate(() => document.activeElement?.getAttribute('data-hud') ?? ''));
      }
      expect(visited, 'Tab from Load Game goes through the form and on to the next action').toEqual(stops);
      await expect(page.locator('[data-hud="menu-tech-tree"]')).toBeFocused();

      // Cancel, clicked with the mouse, closes the form: focus returns to Load
      // Game and every row is back where it was.
      const cancel = await page.locator('[data-hud="load-cancel"]').boundingBox();
      await page.mouse.click(cancel!.x + cancel!.width / 2, cancel!.y + cancel!.height / 2);
      await expect(page.locator('[data-hud="load-panel"]')).toBeHidden();
      await expect(page.locator('[data-hud="load-button"]')).toBeFocused();
      const closed = await readMenu(page);
      expectSameBox(closed.panel, before.panel, 'the panel with the form closed');
      for (const row of closed.rows) {
        expectSameBox(row.box, rowOf(before, row.hook).box, `${row.hook} with the form closed`);
      }
    });
  }

  test('with the Load form open, Escape and focus are what they were before the labels', async ({ page }) => {
    // Measured on v0.3.280 (the base of this work): the click leaves focus on
    // the Load button; Escape closes the MENU and leaves the form open inside
    // it, focus goes to the menu button and the match runs on; opening the menu
    // again focuses its first action with the form still open. At 800x600,
    // where the form opened with 23px of its 214px in view.
    await openMenu(page, { width: 800, height: 600 });
    const pausedTick = (await game.getHudState(page)).tick;
    await clickName(page, 'load-button');
    await expect(page.locator('[data-hud="load-panel"]')).toBeVisible();
    await expect(page.locator('[data-hud="load-button"]')).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
    await expect(page.locator('[data-hud="menu-button"]')).toBeFocused();
    await expect.poll(async () => (await game.getHudState(page)).tick).toBeGreaterThan(pausedTick);
    expect(await page.locator('[data-hud="load-panel"]').getAttribute('hidden'), 'the form is left open inside the closed menu').toBeNull();

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();
    await expect(page.locator('[data-hud="menu-resume"]')).toBeFocused();
    await expect(page.locator('[data-hud="load-panel"]')).toBeVisible();
    // What is new: the open form is in view when the menu comes back.
    const cancel = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('.hud-game-menu__panel')!.getBoundingClientRect();
      const button = document.querySelector<HTMLElement>('[data-hud="load-cancel"]')!;
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return { inPanelView: rect.top >= panel.top && rect.bottom <= panel.bottom, takesPointer: hit !== null && button.contains(hit) };
    });
    expect(cancel.inPanelView, 'Cancel is in the panel\'s view when the menu reopens').toBe(true);
    expect(cancel.takesPointer, 'Cancel takes the pointer').toBe(true);
  });
});
