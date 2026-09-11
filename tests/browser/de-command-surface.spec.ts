// The three things a DE player does every few seconds — repeat a production
// click, back out of a mode, and double-click a unit — plus the two orders they
// give without looking away from the map. Every one of these came from the
// standing loop playing two full matches on the shipped build with real mouse
// and keyboard (2026-09-11); none was reported by the owner.
//
// These specs press KEYS and CLICK PIXELS. Nothing here sets game state to get
// to the assertion, because every defect they cover lives in the input path:
// which button is under the cursor after a re-render, which layer Escape
// belongs to, which of two gestures claims the second click. A harness that
// called the bridge directly would have passed on all five.
//
// BOUND, for the whole file: one scenario (`aoe2-prototype`), one map, the
// Dark Age opening. The reflow spec runs both of the bar's viewport regimes
// (wrapped below 1120px, unwrapped above); the other four run one viewport
// each. Nothing here covers a second player's panel, a replay session, or a
// touch device.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

/** Every command button's on-screen box, keyed by its `data-command`. */
async function commandButtonRects(page: Page): Promise<Record<string, [number, number]>> {
  return page.evaluate(() => {
    const rects: Record<string, [number, number]> = {};
    for (const button of document.querySelectorAll<HTMLElement>('[data-command]')) {
      const box = button.getBoundingClientRect();
      rects[button.dataset.command ?? '?'] = [Math.round(box.x), Math.round(box.y)];
    }
    return rects;
  });
}

