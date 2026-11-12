// The in-match menu takes Definitive Edition's labels (work 148, spec §14.1).
//
// The defect, as a player met it on v0.3.280: Escape opened a menu titled
// "Menu" whose eight actions were 71x66 tiles holding an icon and no text, and
// whose two settings rows read only "off" and "Natural". The icon-only menu was
// the owner's own request of 2026-07-19 (v0.3.8); asked on 2026-11-11 whether it
// should get text labels like DE's, the owner answered "Yes, DE's labels". DE's
// menu is a dialog titled "Main Menu" holding a column of text buttons, and
// every one of its options rows is named.
//
// The menu's cases are three files over tests/browser/helpers/gameMenu.ts:
// this one (the names, and every row reached and used at each size),
// de-game-menu-text-room.spec.ts (what a caption or a settings state may do to
// the layout) and de-game-menu-load-form.spec.ts (the Load form under its
// row, Escape and focus).
//
// They drive the real controls: Escape opens the menu, the mouse clicks a row
// on its NAME (the middle of the caption's text, not of the button), the wheel
// turns over the panel, Tab and Enter use a row from the keyboard.
//
// The menu's size is arithmetic: one fixed width and every height set in
// pixels, so the room printed here is the same number on every platform, and
// the print is there to show that it is.
//
// Bound: three window sizes (800x600, 1280x720, 1920x1080) on the boot map.
// From a 692px window up nothing scrolls; at 800x600 the list does (ten 44px
// rows are 440px of its 500px ceiling), which the 800x600 case holds by
// reaching the last settings row with the wheel and with the keyboard. Not
// measured: a window between 600px and 692px tall or of odd height, one
// narrower than 364px, touch, and a real browser's scrollbar (this suite's
// Chromium hides scrollbars; a player's draws a 10px bar on a panel that
// scrolls, measured with the bars shown in plan 148).
import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  ART_STYLE_LABELS,
  MENU_ACTIONS,
  MENU_ROW_HEIGHT,
  MENU_SETTINGS,
  MENU_SIZES,
  clickName,
  expectSameBox,
  expectWholePixels,
  openMenu,
  readMenu,
  rowOf,
  wheelToRow,
} from './helpers/gameMenu';
import { DEBUG_OVERLAY_CYCLE } from '../../src/ui/hud/debugOverlay';

