// The command deck is never clipped, and a card's tooltip leaves with the
// cursor. Play-test findings F5 and F6 (2026-09-02), gated as classes.
//
// F5, as the play test found it at 800x600: the bar wrapped, the whole BUILD
// group landed at y 675-743 below the panel's 588px bottom edge (max-height
// 208px, overflow-y hidden) and no wheel could reach it — the panel and its
// scroll regions took no pointer events. The stat rows ran past the 104px
// summary box the same way. The cards were reachable in the suite ONLY because
// Playwright's locator.click() scrolls hidden overflow, which is why every
// existing test passed over it. DE never clips the command card.
//
// F6: clicking a card focused it, the focus owned the tooltip, and "Place a
// House foundation…" stayed over the bar while the pointer was already out on
// the map — still showing after a twelve-step sweep across the canvas.
//
// The gate covers the CLASS: every viewport regime the bar has (wrapped below
// 1120px, unwrapped above), every selection the boot scenario can make (a
// villager with a build palette, a military unit with stance and formation, a
// Town Centre with train and research), and BOTH build pages — measured
// against the panel's VISIBLE box, because a layout box keeps its size after
// the panel has clipped it. It also asserts the panel does not scroll at all,
// which covers the parts of the bar this file does not name.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

// Everything inside the bar that a player is meant to be able to see or press.
const MUST_BE_IN_VIEW = [
  '[data-command-group]',
  '[data-command]',
  '[data-selection-detail]',
  '.hud-command-group__heading',
  '.hud-build-pages',
  'button[data-build-page]',
  '.hud-selection-summary',
  '.hud-selection-details',
  '.hud-command-deck',
  '.hud-build-menu',
  '.hud-command-list',
];

interface Overflow {
  what: string;
  box: string;
  panel: string;
}

/** Everything in the bar whose rect leaves the panel's visible box. With
 *  `mode: 'below'`, only what is still under its bottom edge — the check for a
 *  card taller than the bar, once the bar has been scrolled to its end: content
 *  scrolled off the TOP has been seen, content left below the bottom has not. */
async function outsideThePanel(page: Page, mode: 'all' | 'below' = 'all'): Promise<Overflow[]> {
  return page.evaluate(({ selectors, only }) => {
    const panel = document.querySelector('[data-hud="selection-panel"]');
    if (!panel) return [];
    const p = panel.getBoundingClientRect();
    const describe = (r: DOMRect): string =>
      `x ${Math.round(r.left)}..${Math.round(r.right)}, y ${Math.round(r.top)}..${Math.round(r.bottom)}`;
    const found: { what: string; box: string; panel: string }[] = [];
    for (const selector of selectors) {
      for (const element of panel.querySelectorAll(selector)) {
        const r = element.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const leavesBox = only === 'below'
          ? r.bottom > p.bottom + 1 || r.right > p.right + 1 || r.left < p.left - 1
          : r.bottom > p.bottom + 1 || r.top < p.top - 1
            || r.right > p.right + 1 || r.left < p.left - 1;
        if (leavesBox) {
          found.push({
            what: element.getAttribute('data-command')
              ?? element.getAttribute('data-build-page')
              ?? element.getAttribute('data-command-group')
              ?? element.getAttribute('data-selection-detail')
              ?? String(element.className),
            box: describe(r),
            panel: describe(p),
          });
        }
      }
    }
    return found;
  }, { selectors: MUST_BE_IN_VIEW, only: mode });
}

async function panelScroll(page: Page): Promise<{
  height: number; client: number; width: number; clientWidth: number;
}> {
  return page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>('[data-hud="selection-panel"]')!;
    return {
      height: panel.scrollHeight, client: panel.clientHeight,
      width: panel.scrollWidth, clientWidth: panel.clientWidth,
    };
  });
}

async function expectNothingClipped(page: Page, context: string): Promise<void> {
  const overflowing = await outsideThePanel(page);
  expect(
    overflowing.map((o) => `${o.what} at ${o.box} vs panel ${o.panel}`),
    `${context}: nothing in the command bar may sit outside the panel`,
  ).toEqual([]);
  const scroll = await panelScroll(page);
  expect(
    scroll.height,
    `${context}: the bar holds its content without scrolling `
      + `(content ${scroll.height}px, box ${scroll.client}px)`,
  ).toBeLessThanOrEqual(scroll.client + 1);
  // Sideways too: a bar wider than its box hides its right-hand groups behind
  // a scroll the panel's own `pointer-events: none` makes unreachable. The 2px
  // slack is the sub-pixel rounding of a fit-content panel.
  expect(
    scroll.width,
    `${context}: the bar holds its content without scrolling sideways `
      + `(content ${scroll.width}px, box ${scroll.clientWidth}px)`,
  ).toBeLessThanOrEqual(scroll.clientWidth + 2);
}

