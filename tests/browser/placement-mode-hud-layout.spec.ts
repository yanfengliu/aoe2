// Entering building placement must not reshape the bottom HUD.
//
// Found by playing the game (2026-09-02): with a villager selected, clicking a
// card in the BUILD group entered placement mode and (a) the build palette
// collapsed to a sliver at the right edge of the bar, and (b) the card's
// tooltip — "Place a House foundation (cost: 25 wood)…" — rendered on top of
// the minimap. The placement status ("Placing: House / Choose a clear map
// tile") was inserted as a THIRD flex sibling between the selection summary
// and the command deck; the deck is the only sibling allowed to shrink, so the
// status's width came out of the build group, which was pushed under the
// panel's clipped edge — and the tooltip followed the card there.
//
// Measured on the code before the fix (v0.3.177 dist):
//   1280x720  build group visible width 261px -> 36px (14%): its layout box
//             moved from x 736 (261 wide) to x 976 (250 wide) under a panel
//             clipped at x 1012. Hovering the Mill card put the tooltip at
//             x 804..1064, y 467..535 over the minimap frame at x 1022..1268,
//             y 501..708.
//   1440x900  build group 421px -> 196px (47%). Hovering the Lumber Camp card
//             put the tooltip at x 958..1218, y 647..715 over the minimap
//             frame at x 1182..1428, y 681..888.
//   800x600   build group 546px -> 546px — the wrapped layout below 1120px
//             was never affected, which is why the suite's default viewport
//             never saw it — but the Mining Camp card's tooltip at
//             x 376..636, y 405..473 still overlapped the frame at
//             x 598..788, y 421..588.
//
// The gate covers the CLASS, not the instance: every viewport regime the bar
// has (wrapped and unwrapped), every build card's tooltip both before and
// during placement, and the build group's VISIBLE width — its rect clipped
// by the scrolling panel — because the group's layout box keeps its
// min-width even when the panel has pushed it off the visible edge. The two
// halves are separate tests so a regression in either fails on its own line.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 800, height: 600 },
];

// The Build heading's `@container` steps, in CONTAINER pixels — the group's
// content box, which is what a container query measures. Above the first, the
// title, the page toggle, the placement pill and the count all share the row;
// between the two, the title and count step aside; below the second, the
// pill's hint is dropped WHOLE as well rather than cut mid-word. The numbers
// are the measured requirement for the longest name ("Placing: Siege
// Workshop"): 438 / 379 / 266 container pixels.
const HEADING_FULL_ROW_MIN_WIDTH = 440;
const HEADING_HINT_MIN_WIDTH = 380;

function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width
    && b.x < a.x + a.width
    && a.y < b.y + b.height
    && b.y < a.y + a.height;
}

function describeRect(rect: Rect): string {
  return `x ${Math.round(rect.x)}..${Math.round(rect.x + rect.width)}, `
    + `y ${Math.round(rect.y)}..${Math.round(rect.y + rect.height)}`;
}

/** An element's CONTENT box width — what its own container queries see. */
async function containerWidthOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const element = document.querySelector<HTMLElement>(sel);
    if (!element) return 0;
    const style = getComputedStyle(element);
    return Math.round(
      element.getBoundingClientRect().width
      - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)
      - Number.parseFloat(style.borderLeftWidth) - Number.parseFloat(style.borderRightWidth),
    );
  }, selector);
}

async function rectOf(page: Page, selector: string): Promise<Rect> {
  const rect = await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return { x: box.left, y: box.top, width: box.width, height: box.height };
  }, selector);
  expect(rect, `${selector} should be in the DOM`).not.toBeNull();
  return rect!;
}

/** Whether an element's content runs past its box — a truncated hint or a
 *  heading wider than its group, both invisible to a rect check. */
async function overflowsHorizontally(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const element = document.querySelector<HTMLElement>(sel);
    return element ? element.scrollWidth > element.clientWidth + 1 : false;
  }, selector);
}

/** The part of the build group a player can SEE: its rect clipped by the
 *  scrolling selection panel and by the viewport. */
async function buildGroupMetrics(page: Page): Promise<{
  visibleWidth: number;
  height: number;
  groups: (string | null)[];
}> {
  const group = await rectOf(page, '[data-command-group="build"]');
  const panel = await rectOf(page, '[data-hud="selection-panel"]');
  const viewport = page.viewportSize()!;
  const left = Math.max(group.x, panel.x, 0);
  const right = Math.min(group.x + group.width, panel.x + panel.width, viewport.width);
  const groups = await page.locator('[data-command-group]').evaluateAll(
    (sections) => sections.map((section) => section.getAttribute('data-command-group')),
  );
  return {
    visibleWidth: Math.max(0, right - left),
    height: Math.round(group.height),
    groups,
  };
}

async function selectVillagerWithPalette(page: Page): Promise<number> {
  expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
  const buildCards = page.locator('[data-command-group="build"] [data-command^="build-"]');
  // The panel renders on the next HUD frame, not on the selection call.
  await expect(buildCards.first()).toBeAttached();
  const cardCount = await buildCards.count();
  expect(cardCount, 'a Dark Age villager offers a build palette').toBeGreaterThan(0);
  return cardCount;
}

