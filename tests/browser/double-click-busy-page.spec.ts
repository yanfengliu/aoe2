import { expect, test } from '@playwright/test';

import { DOUBLE_CLICK_WINDOW_MS } from '../../src/rendering/viewTypes';
import * as game from './helpers/gameTestHelpers';

// A player's double-click counts however busy the page is between its clicks.
//
// DEFECT (2026-09-23, defect register entry of that date). Both attempts of CI
// run 35896557214 failed "double clicking a friendly unit selects same-type
// friendly units on screen" with "Villager" where "3 Villagers Selected" was
// expected. The game measured its 300 ms window with `performance.now()` read
// inside the click handler, after the handler had rendered a frame, so the
// window measured the page rather than the player. On SwiftShader, two clicks
// 20 ms apart by their own timestamps measured 305 ms, because the second
// click's render took 297 ms. The window is now measured between the two
// pointerup `timeStamp`s, which are taken when the input happens.
//
// HOW THE PAGE IS MADE BUSY, the same way on any host: a listener that runs
// after the game's own pointerup handler (the window's bubble phase comes after
// the canvas) blocks the main thread for BUSY_MS after the first click. That is
// what one slow frame does on a software rasteriser. The two clicks leave
// together (`doubleClickWorldPosition` uses `mouse.dblclick`), so their own
// timestamps are milliseconds apart, while the page handles the second more
// than BUSY_MS after the first. The spec checks that it produced exactly that
// disagreement between the two clocks BEFORE it checks the selection, so a run
// in which the busy interval did not land between the clicks fails by name
// instead of passing for the wrong reason.
//
// Why not the frame-starvation shim (requestAnimationFrame replaced by a 300 ms
// timer): it makes frames RARE, not LONG. Input is handled at once between
// them, and the reproduction probe selected all three villagers 8 of 8 times
// under it with the old clock, so it cannot see this defect.
//
// Red by mutation, both halves: the handler clock put back in
// `voxelSelectionController.ts` fails the selection, and the two awaited
// `page.mouse.click` calls put back in `doubleClickWorldPosition` fail the
// input-clock check (the second click then leaves only after the busy page has
// handled the first).
//
// BOUND: one fixture (three idle villagers at 800x600), one busy interval, one
// left double-click on a unit, Chromium's input timestamps. It does not cover
// double-clicking a sheep, two clicks that land on different cells, or a busy
// interval that falls inside a single click rather than between two.
const BUSY_MS = 500;

interface HandledClick {
  readonly inputAt: number;
  readonly handledAt: number;
}

interface BusyPageProbe {
  arm(): void;
  readonly clicks: HandledClick[];
}

test('a double-click selects every villager on screen even when the page is busy between its two clicks', async ({ page }) => {
  await page.addInitScript((busyMs) => {
    const clicks: HandledClick[] = [];
    let armed = false;
    const probe: BusyPageProbe = {
      arm: () => { armed = true; clicks.length = 0; },
      clicks,
    };
    (window as unknown as { __busyPage: BusyPageProbe }).__busyPage = probe;
    window.addEventListener('pointerup', (event) => {
      if (!armed) return;
      clicks.push({ inputAt: event.timeStamp, handledAt: performance.now() });
      if (clicks.length !== 1) return;
      const until = performance.now() + busyMs;
      while (performance.now() < until) { /* one slow frame's worth of main-thread work */ }
    });
  }, BUSY_MS);

  await game.waitForBootWithSeed(page, 'double-click-selection-fixture');
  const villagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
  expect(villagers).toHaveLength(3);
  await page.evaluate(() => { (window as unknown as { __busyPage: BusyPageProbe }).__busyPage.arm(); });

  await game.doubleClickWorldPosition(page, villagers[0]!.x + 0.5, villagers[0]!.y + 0.5);

  await expect.poll(() => page.evaluate(
    () => (window as unknown as { __busyPage: BusyPageProbe }).__busyPage.clicks.length,
  )).toBe(2);
  const [first, second] = await page.evaluate(
    () => (window as unknown as { __busyPage: BusyPageProbe }).__busyPage.clicks,
  );
  expect(
    second!.handledAt - first!.handledAt,
    'the page handled the two clicks within one double-click window, so the busy interval never fell between them',
  ).toBeGreaterThan(DOUBLE_CLICK_WINDOW_MS);
  expect(
    second!.inputAt - first!.inputAt,
    'the two clicks left the mouse further apart than one double-click window; the helper waited for the page between them',
  ).toBeLessThan(DOUBLE_CLICK_WINDOW_MS);

  await expect(
    page.locator('[data-selection-name]'),
    'a double-click whose clicks were milliseconds apart was dropped because the page was busy between them',
  ).toHaveText('3 Villagers Selected');
  const snapshot = await game.getSnapshot(page);
  expect(snapshot.selectionState.selectedCount).toBe(3);
  expect(snapshot.selectionState.selectedEntityType).toBe('villager');
});