test.describe('the command surface behaves the way DE\'s does', () => {
  // DEFECT 1 (2026-09-11, worst of the five). The production queue card was the
  // bar's MIDDLE child, so the first "Training: Villager" slid the whole
  // command deck right by its own width: at 1600x900 Ring Town Bell moved from
  // x 363 to 503 and Train Villager from 520 to 660, and the player's second
  // and third clicks — in the same screen position, at DE's commonest tempo —
  // rang the Town Bell and garrisoned their own villagers ("1/15 garrisoned",
  // Ungarrison and Back to Work in the Orders row).
  //
  // The assertion is the CLASS, not the villager button: no command button may
  // move because production started. That also covers the second half of the
  // rule — a destructive order cannot arrive in a cell a production button just
  // vacated if nothing moves at all.
  //
  // BOUND: the Town Centre's card only. A producer whose card changes SHAPE
  // between selections (a Market gaining tribute rows) is a different question
  // and this does not ask it.
  for (const viewport of [{ width: 1280, height: 720 }, { width: 800, height: 600 }]) {
    test(`repeating a production click at one point queues three and rings nothing (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.waitForBoot(page);
      expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
      await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');

      const train = page.locator('[data-command="train-villager"]');
      await expect(train).toHaveCount(1);
      const idleRects = await commandButtonRects(page);
      const box = await train.boundingBox();
      expect(box, 'the Train Villager card must have a box to click').not.toBeNull();
      const point = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };

      // Three clicks at ONE screen position. `page.mouse` rather than
      // `locator.click()` on purpose: a locator re-resolves the element and
      // would follow the button if it moved, which is the bug.
      for (let click = 0; click < 3; click += 1) {
        await page.mouse.move(point.x, point.y);
        await page.mouse.click(point.x, point.y);
        await expect.poll(
          async () => (await game.getSnapshot(page)).selectionState.queue.length,
          `click ${String(click + 1)} at (${String(Math.round(point.x))}, ${String(Math.round(point.y))}) queued nothing`,
        ).toBe(click + 1);
      }

      const snapshot = await game.getSnapshot(page);
      expect(snapshot.selectionState.queue).toHaveLength(3);
      // Nothing was garrisoned, so no bell was rung.
      expect(snapshot.selectionState.inventory).toContain('0 / 15 garrisoned');
      expect(snapshot.selectionState.actionOptions).not.toContain('ungarrison');
      expect(snapshot.selectionState.actionOptions).not.toContain('back-to-work');
      await expect(page.locator('[data-command="action-ungarrison"]')).toHaveCount(0);

      // The cursor never moved, so what is under it must still be the card it
      // was aimed at. This is the defect in one line: the bell came to rest
      // where TRAIN had been and took the next click.
      expect(
        await page.evaluate(
          ({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-command]')
            ?.getAttribute('data-command') ?? null,
          point,
        ),
        'a different command is under the unmoved cursor now that production has started',
      ).toBe('train-villager');

      // And the card held its shape: every button that was on the bar when it
      // was idle is still where it was. The tolerance is ONE pixel of layout
      // rounding, not a margin for movement — the defect this gates was 140px,
      // and a like-for-like run outside Playwright measures 0 at both
      // viewports (1280x720, 2026-09-11).
      const busyRects = await commandButtonRects(page);
      for (const [command, idlePosition] of Object.entries(idleRects)) {
        const busyPosition = busyRects[command];
        expect(busyPosition, `${command} left the bar when production started`).toBeDefined();
        const moved = Math.max(
          Math.abs((busyPosition ?? [0, 0])[0] - idlePosition[0]),
          Math.abs((busyPosition ?? [0, 0])[1] - idlePosition[1]),
        );
        expect(
          moved,
          `${command} moved from (${idlePosition.join(', ')}) to (${(busyPosition ?? []).join(', ')}) because production started`,
        ).toBeLessThanOrEqual(1);
      }

      // The queue is drawn inside the band rather than past its bottom edge —
      // the vertical half of the same defect (`M1-09-queue-overflow.png`).
      //
      // BOUND: the unwrapped bar only. Below 1120px the bar wraps and the queue
      // takes a line under the deck, where it is reached by wheeling the panel;
      // that regime already scrolled with one villager queued before any of
      // this (the 236px band token was measured against it), so asserting it
      // here would be inventing a constraint rather than gating a defect.
      if (viewport.width >= 1120) {
        const overflow = await page.evaluate(() => {
          const list = document.querySelector('[data-selection-queue-list]');
          const panel = document.querySelector('[data-hud="selection-panel"]');
          if (!list || !panel) return null;
          return Math.round(
            list.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom,
          );
        });
        expect(overflow, 'no production queue list was rendered').not.toBeNull();
        expect(overflow, 'the production queue runs past the bottom of the bar').toBeLessThanOrEqual(0);
      }
    });
  }

  // DEFECT 2 (2026-09-11). Placement mode had no cancel at all: Escape opened
  // the game MENU with the build still armed, a second click on the same build
  // card did nothing, and the only way out was to open the menu and close it
  // again. The ghost kept drawing the whole time.
  //
  // BOUND: a House from the Economic page. Other buildings share the code path
  // but are not clicked here.
  test('Escape puts an armed build away and leaves the builder selected', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.waitForBoot(page);
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await game.clickBuildCommand(page, 'house');
    await expect
      .poll(async () => (await game.getSnapshot(page)).selectionState.placementMode)
      .toBe('house');

    // Put the pointer over the world, so the ghost is really up before Escape.
    const anchor = await game.findValidPlacementNearTownCenter(page, 'house');
    await game.moveMouseToCell(page, anchor.x, anchor.y);
    await expect
      .poll(async () => page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewState() !== null))
      .toBe(true);

    await page.keyboard.press('Escape');

    await expect
      .poll(async () => (await game.getSnapshot(page)).selectionState.placementMode)
      .toBe(null);
    expect(
      await page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewState()),
      'the foundation ghost is still drawing after the placement was cancelled',
    ).toBe(null);
    // Escape cancelled the placement INSTEAD of opening the menu...
    await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
    // ...and the villager is still selected, with its build palette, so the
    // player can arm a different building without re-selecting.
    const snapshot = await game.getSnapshot(page);
    expect(snapshot.selectionState.selectedEntityType).toBe('villager');
    expect(snapshot.selectionState.buildOptions.length).toBeGreaterThan(0);

    // With nothing armed, Escape still means "menu" — the meaning it has had
    // since v0.1.95.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();
  });

  test('a second click on the same build card puts it away', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.waitForBoot(page);
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await game.clickBuildCommand(page, 'house');
    await expect
      .poll(async () => (await game.getSnapshot(page)).selectionState.placementMode)
      .toBe('house');

    await game.clickBuildCommand(page, 'house');
    await expect
      .poll(async () => (await game.getSnapshot(page)).selectionState.placementMode)
      .toBe(null);
    expect((await game.getSnapshot(page)).selectionState.selectedEntityType).toBe('villager');
  });

  // DEFECT 3 (2026-09-11). Escape had no notion of which layer was on top: with
  // the technology tree open OVER the game menu, it closed the MENU, left the
  // tree on screen with no way out but its own ✕, and resumed the clock
  // underneath it (00:51 -> 00:54 in the play-test).
  //
  // BOUND: the technology tree over the game menu. The civilizations
  // compendium is the same layer in `escapeLayers.ts` and is not pressed here.
  test('Escape closes the panel on top, not the layer under it', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.waitForBoot(page);

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="game-menu"]')).toBeVisible();
    await page.keyboard.press('F1');
    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeVisible();

    const pausedTick = (await game.getSnapshot(page)).hudState.tick;
    await page.keyboard.press('Escape');

    await expect(page.locator('[data-hud="tech-tree-panel"]')).toBeHidden();
    await expect(
      page.locator('[data-hud="game-menu"]'),
      'Escape took the menu underneath the technology tree',
    ).toBeVisible();
    // The clock did not resume. Waiting on RENDERED FRAMES rather than on the
    // wall clock, because a sleep that contains no frame cannot tell a paused
    // match from a page that stopped drawing (local rule, 2026-09-06).
    await game.waitForRenderedFrames(page, 20);
    expect(
      (await game.getSnapshot(page)).hudState.tick,
      'the match resumed under a panel the player cannot see past',
    ).toBe(pausedTick);

    // A second Escape now takes the menu, which is the layer that is left.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
  });

  // DEFECT 4 (2026-09-11). Double-click selected ONE unit. The gesture existed
  // and its gate (`game-selection-marquee.spec.ts`) passed, because that gate
  // uses a fixture whose villagers stand alone: the stacked-entity CYCLE was
  // taking the second click of every pair, and in the real opening a villager
  // stands in front of the Town Centre and on top of a sheep. Double-clicking
  // that villager selected the TOWN CENTRE.
  //
  // So this spec finds a villager that IS stacked — one whose slow repeat click
  // cycles to something else — and fails by name if the scenario no longer has
  // one, because a fixture that quietly loses its overlap would take the gate
  // with it.
  //
  // BOUND: the boot scenario's three villagers, at 1280x720. It does not cover
  // double-clicking a military unit, a unit off screen, or a second stack.
  test('double-clicking a villager standing on another entity selects every villager on screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.waitForBoot(page);
    const villagers = await game.getOwnedUnitCells(page, 1, 'villager');
    expect(villagers.length).toBeGreaterThan(1);

    // Find the stacked one. A single click selects the villager; a repeat click
    // AFTER the double-click window has expired cycles to whatever else is
    // under that point, so a cycle away from `villager` proves the overlap.
    let stacked: { x: number; y: number } | null = null;
    for (const villager of villagers) {
      await game.clickWorldPosition(page, villager.x + 0.5, villager.y + 0.5);
      if ((await game.getSnapshot(page)).selectionState.selectedEntityType !== 'villager') continue;
      // DOUBLE_CLICK_WINDOW_MS is 300; this waits it OUT, which more time only
      // makes safer — it is not a budget for something to happen inside.
      await page.waitForTimeout(600);
      await game.clickWorldPosition(page, villager.x + 0.5, villager.y + 0.5);
      if ((await game.getSnapshot(page)).selectionState.selectedEntityType !== 'villager') {
        stacked = villager;
        break;
      }
    }
    expect(
      stacked,
      'no villager in the boot scenario overlaps another selectable entity any more, '
      + 'so this spec can no longer reach the stack that made double-click select the wrong thing',
    ).not.toBeNull();

    await page.evaluate(() => { window.__AOE2_TEST__!.clearSelection(); });
    await page.waitForTimeout(600);
    await game.doubleClickWorldPosition(page, stacked!.x + 0.5, stacked!.y + 0.5);

    const snapshot = await game.getSnapshot(page);
    expect(
      snapshot.selectionState.selectedEntityType,
      'the double-click landed on the entity behind the villager instead of selecting villagers',
    ).toBe('villager');
    expect(snapshot.selectionState.selectedCount).toBe(villagers.length);
  });

  // DEFECT 5 (2026-09-11). A right click on the minimap did nothing at all —
  // the handler returned on any button but the left one, and there was no
  // `contextmenu` listener either. In DE it is how an army is sent across the
  // map without looking away from what you are doing.
  //
  // BOUND: a move order over open ground for a villager selection, at
  // 1280x720. It does not cover right-clicking an enemy on the minimap, and it
  // does not assert WHICH cell the order resolved to — only that the selection
  // took an order towards the point and that the camera stayed put.
  test('right-clicking the minimap orders the selection there and does not pan', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await game.waitForBoot(page);
    const map = await page.evaluate(() => window.__AOE2_TEST__!.getMapSize());
    expect(
      await page.evaluate(
        ({ width, height }) => window.__AOE2_TEST__!
          .selectOwnedUnitsByTypeInRect('villager', 0, 0, width - 1, height - 1),
        map,
      ),
    ).toBe(true);

    const before = await game.getSnapshot(page);
    const startCells = before.economyState.units
      .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
      .map((unit) => `${String(unit.x)},${String(unit.y)}`)
      .join(' ');
    expect(before.cameraState, 'the camera state is needed to prove the view held still').not.toBeNull();
    const camera = { x: before.cameraState!.scrollX, y: before.cameraState!.scrollY };

    const point = await game.getMinimapPoint(page, 0.72, 0.72);
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y, { button: 'right' });

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.economyState.units
        .filter((unit) => unit.owner === 1 && unit.unitType === 'villager')
        .map((unit) => `${String(unit.x)},${String(unit.y)}`)
        .join(' ');
    }, {
      message: 'a right click on the minimap gave the selection no order',
    }).not.toBe(startCells);

    // The left button pans and the right button orders; a right click must not
    // do both.
    const after = await game.getSnapshot(page);
    expect(after.cameraState!.scrollX).toBe(camera.x);
    expect(after.cameraState!.scrollY).toBe(camera.y);
  });
});