async function selectTownCentre(page: Page): Promise<void> {
  const selected = await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    const townCentre = api.getEconomyState().buildings
      .find((building) => building.owner === 1 && building.buildingType === 'town-center');
    return townCentre ? api.selectEntityAtCell(townCentre.x, townCentre.y) : false;
  });
  expect(selected, 'the human owns a Town Centre at boot').toBe(true);
}

for (const viewport of VIEWPORTS) {
  test.describe(`command deck at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    });

    test('shows every command in the panel, on both build pages', async ({ page }) => {
      expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
      const buildCards = page.locator('[data-command-group="build"] [data-command^="build-"]');
      await expect(buildCards.first()).toBeAttached();
      await expectNothingClipped(page, 'a villager, Economic page');

      // DE's two pages, and only one of them on screen at a time.
      const group = page.locator('[data-command-group="build"]');
      await expect(group).toHaveAttribute('data-build-page', 'economic');
      await expect(page.locator('[data-command="build-house"]')).toBeVisible();
      await expect(page.locator('[data-command="build-barracks"]')).toHaveCount(0);

      await page.locator('button[data-build-page="military"]').click();
      await expect(group).toHaveAttribute('data-build-page', 'military');
      await expect(page.locator('[data-command="build-barracks"]')).toBeVisible();
      await expect(page.locator('[data-command="build-house"]')).toHaveCount(0);
      await expectNothingClipped(page, 'a villager, Military page');

      // Switching pages must not move the palette or the toggle that switched
      // it: a control that moves under the cursor is the defect the placement
      // pill was moved into the heading to avoid.
      const menuOnMilitary = await page.locator('.hud-build-menu').boundingBox();
      const tabsOnMilitary = await page.locator('.hud-build-pages').boundingBox();
      await page.locator('button[data-build-page="economic"]').click();
      await expect(group).toHaveAttribute('data-build-page', 'economic');
      expect(await page.locator('.hud-build-menu').boundingBox())
        .toEqual(menuOnMilitary);
      expect(await page.locator('.hud-build-pages').boundingBox())
        .toEqual(tabsOnMilitary);

      // …and every card on a page is REACHABLE by a real click, not only by
      // Playwright scrolling hidden overflow into view.
      const cardCount = await buildCards.count();
      expect(cardCount).toBeGreaterThan(0);
      for (let index = 0; index < cardCount; index += 1) {
        await expect(buildCards.nth(index)).toBeInViewport({ ratio: 1 });
      }
    });

    test('keeps the build page toggle live and still where it was during placement', async ({
      page,
    }) => {
      expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
      const group = page.locator('[data-command-group="build"]');
      await expect(group).toBeAttached();
      const tabsBefore = await page.locator('.hud-build-pages').boundingBox();

      await page.locator('[data-command="build-house"]').click();
      await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

      // The toggle leads the heading row, so the title and count stepping
      // aside for the placement pill cannot move it.
      expect(
        await page.locator('.hud-build-pages').boundingBox(),
        'the page toggle does not move when placement starts',
      ).toEqual(tabsBefore);

      // …and it is not a dead control while placing: every build click enters
      // placement, so a toggle placement always outranked would be dead in the
      // commonest state, and it recorded the press anyway — the palette then
      // flipped pages the moment placement was cancelled.
      await page.locator('button[data-build-page="military"]').click();
      await expect(group).toHaveAttribute('data-build-page', 'military');
      await expect(page.locator('[data-command="build-barracks"]')).toBeVisible();
      await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
      await expectNothingClipped(page, 'a villager placing, Military page');
    });

    test('shows a military unit\'s stance and formation tiles in the panel', async ({ page }) => {
      expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
      await expect(page.locator('[data-command-group="stance"]')).toBeAttached();
      await expect(page.locator('[data-command-group="formation"]')).toBeAttached();
      await expectNothingClipped(page, 'a scout');

      // Icon tiles: no visible text, but a name and a tooltip for every one.
      const tiles = page.locator(
        '[data-command-group="stance"] [data-command], [data-command-group="formation"] [data-command]',
      );
      const count = await tiles.count();
      expect(count).toBe(8);
      for (let index = 0; index < count; index += 1) {
        const tile = tiles.nth(index);
        await expect(tile).toBeInViewport({ ratio: 1 });
        await expect(tile).toHaveAttribute('aria-label', /\w/);
        await expect(tile).toHaveAttribute('data-tooltip', /\w/);
        await expect(tile.locator('svg')).toHaveCount(1);
      }
    });

    test('shows a Town Centre\'s whole card in the panel', async ({ page }) => {
      await selectTownCentre(page);
      await expect(page.locator('[data-command-group="train"]')).toBeAttached();
      await expectNothingClipped(page, 'a Town Centre');
    });

    // The selections the boot scenario cannot make are where the bar is most
    // likely to run out of room, and they are exactly what the register's
    // prediction names. Two properties hold for ALL of them: the bar never
    // runs off SIDEWAYS (there is no horizontal scroll below 1120px at all, so
    // sideways overflow is unreachable by any means), and anything the bar
    // cannot show is reachable by scrolling it with a wheel.
    for (const card of [
      { seed: 'castle-upgrades-fixture', building: 'blacksmith' },
      { seed: 'castle-upgrades-fixture', building: 'town-center' },
      { seed: 'trade-route-fixture', building: 'market' },
      { seed: 'imperial-castle-fixture', building: 'castle' },
      { seed: 'monastery-fixture', building: 'monastery' },
    ]) {
      test(`fits or scrolls a ${card.building}'s whole card (${card.seed})`, async ({ page }) => {
        await game.waitForPausedBootWithSeed(page, card.seed);
        const selected = await page.evaluate((buildingType) => {
          const api = window.__AOE2_TEST__!;
          const building = api.getEconomyState().buildings.find(
            (candidate) => candidate.owner === 1
              && candidate.buildingType === buildingType && candidate.isComplete,
          );
          return building ? api.selectEntityAtCell(building.x, building.y) : false;
        }, card.building);
        expect(selected, `${card.seed} gives player 1 a ${card.building}`).toBe(true);
        await expect(page.locator('[data-command-group]').first()).toBeAttached();

        const scroll = await panelScroll(page);
        expect(
          scroll.width,
          `${card.building}: the bar never runs off sideways `
            + `(content ${scroll.width}px, box ${scroll.clientWidth}px)`,
        ).toBeLessThanOrEqual(scroll.clientWidth + 2);

        if (scroll.height <= scroll.client + 1) {
          await expectNothingClipped(page, `a ${card.building}`);
          return;
        }
        // Taller than the bar: then a wheel over the deck has to reach it, and
        // the whole card has to come into view by the end of the scroll. The
        // version this gate replaces could not be scrolled at all — the panel
        // and its regions took no pointer events.
        // Wheel over the part of the deck that is actually ON the panel: the
        // deck's own centre can be below the panel's bottom edge on a tall
        // card, and a wheel there lands on the map instead.
        const wheelAt = await page.evaluate(() => {
          const panel = document.querySelector('[data-hud="selection-panel"]')!.getBoundingClientRect();
          const deck = document.querySelector('[data-command-deck]')?.getBoundingClientRect();
          if (!deck) return null;
          const top = Math.max(panel.top, deck.top);
          const bottom = Math.min(panel.bottom, deck.bottom);
          return { x: deck.left + deck.width / 2, y: (top + bottom) / 2 };
        });
        expect(wheelAt, 'the card has a command deck on the panel').not.toBeNull();
        await page.mouse.move(wheelAt!.x, wheelAt!.y);
        for (let step = 0; step < 12; step += 1) {
          await page.mouse.wheel(0, 120);
        }
        // Poll rather than sample once 150ms later: the BROWSER applies these
        // wheels, so a fixed window asks how fast the host is. A panel that
        // genuinely refuses the wheel — the defect this gate replaced, where
        // the panel took no pointer events at all — still reports scrollTop 0
        // when the poll runs out, and the assertions below still name it.
        const readScroll = async (): Promise<{ top: number; atEnd: boolean }> => page.evaluate(() => {
          const panel = document.querySelector<HTMLElement>('[data-hud="selection-panel"]')!;
          return {
            top: panel.scrollTop,
            atEnd: panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2,
          };
        });
        await expect.poll(async () => (await readScroll()).atEnd, {
          message: `${card.building}: a wheel over the deck never reached the end of the card`,
          timeout: 5_000,
        }).toBe(true);
        const scrolledTo = await readScroll();
        expect(
          scrolledTo.top,
          `${card.building}: a wheel over the deck scrolls the bar `
            + `(content ${scroll.height}px in a ${scroll.client}px box)`,
        ).toBeGreaterThan(0);
        expect(scrolledTo.atEnd, `${card.building}: the wheel reaches the end of the card`)
          .toBe(true);
        const stillBelow = await outsideThePanel(page, 'below');
        expect(
          stillBelow.map((o) => `${o.what} at ${o.box} vs panel ${o.panel}`),
          `${card.building}: nothing is left under the bar's bottom edge at full scroll`,
        ).toEqual([]);
      });
    }

    // Every "go to X" affordance — the H key, the idle bell, a minimap click —
    // puts what it found in the MIDDLE of the canvas. A bar tall enough to
    // reach that point swallows the thing the player just asked to see, which
    // is how a Dock's transport ship and the opening play test's Town Centre
    // both ended up behind it.
    test('leaves the centre of the canvas clear, whatever is selected', async ({ page }) => {
      for (const target of ['villager', 'scout'] as const) {
        expect(await game.selectOwnedUnitDirect(page, 1, target)).toBe(true);
        await expect(page.locator('[data-command-group]').first()).toBeAttached();
        const covered = await page.evaluate(() => {
          const canvas = document.querySelector('canvas.voxel-world-canvas')!.getBoundingClientRect();
          const panel = document.querySelector('[data-hud="selection-panel"]')!.getBoundingClientRect();
          const centre = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };
          return {
            centre: { x: Math.round(centre.x), y: Math.round(centre.y) },
            panelTop: Math.round(panel.top),
            hits: centre.x >= panel.left && centre.x <= panel.right
              && centre.y >= panel.top && centre.y <= panel.bottom,
          };
        });
        expect(
          covered.hits,
          `${target}: the bar (top ${covered.panelTop}) covers the canvas centre `
            + `(${covered.centre.x}, ${covered.centre.y})`,
        ).toBe(false);
      }
    });

    // F6: the tooltip belongs to the cursor, not to the focus a click left.
    test('drops a clicked card\'s tooltip once the pointer is on the map', async ({ page }) => {
      expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
      const card = page.locator('[data-command="build-house"]');
      await expect(card).toBeAttached();

      await card.hover();
      const tooltip = page.locator('[data-hud="tooltip"]');
      await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');

      await card.click();
      await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

      // Twelve steps across the canvas, the sweep the play test made.
      for (let step = 0; step < 12; step += 1) {
        await page.mouse.move(
          60 + step * ((viewport.width - 120) / 11),
          60 + (step % 3) * 40,
        );
      }
      await expect(
        tooltip,
        'the tooltip follows the cursor off the card, as DE\'s does',
      ).toHaveAttribute('data-hud-tooltip-active', 'false');
      await expect(tooltip).toHaveText('');

      // The card still holds focus, so the keyboard can act on it again.
      expect(await page.evaluate(() => document.activeElement?.getAttribute('data-command')))
        .toBe('build-house');

      // A camera key must not hand the tooltip back. The first version of this
      // rule released the suppression on ANY keystroke, and the panel's own
      // re-render then re-focused the card — one ArrowUp put "Place a House
      // foundation…" back over the world with the cursor 500px away.
      await page.keyboard.press('ArrowUp');
      await page.waitForTimeout(300);
      await expect(
        tooltip,
        'a camera key does not bring a clicked card\'s tooltip back',
      ).toHaveAttribute('data-hud-tooltip-active', 'false');

      // Tab-ing to a control still shows that control's tooltip.
      await page.keyboard.press('Tab');
      await expect
        .poll(() => tooltip.getAttribute('data-hud-tooltip-active'),
          { message: 'a keyboard focus still owns a tooltip' })
        .toBe('true');
    });
  });
}