test.describe("the in-match menu is Definitive Edition's: a titled column of named actions", () => {
  test('Escape opens the Main Menu, every action and setting is named, and a click on a name does what it says', async ({ page }) => {
    await openMenu(page, { width: 1280, height: 720 });
    const menu = await readMenu(page);

    expect(menu.title).toBe('Main Menu');
    expect(menu.rows.map((row) => row.hook)).toEqual([
      ...MENU_ACTIONS.map((action) => action.hook),
      ...MENU_SETTINGS.map((setting) => setting.hook),
    ]);

    for (const action of MENU_ACTIONS) {
      const row = rowOf(menu, action.hook);
      // What the player reads on the button is its name, and nothing else.
      expect(row.text, action.hook).toBe(action.caption);
      // The glyph is kept, before the name, on the name's line.
      expect(row.glyph, action.hook).not.toBeNull();
      expect(row.glyph!.right, `${action.hook}: the glyph ends before the name starts`).toBeLessThanOrEqual(row.label!.box.left);
      expect(row.glyph!.top).toBeGreaterThanOrEqual(row.box.top);
      expect(row.glyph!.bottom).toBeLessThanOrEqual(row.box.bottom);
      expect(row.label!.lines, `${action.hook}: the name is one line`).toBe(1);
    }
    for (const setting of MENU_SETTINGS) {
      const row = rowOf(menu, setting.hook);
      expect(row.text, setting.hook).toBe(`${setting.label} ${setting.state}`);
      expect(row.glyph!.right).toBeLessThanOrEqual(row.label!.box.left);
      expect(row.label!.box.right, `${setting.hook}: the name comes before the state`).toBeLessThanOrEqual(row.state!.box.left);
      await expect(page.locator(`[data-hud="${setting.hook}"]`)).toHaveAccessibleName(`${setting.label}: ${setting.state}`);
    }

    // One column: every row starts and ends at the same x, each under the last.
    const first = menu.rows[0]!;
    menu.rows.forEach((row, index) => {
      expect(Math.abs(row.box.left - first.box.left), `${row.hook} starts where the first row does`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(row.box.right - first.box.right), `${row.hook} ends where the first row does`).toBeLessThanOrEqual(0.01);
      expect(row.box.height, `${row.hook} is ${MENU_ROW_HEIGHT}px tall`).toBeGreaterThanOrEqual(MENU_ROW_HEIGHT);
      if (index > 0) {
        expect(row.box.top, `${row.hook} is under the row before it`).toBeGreaterThanOrEqual(menu.rows[index - 1]!.box.bottom);
      }
    });

    // The match is paused while the menu is up; the names are clicked on it.
    const pausedTick = (await game.getHudState(page)).tick;

    // "Technology Tree" opens the technology tree, over the menu.
    await clickName(page, 'menu-tech-tree');
    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeHidden();
    await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();

    // "Debug overlay" steps its mode: the state beside the name follows.
    await clickName(page, 'menu-debug-cycle');
    await expect(page.locator('[data-hud="menu-debug-mode"]')).toHaveText(DEBUG_OVERLAY_CYCLE[1]!);
    await expect(page.locator('[data-hud="menu-debug-cycle"]')).toHaveAccessibleName(`Debug overlay: ${DEBUG_OVERLAY_CYCLE[1]}`);
    await expect(page.locator('[data-hud="debug-overlay"]')).toHaveAttribute('data-hud-debug-mode', DEBUG_OVERLAY_CYCLE[1]!);

    // "Return to Game" closes the menu and the match runs on.
    expect((await game.getHudState(page)).tick).toBe(pausedTick);
    await clickName(page, 'menu-resume');
    await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
    await expect.poll(async () => (await game.getHudState(page)).tick).toBeGreaterThan(pausedTick);
  });

  for (const size of MENU_SIZES) {
    test(`at ${size.width}x${size.height} every row is reached and used, and the menu keeps its room`, async ({ page }) => {
      await openMenu(page, size);
      const menu = await readMenu(page);
      // The panel may reach to 8px above the 84px lane kept under it for a
      // tooltip that stacks below in a narrow window.
      const floor = size.height - 92;
      const lastAction = rowOf(menu, MENU_ACTIONS.at(-1)!.hook);
      const lastSetting = MENU_SETTINGS.at(-1)!;

      // The panel is inside the window at every size, and nothing runs sideways.
      expect(menu.panel.left).toBeGreaterThanOrEqual(0);
      expect(menu.panel.right).toBeLessThanOrEqual(size.width);
      expect(menu.panel.top).toBeGreaterThanOrEqual(0);
      expect(menu.panel.bottom).toBeLessThanOrEqual(size.height);
      expect(menu.panelScrollWidth).toBeLessThanOrEqual(menu.panelClientWidth);
      expect(menu.documentScrollWidth).toBeLessThanOrEqual(size.width);
      for (const row of menu.rows) {
        expect(row.box.height, `${row.hook} is ${MENU_ROW_HEIGHT}px tall`).toBeGreaterThanOrEqual(MENU_ROW_HEIGHT);
      }
      expectWholePixels(menu, 'the open menu');

      const scrolls = menu.panelScrollHeight > menu.panelClientHeight;
      if (size.height >= 720) {
        // Nothing scrolls: the whole menu is drawn, with room before the
        // panel would reach its ceiling. The room is arithmetic, not a font's:
        // every height in the menu is set in pixels, so it is the same number
        // on every platform, and the print is there to show that it is.
        const spare = floor - menu.panel.bottom;
        const above = menu.panel.top;
        const below = size.height - 84 - menu.panel.bottom;
        console.log(`[menu-room] ${size.width}x${size.height}: the menu is ${menu.panel.height.toFixed(1)}px tall from `
          + `${above.toFixed(1)}px, ${spare.toFixed(1)}px short of its ceiling; ${above.toFixed(1)}px above it and `
          + `${below.toFixed(1)}px between it and the tooltip lane; nothing scrolls`);
        expect(scrolls, 'nothing scrolls').toBe(false);
        expect(spare, 'room before the ceiling').toBeGreaterThanOrEqual(12);
        // The panel hangs from a fixed top that centres a CLOSED menu above the
        // lane; that top is computed from the menu's height as CSS states it
        // (`--hud-menu-height`), so a row added without it leaves this unequal.
        // (Within a pixel: in a window of odd height the top is rounded down.)
        expect(Math.abs(above - below), 'the closed menu is centred above the tooltip lane').toBeLessThanOrEqual(1);
        for (const row of menu.rows) {
          expect(row.inView, `${row.hook} is in view`).toBe(true);
          expect(row.takesPointer, `${row.hook} takes the pointer`).toBe(true);
        }
      } else {
        // The list is taller than this window's ceiling: the title and the
        // eight actions are in view, and the two settings rows are below it.
        const visibleBottom = menu.panel.bottom;
        const spare = visibleBottom - lastAction.box.bottom;
        console.log(`[menu-room] ${size.width}x${size.height}: the menu holds ${menu.panelScrollHeight}px of rows in a view of `
          + `${menu.panelClientHeight}px, so it scrolls; the last action ends ${spare.toFixed(1)}px above the view's end, `
          + `and the last settings row is ${(rowOf(menu, lastSetting.hook).box.bottom - visibleBottom).toFixed(1)}px below it`);
        expect(scrolls, 'the list scrolls').toBe(true);
        expect(menu.panel.bottom, 'the panel stops at its ceiling').toBeLessThanOrEqual(floor);
        for (const action of MENU_ACTIONS) {
          const row = rowOf(menu, action.hook);
          expect(row.inView, `${row.hook} is in view without scrolling`).toBe(true);
          expect(row.takesPointer, `${row.hook} takes the pointer`).toBe(true);
        }
        expect(spare, 'room under the last action').toBeGreaterThanOrEqual(MENU_ROW_HEIGHT / 2);
        expect(rowOf(menu, lastSetting.hook).inView, 'the last settings row starts out of view').toBe(false);
      }

      // The last settings row, as a player reaches it: the wheel over the panel
      // (no turn where nothing scrolls), then a click on its name.
      const turns = await wheelToRow(page, lastSetting.hook);
      if (scrolls) {
        expect(turns, 'the wheel had to turn').toBeGreaterThan(0);
      } else {
        expect(turns, 'the row was in view already').toBe(0);
      }
      const reached = rowOf(await readMenu(page), lastSetting.hook);
      expect(reached.takesPointer, 'the last settings row takes the pointer').toBe(true);
      await clickName(page, lastSetting.hook);
      await expect(page.locator(`[data-hud="${lastSetting.stateHook}"]`)).toHaveText(ART_STYLE_LABELS[1]);
      await expect(page.locator(`[data-hud="${lastSetting.hook}"]`)).toHaveAccessibleName(`Art style: ${ART_STYLE_LABELS[1]}`);

      // And from the keyboard: closed and opened again the list is at its top
      // with its title in view, focus on the first action; Shift+Tab wraps to
      // the last row, which comes into view under the focus, and Enter uses it.
      // (Space does not: a game hotkey takes its keydown from a focused menu
      // button, on v0.3.280 as now. That is a finding in plan 106, not this
      // spec's claim.)
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-hud="menu-resume"]')).toBeFocused();
      const reopened = await readMenu(page);
      expect(reopened.panelScrollTop, 'the list opens at its top').toBe(0);
      expectSameBox(rowOf(reopened, MENU_ACTIONS[0].hook).box, rowOf(menu, MENU_ACTIONS[0].hook).box, 'the first action, reopened');
      await page.keyboard.press('Shift+Tab');
      await expect(page.locator(`[data-hud="${lastSetting.hook}"]`)).toBeFocused();
      await expect.poll(async () => rowOf(await readMenu(page), lastSetting.hook).inView).toBe(true);
      // The focused row's tooltip, the longest of the menu's, is outside the
      // panel and inside the window (game-hud-and-camera-hud.spec.ts holds
      // that at 800x600, 700x600 and 390x560). Where the window is too narrow
      // to seat it beside the panel it stacks in the lane kept under the
      // panel, which a panel at its ceiling leaves 76px of: the room is
      // printed so a platform's own line count can be read from its log.
      await expect(page.locator('[data-hud="tooltip"]')).toContainText('Art style');
      await expect(page.locator('[data-hud="tooltip"]')).toHaveAttribute('data-hud-tooltip-active', 'true');
      const tooltip = await page.evaluate(() => {
        const element = document.querySelector<HTMLElement>('[data-hud="tooltip"]')!;
        const rect = element.getBoundingClientRect();
        const panel = document.querySelector<HTMLElement>('.hud-game-menu__panel')!.getBoundingClientRect();
        return {
          active: element.dataset.hudTooltipActive,
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          width: rect.width,
          under: rect.top >= panel.bottom,
          overlapsPanel: !(rect.right <= panel.left || rect.left >= panel.right || rect.bottom <= panel.top || rect.top >= panel.bottom),
          panelBottom: panel.bottom,
        };
      });
      expect(tooltip.active, 'the focused row shows its tooltip').toBe('true');
      expect(tooltip.overlapsPanel, 'the tooltip is outside the panel').toBe(false);
      expect(tooltip.bottom, 'the tooltip is inside the window').toBeLessThanOrEqual(size.height);
      console.log(tooltip.under
        ? `[menu-room] ${size.width}x${size.height} the last row's tooltip stacks under the panel: ${tooltip.height.toFixed(1)}px tall in a lane of `
          + `${(size.height - 8 - tooltip.panelBottom - 8).toFixed(1)}px, ${(size.height - 8 - tooltip.bottom).toFixed(1)}px to spare`
        : `[menu-room] ${size.width}x${size.height} the last row's tooltip sits beside the panel, ${tooltip.height.toFixed(1)}px tall and ${tooltip.width.toFixed(1)}px wide`);
      await page.keyboard.press('Enter');
      await expect(page.locator(`[data-hud="${lastSetting.stateHook}"]`)).toHaveText(ART_STYLE_LABELS[0]);
    });
  }
});
