import { expect, test, type Page } from '@playwright/test';

import { DOUBLE_CLICK_WINDOW_MS } from '../../src/rendering/viewTypes';
import * as game from './helpers/gameTestHelpers';

// A player's double-click counts however busy the page is between its clicks,
// and the window runs on the clicks' own timestamps.
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
// disagreement between the two clocks, on clicks that reached the world
// canvas, BEFORE it checks the selection, so a run in which the busy interval
// did not land between the clicks fails by name instead of passing for the
// wrong reason.
//
// THE SPACED CASES pin the clock's units end to end, which the busy case alone
// cannot: its clicks are 0 ms apart, so a hand-off that divided the timestamp
// by 1000 would still pass it. Two clicks sent 100 ms apart must select every
// villager, and two sent 500 ms apart must stay single clicks.
//
// Why not the frame-starvation shim (requestAnimationFrame replaced by a 300 ms
// timer): it makes frames RARE, not LONG. Input is handled at once between
// them, and the reproduction probe selected all three villagers 8 of 8 times
// under it with the old clock, so it cannot see this defect.
//
// Red by mutation: the handler clock put back in `voxelSelectionController.ts`
// fails the busy case's selection; the two awaited `page.mouse.click` calls put
// back in `doubleClickWorldPosition` fail its input-clock check (the second
// click then leaves only after the busy page has handled the first); and the
// pointer's `event.timeStamp` divided or multiplied by 1000 fails one of the
// spaced cases.
//
// BOUND: one fixture (three idle villagers at 800x600), one busy interval, a
// left double-click on a unit, Chromium's input timestamps. It does not cover
// double-clicking a sheep, two clicks that land on different cells, a busy
// interval that falls inside a single click rather than between two, or a
// stacked unit that is already selected, whose first click the stack cycle
// takes (found by the 2026-09-23 review, not fixed here).
const BUSY_MS = 500;

interface HandledClick {
  readonly inputAt: number;
  readonly handledAt: number;
  readonly onCanvas: boolean;
}

interface ClickProbe {
  arm(): void;
  readonly clicks: HandledClick[];
}

/** Records every armed pointerup after the game has handled it, and blocks the
 *  main thread for `busyMs` after the first one (0 = never). */
async function installClickProbe(page: Page, busyMs: number): Promise<void> {
  await page.addInitScript((busy) => {
    const clicks: HandledClick[] = [];
    let armed = false;
    const probe: ClickProbe = { arm: () => { armed = true; clicks.length = 0; }, clicks };
    (window as unknown as { __clickProbe: ClickProbe }).__clickProbe = probe;
    window.addEventListener('pointerup', (event) => {
      if (!armed) return;
      const onCanvas = event.target instanceof HTMLCanvasElement
        && event.target.dataset.worldRenderer === 'voxel';
      clicks.push({ inputAt: event.timeStamp, handledAt: performance.now(), onCanvas });
      if (clicks.length !== 1 || busy <= 0) return;
      const until = performance.now() + busy;
      while (performance.now() < until) { /* one slow frame's worth of main-thread work */ }
    });
  }, busyMs);
}

async function bootAndAim(page: Page): Promise<{ x: number; y: number }> {
  await game.waitForBootWithSeed(page, 'double-click-selection-fixture');
  const villagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
  expect(villagers).toHaveLength(3);
  await page.evaluate(() => { (window as unknown as { __clickProbe: ClickProbe }).__clickProbe.arm(); });
  return { x: villagers[0]!.x + 0.5, y: villagers[0]!.y + 0.5 };
}

async function twoHandledClicks(page: Page): Promise<[HandledClick, HandledClick]> {
  await expect.poll(() => page.evaluate(
    () => (window as unknown as { __clickProbe: ClickProbe }).__clickProbe.clicks.length,
  )).toBe(2);
  const [first, second] = await page.evaluate(
    () => (window as unknown as { __clickProbe: ClickProbe }).__clickProbe.clicks,
  );
  expect(
    [first!.onCanvas, second!.onCanvas],
    'a pointerup did not land on the world canvas, so the game\'s click handler never saw it',
  ).toEqual([true, true]);
  return [first!, second!];
}

/** Two clicks `gapMs` apart that do not wait for the page between them. */
async function clickTwiceApart(page: Page, point: { x: number; y: number }, gapMs: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const { x, y } = point;
  const press = (type: 'mousePressed' | 'mouseReleased') => cdp.send('Input.dispatchMouseEvent', {
    type, x, y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1,
  });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 });
  const pending = [press('mousePressed'), press('mouseReleased')];
  await new Promise((resolve) => setTimeout(resolve, gapMs));
  pending.push(press('mousePressed'), press('mouseReleased'));
  await Promise.all(pending);
  await cdp.detach();
}

test('a double-click selects every villager on screen even when the page is busy between its two clicks', async ({ page }) => {
  await installClickProbe(page, BUSY_MS);
  const aim = await bootAndAim(page);

  await game.doubleClickWorldPosition(page, aim.x, aim.y);

  const [first, second] = await twoHandledClicks(page);
  expect(
    second.handledAt - first.handledAt,
    'the page handled the two clicks within one double-click window, so the busy interval never fell between them',
  ).toBeGreaterThan(DOUBLE_CLICK_WINDOW_MS);
  expect(
    second.inputAt - first.inputAt,
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

for (const { gapMs, inside, selected } of [
  { gapMs: 100, inside: true, selected: 3 },
  { gapMs: 500, inside: false, selected: 1 },
]) {
  test(`two clicks ${String(gapMs)} ms apart ${inside ? 'are' : 'are not'} a double-click`, async ({ page }) => {
    await installClickProbe(page, 0);
    const aim = await bootAndAim(page);
    const point = await game.getScreenPointForWorldPosition(page, aim.x, aim.y);

    await clickTwiceApart(page, point, gapMs);

    const [first, second] = await twoHandledClicks(page);
    const inputGap = second.inputAt - first.inputAt;
    expect(
      inputGap < DOUBLE_CLICK_WINDOW_MS,
      `the clicks were sent ${String(gapMs)} ms apart and their own timestamps say ${inputGap.toFixed(0)} ms, `
        + 'the wrong side of the window, so this run cannot say anything about the game',
    ).toBe(inside);
    // Game state, not the HUD label: both clicks are handled by now, and a label
    // that has not caught up with the second click would still read 'Villager'.
    const snapshot = await game.getSnapshot(page);
    expect(
      snapshot.selectionState.selectedCount,
      `two clicks ${inputGap.toFixed(0)} ms apart by their own timestamps were judged on the wrong clock or in the wrong units`,
    ).toBe(selected);
  });
}
