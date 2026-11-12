// What the in-match menu shows, read from the page, and the real inputs a
// player gives it (work 148). Shared by the three `de-game-menu*` specs, which
// hold the labelled menu: its names, its room, and its Load form.
import { expect, type Page } from '@playwright/test';

import * as game from './gameTestHelpers';

export const MENU_SIZES = [
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;

export const MENU_ACTIONS = [
  { hook: 'menu-resume', caption: 'Return to Game' },
  { hook: 'save-button', caption: 'Save Game' },
  { hook: 'load-button', caption: 'Load Game' },
  { hook: 'menu-tech-tree', caption: 'Technology Tree' },
  { hook: 'menu-civilizations', caption: 'Civilizations' },
  { hook: 'replay-load-button', caption: 'Watch a Replay…' },
  { hook: 'menu-restart', caption: 'Restart' },
  { hook: 'menu-quit', caption: 'Quit Current Game' },
] as const;

export const MENU_SETTINGS = [
  { hook: 'menu-debug-cycle', stateHook: 'menu-debug-mode', label: 'Debug overlay', state: 'off' },
  { hook: 'menu-art-style-cycle', stateHook: 'menu-art-style', label: 'Art style', state: 'Natural' },
] as const;

// The art style's labels (src/rendering/artStyles.ts, which a spec cannot
// import: it pulls the renderer in). tests/ui/gameMenuIcons.test.ts holds this
// list against that file.
export const ART_STYLE_LABELS = ['Natural', 'Moebius'] as const;

/** The rows' height: spec §14.1's minimum target, at every window size. */
export const MENU_ROW_HEIGHT = 44;

export interface Box { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface TextRead {
  box: Box;
  /** The text's own drawn width, whether or not its box cuts it. */
  textWidth: number;
  /** The lines the text is drawn on. */
  lines: number;
  clientWidth: number;
  scrollWidth: number;
  overflow: string;
}
export interface RowRead {
  hook: string;
  text: string;
  box: Box;
  /** The whole row lies inside the panel's visible box. */
  inView: boolean;
  /** The pointer at the row's middle lands on the row. */
  takesPointer: boolean;
  glyph: Box | null;
  label: TextRead | null;
  state: TextRead | null;
}
export interface MenuRead {
  title: string;
  documentScrollWidth: number;
  panel: Box;
  panelClientHeight: number;
  panelScrollHeight: number;
  panelClientWidth: number;
  panelScrollWidth: number;
  panelScrollTop: number;
  rows: RowRead[];
}

export async function readMenu(page: Page): Promise<MenuRead> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('.hud-game-menu__panel');
    if (!panel) throw new Error('Expected the open game menu.');
    const toBox = (rect: DOMRect) => ({
      left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height,
    });
    const panelRect = panel.getBoundingClientRect();
    const readText = (element: HTMLElement | null) => {
      if (!element) return null;
      const range = document.createRange();
      range.selectNodeContents(element);
      const lineTops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
      return {
        box: toBox(element.getBoundingClientRect()),
        textWidth: range.getBoundingClientRect().width,
        lines: lineTops.size,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflow: getComputedStyle(element).textOverflow,
      };
    };
    const rows = [...panel.querySelectorAll<HTMLElement>('.hud-menu-item')].map((row) => {
      const rect = row.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const glyph = row.querySelector('.hud-menu-item__glyph');
      return {
        hook: row.getAttribute('data-hud') ?? '',
        text: row.innerText.replace(/\s+/g, ' ').trim(),
        box: toBox(rect),
        inView: rect.top >= panelRect.top && rect.bottom <= panelRect.bottom,
        takesPointer: hit !== null && row.contains(hit),
        glyph: glyph ? toBox(glyph.getBoundingClientRect()) : null,
        label: readText(row.querySelector<HTMLElement>('.hud-menu-item__label')),
        state: readText(row.querySelector<HTMLElement>('.hud-menu-item__state')),
      };
    });
    return {
      title: document.querySelector('.hud-game-menu__title')?.textContent ?? '',
      documentScrollWidth: document.documentElement.scrollWidth,
      panel: toBox(panelRect),
      panelClientHeight: panel.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      panelClientWidth: panel.clientWidth,
      panelScrollWidth: panel.scrollWidth,
      panelScrollTop: panel.scrollTop,
      rows,
    };
  });
}

