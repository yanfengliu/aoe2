// Floating HUD controls stay clear of the command bar (2026-09-02).
//
// Defect register: "The idle-villager bell sat on the command bar's SELECTION
// label". Every screenshot of the 2026-09-02 placement-mode session showed the
// bell's bottom edge over the SELECTION label at the top-left of the command bar
// whenever a villager was selected. The bell was anchored to the VIEWPORT bottom
// (`bottom:190px`) while the bar's height depends on what is selected and on the
// viewport, so a bar taller than 178px put the bell on top of it.
//
// RED on the pre-fix layout — main 781a7f7a's bell and speaker toggle over the
// v0.3.179 bar (the placement-mode fix reworked the build palette and the
// command-bar tooltips; the bar's height with a villager selected did not
// change, so these are also the v0.3.177 numbers). Rects as
// [left,top -> right,bottom]; every assertion below is soft, so one red run
// names every overlap rather than the first, and this is the whole list:
//   800x600   villager selected: bell [12,366 -> 63.2,410] over the SELECTION
//             label [27,399 -> 255,412] and the heading [27,399 -> 255,462];
//             26px inside the bar's top edge (384). Empty state clean (bar top 421).
//   1280x720  villager selected: bell [12,486 -> 63.2,530] over the label
//             [27,515 -> 287,528] and the heading [27,515 -> 287,578]; 30px
//             inside the bar's top edge (500). Empty: 29px inside the bottom
//             row's top edge (501 — the minimap panel is the taller child), not
//             over the label (at 651).
//   1440x900  villager selected: bell [12,666 -> 63.2,710] over the label
//             [27,695 -> 287,708] and the heading [27,695 -> 287,758]; 30px
//             inside the bar's top edge (680). Empty: 29px inside 681, label at 831.
// GREEN after the fix (the bell measures its `bottom` 8px above the bar's top
// edge every frame; the speaker toggle stacks 10px above the bell):
//   800x600   bell [12,332 -> 63.2,376]   toggle [12,278 -> 56,322]   bar top 384
//   1280x720  bell [12,448 -> 63.2,492]   toggle [12,394 -> 56,438]   bar top 500
//   1440x900  bell [12,628 -> 63.2,672]   toggle [12,574 -> 56,618]   bar top 680
//   (empty state: bell bottom 413 / 493 / 673 under row tops 421 / 501 / 681.)
// 2026-09-05: the bar became a fixed-height band (selection-panel-height.spec.ts,
// `--hud-selection-bar-height`), so its top edge no longer depends on the
// selection — 352 at 800x600, 462 at 1280x720, 642 at 1440x900, empty or not —
// and the numbers above are the record of the bar this file was written
// against. Every assertion below is relative to the measured bar, so none
// moved; this run's pass is in the 2026-09-05 register entry.
//
// The CLASS this gates: no floating `[data-hud]` element (absolute or fixed,
// visible) may intersect the command bar's heading, in the empty state or with a
// villager selected, and no two floating controls may intersect each other.
import { expect, test, type Page } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface FloatingLayout {
  bell: Rect;
  label: Rect;
  heading: Rect;
  panel: Rect;
  bar: Rect;
  viewport: { width: number; height: number };
  floating: Array<{ key: string; rect: Rect }>;
}

const VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function fmt(rect: Rect): string {
  const n = (value: number) => Math.round(value * 10) / 10;
  return `[${n(rect.left)},${n(rect.top)} -> ${n(rect.right)},${n(rect.bottom)}]`;
}