async function expectTooltipClearOfMinimap(page: Page, context: string): Promise<Rect> {
  const tooltip = page.locator('[data-hud="tooltip"][data-hud-tooltip-active="true"]');
  await expect(tooltip, `${context}: the tooltip should be showing`).toHaveCount(1);
  const tooltipRect = await rectOf(page, '[data-hud="tooltip"]');
  const minimapPanel = await rectOf(page, '.hud-panel--map');
  const minimap = await rectOf(page, '[data-hud="minimap"]');
  expect(
    intersects(tooltipRect, minimapPanel),
    `${context}: tooltip (${describeRect(tooltipRect)}) overlaps the minimap panel `
      + `(${describeRect(minimapPanel)}); the minimap canvas is ${describeRect(minimap)}`,
  ).toBe(false);
  return tooltipRect;
}

for (const viewport of VIEWPORTS) {
  test.describe(`placement mode at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    });

    test('keeps the build palette where it was and announces the mode in its heading', async ({
      page,
    }) => {
      await selectVillagerWithPalette(page);
      const before = await buildGroupMetrics(page);

      // The real click, so the tooltip keeps the pointer+focus ownership a
      // player's click gives it.
      await page.locator('[data-command="build-house"]').click();
      await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

      const after = await buildGroupMetrics(page);
      expect(
        after.visibleWidth,
        `build group visible width ${Math.round(before.visibleWidth)}px -> `
          + `${Math.round(after.visibleWidth)}px`,
      ).toBeGreaterThanOrEqual(before.visibleWidth * 0.9);
      expect(after.height, 'the build group does not change height').toBe(before.height);
      expect(after.groups, 'the deck keeps its groups').toEqual(before.groups);

      // The status is a pill in the Build heading: inside the group, never
      // wider than it, its hint whole or hidden but never cut mid-word.
      const pill = await rectOf(page, '[data-placement-status]');
      const group = await rectOf(page, '[data-command-group="build"]');
      expect(pill.x).toBeGreaterThanOrEqual(group.x - 1);
      expect(pill.x + pill.width).toBeLessThanOrEqual(group.x + group.width + 1);
      expect(
        await overflowsHorizontally(page, '[data-command-group="build"] .hud-command-group__heading'),
        'the Build heading fits its group',
      ).toBe(false);
      expect(
        await overflowsHorizontally(page, '.hud-placement-status__hint'),
        'the hint is never truncated',
      ).toBe(false);
      await expect(page.locator('.hud-placement-status__hint')).toHaveText('Choose a clear map tile');
      const container = await containerWidthOf(page, '[data-command-group="build"]');
      const title = page.locator('[data-command-group="build"] .hud-command-group__title');
      const count = page.locator('[data-command-group="build"] .hud-command-group__count');
      const hint = page.locator('.hud-placement-status__hint');
      if (container >= HEADING_FULL_ROW_MIN_WIDTH) {
        await expect(title, `title shown at ${container}px`).toBeVisible();
        await expect(count, `count shown at ${container}px`).toBeVisible();
      } else {
        await expect(title, `title steps aside at ${container}px`).toBeHidden();
        await expect(count, `count steps aside at ${container}px`).toBeHidden();
      }
      if (container >= HEADING_HINT_MIN_WIDTH) {
        await expect(hint, `hint shown at ${container}px`).toBeVisible();
      } else {
        await expect(hint, `hint steps aside whole at ${container}px`).toBeHidden();
      }
      // The page toggle never steps aside: a page the player cannot reach is
      // half the palette gone.
      await expect(
        page.locator('[data-command-group="build"] .hud-build-pages'),
        `the build page toggle stays at ${container}px`,
      ).toBeVisible();

      // The clicked card keeps focus, so its tooltip stays (the §14.2
      // ownership rule — whether a mouse click should keep it is an open
      // question, not something this asserts). WHERE it is, is asserted: a
      // command-bar tooltip floats above the bar, covering no card, heading
      // or status, and clear of the minimap.
      const tooltipRect = await expectTooltipClearOfMinimap(page, 'after clicking Build House');
      const bar = await rectOf(page, '[data-hud="selection-panel"]');
      expect(
        tooltipRect.y + tooltipRect.height,
        `tooltip (${describeRect(tooltipRect)}) floats above the bar (top ${Math.round(bar.y)})`,
      ).toBeLessThanOrEqual(bar.y + 1);
    });

    test('every build card tooltip clears the minimap, before and during placement', async ({
      page,
    }) => {
      const cardCount = await selectVillagerWithPalette(page);
      const buildCards = page.locator('[data-command-group="build"] [data-command^="build-"]');

      // Even before placement: the rightmost cards sit next to the minimap,
      // and a tooltip centred above them used to run over its frame.
      for (let index = 0; index < cardCount; index += 1) {
        await buildCards.nth(index).hover();
        await expectTooltipClearOfMinimap(page, `hovering card ${index} before placement`);
      }
      await page.mouse.move(viewport.width / 2, 8);
      await expect(page.locator('[data-hud="tooltip"]')).toHaveAttribute('data-hud-tooltip-active', 'false');

      await page.locator('[data-command="build-house"]').click();
      await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

      for (let index = 0; index < cardCount; index += 1) {
        await buildCards.nth(index).hover();
        await expectTooltipClearOfMinimap(page, `hovering card ${index} during placement`);
      }
    });
  });
}