export function rowOf(menu: MenuRead, hook: string): RowRead {
  const row = menu.rows.find((candidate) => candidate.hook === hook);
  if (!row) throw new Error(`The menu has no row "${hook}".`);
  return row;
}

/** Boots the default map at a window size and opens the menu with Escape. */
export async function openMenu(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await game.waitForBoot(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();
  await expect(page.locator('[data-hud="menu-resume"]')).toBeFocused();
}

/** Clicks a row with the real mouse on its NAME: the middle of the caption's
 *  text. Refuses a row the pointer cannot reach there, because a click that
 *  misses the panel lands on the backdrop and closes the menu. */
export async function clickName(page: Page, hook: string): Promise<void> {
  const target = await page.evaluate((rowHook) => {
    const row = document.querySelector<HTMLElement>(`[data-hud="${rowHook}"]`);
    const label = row?.querySelector<HTMLElement>('.hud-menu-item__label');
    if (!row || !label) return null;
    const range = document.createRange();
    range.selectNodeContents(label);
    const rect = range.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, onRow: hit !== null && row.contains(hit) };
  }, hook);
  expect(target, `${hook} has a name to click`).not.toBeNull();
  expect(target!.onRow, `the pointer reaches ${hook}'s name at (${target!.x.toFixed(0)}, ${target!.y.toFixed(0)})`).toBe(true);
  await page.mouse.click(target!.x, target!.y);
}

/** Turns the wheel over the panel, as a player would, until the row is whole
 *  inside the panel's visible box. Returns how many turns it took. */
export async function wheelToRow(page: Page, hook: string): Promise<number> {
  const panel = (await readMenu(page)).panel;
  await page.mouse.move(panel.left + panel.width / 2, panel.top + panel.height / 2);
  for (let turns = 0; turns <= 12; turns += 1) {
    const menu = await readMenu(page);
    if (rowOf(menu, hook).inView) return turns;
    await page.mouse.wheel(0, 120);
    // The wheel scrolls after the event returns: wait for the panel to move,
    // and let a turn that moved nothing (the list's end) fall through. One
    // second a turn, so that a panel the wheel cannot scroll at all fails here
    // by name in twelve, well inside the test's own limit.
    await page.waitForFunction(
      (before) => document.querySelector('.hud-game-menu__panel')!.scrollTop !== before,
      menu.panelScrollTop,
      { timeout: 1_000 },
    ).catch(() => undefined);
  }
  throw new Error(`Twelve turns of the wheel did not bring ${hook} into the panel's view.`);
}

/** The panel and every row start on a whole pixel. A row a fraction of a pixel
 *  down draws its text across two pixel rows: at 1280x720 a menu centred at
 *  22.5px, and the rows under a Load form 214.2px tall, drew visibly soft. */
export function expectWholePixels(menu: MenuRead, what: string): void {
  const fraction = (value: number): number => Math.abs(value - Math.round(value));
  expect(fraction(menu.panel.top), `${what}: the panel's top ${menu.panel.top} is a whole pixel`).toBeLessThanOrEqual(0.01);
  for (const row of menu.rows) {
    expect(fraction(row.box.top), `${what}: ${row.hook}'s top ${row.box.top} is a whole pixel`).toBeLessThanOrEqual(0.01);
    expect(fraction(row.box.height), `${what}: ${row.hook}'s height ${row.box.height} is whole pixels`).toBeLessThanOrEqual(0.01);
  }
}

export function expectSameBox(actual: Box, expected: Box, what: string): void {
  for (const edge of ['left', 'top', 'right', 'bottom'] as const) {
    expect(Math.abs(actual[edge] - expected[edge]), `${what}: ${edge} ${actual[edge]} was ${expected[edge]}`)
      .toBeLessThanOrEqual(0.01);
  }
}