async function measureFloatingLayout(page: Page): Promise<FloatingLayout> {
  // Three frames: the HUD renders the selection, the bell's own rAF loop takes
  // its position from the rendered bar, and the speaker toggle's loop takes
  // its position from the bell.
  await page.evaluate(
    () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }),
  );
  return page.evaluate(() => {
    const toRect = (element: Element): Rect => {
      const r = element.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const need = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Expected ${selector} in the HUD; it is not in the DOM.`);
      return element;
    };
    const panel = need('[data-hud="selection-panel"]');
    const bar = need('.hud-bottom');
    const heading = need('.hud-panel--selection > .hud-selection-summary > .hud-selection-heading');
    const label = need('.hud-selection-heading > .hud-label');
    const bell = need('[data-hud="idle-villager-bell"]');
    const floating = [...document.querySelectorAll<HTMLElement>('#hud-root [data-hud]')]
      .filter((element) => !panel.contains(element))
      .filter((element) => {
        const style = getComputedStyle(element);
        return (style.position === 'absolute' || style.position === 'fixed')
          && style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number(style.opacity) > 0;
      })
      .map((element) => ({ key: element.dataset.hud ?? '?', rect: toRect(element) }))
      .filter(({ rect }) => rect.right > rect.left && rect.bottom > rect.top);
    return {
      bell: toRect(bell),
      label: toRect(label),
      heading: toRect(heading),
      panel: toRect(panel),
      bar: toRect(bar),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      floating,
    };
  });
}

function assertClearOfTheBar(layout: FloatingLayout, where: string): void {
  // Every assertion here is SOFT: the test still fails, but a red run reports
  // every overlapping rect at once (the header's list came from one run)
  // instead of stopping at whichever check happens to come first.
  // The reported defect: the bell's bottom edge over the SELECTION label.
  expect.soft(
    intersects(layout.bell, layout.label),
    `${where}: idle bell ${fmt(layout.bell)} overlaps the SELECTION label ${fmt(layout.label)}`,
  ).toBe(false);
  // The badge sits ABOVE the bar, never on it — and hugs it: within the 8px
  // gap plus rounding, not floating off somewhere above (the bottom row's top
  // edge is the anchor, whichever of its panels is the taller).
  expect.soft(
    layout.bell.bottom,
    `${where}: idle bell ${fmt(layout.bell)} must end above the command panel's top edge ${fmt(layout.panel)}`,
  ).toBeLessThanOrEqual(layout.panel.top);
  expect.soft(
    layout.bar.top - layout.bell.bottom,
    `${where}: idle bell ${fmt(layout.bell)} must sit within 16px above the bottom bar ${fmt(layout.bar)}`,
  ).toBeGreaterThanOrEqual(0);
  expect.soft(
    layout.bar.top - layout.bell.bottom,
    `${where}: idle bell ${fmt(layout.bell)} must sit within 16px above the bottom bar ${fmt(layout.bar)}`,
  ).toBeLessThanOrEqual(16);
  // Both floating controls are present in every state (an absent one would
  // pass the pairwise checks vacuously).
  const keys = layout.floating.map(({ key }) => key);
  expect.soft(keys, `${where}: floating controls present`).toContain('idle-villager-bell');
  expect.soft(keys, `${where}: floating controls present`).toContain('audio-mute');
  // The class: nothing floating over the bar's heading, and floating controls
  // never stack onto each other or leave the screen on any side.
  for (const { key, rect } of layout.floating) {
    expect.soft(
      intersects(rect, layout.heading),
      `${where}: floating [data-hud="${key}"] ${fmt(rect)} overlaps the bar heading ${fmt(layout.heading)}`,
    ).toBe(false);
    const offScreen = `${where}: [data-hud="${key}"] ${fmt(rect)} left the ${layout.viewport.width}x${layout.viewport.height} screen`;
    expect.soft(rect.top, offScreen).toBeGreaterThanOrEqual(0);
    expect.soft(rect.left, offScreen).toBeGreaterThanOrEqual(0);
    expect.soft(rect.right, offScreen).toBeLessThanOrEqual(layout.viewport.width);
    expect.soft(rect.bottom, offScreen).toBeLessThanOrEqual(layout.viewport.height);
  }
  for (let i = 0; i < layout.floating.length; i += 1) {
    for (let j = i + 1; j < layout.floating.length; j += 1) {
      const a = layout.floating[i];
      const b = layout.floating[j];
      expect.soft(
        intersects(a.rect, b.rect),
        `${where}: [data-hud="${a.key}"] ${fmt(a.rect)} overlaps [data-hud="${b.key}"] ${fmt(b.rect)}`,
      ).toBe(false);
    }
  }
}

test.describe('floating HUD controls stay clear of the command bar', () => {
  for (const viewport of VIEWPORTS) {
    const size = `${viewport.width}x${viewport.height}`;
    test(`at ${size}, empty and with a villager selected`, async ({ page }) => {
      test.slow();
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
      await expect(page.locator('[data-selection-name]')).toHaveText('No selection');
      assertClearOfTheBar(await measureFloatingLayout(page), `${size} empty`);

      expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
      await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
      assertClearOfTheBar(await measureFloatingLayout(page), `${size} villager selected`);
    });
  }
});
