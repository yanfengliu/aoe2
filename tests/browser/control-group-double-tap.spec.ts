import { expect, test, type Page } from '@playwright/test';

import { CONTROL_GROUP_DOUBLE_TAP_MS } from '../../src/app/bootstrap/selectionRecallHotkeys';
import * as game from './helpers/gameTestHelpers';

// Tapping a control-group key twice quickly centres the camera on the group,
// however busy the page is between the two taps.
//
// DEFECT (2026-09-23, the same class as the double-click in
// double-click-busy-page.spec.ts, found by the review of that fix). The
// 450 ms double-tap window was timed with `performance.now()` read inside the
// keydown handler, so a slow frame between the two taps stretched the gap the
// game measured, and a quick double-tap on a slow machine only re-selected the
// group. The window is now measured between the two keydowns' own
// `timeStamp`s, which the hotkey registry passes to the handler.
//
// HOW THE PAGE IS MADE BUSY, the same way on any host: a keydown listener on
// the window (its bubble phase runs after the registry's listener on the
// document) blocks the main thread for BUSY_MS after the first tap. Both taps
// are sent together through CDP, so neither waits for the page. The spec checks
// that the two clocks disagree about the window before it checks the camera,
// so a run in which the busy interval did not land between the taps fails by
// name instead of passing for the wrong reason.
//
// BOUND: one group of one villager on `aoe2-prototype` at 800x600, digit 1,
// Chromium's input timestamps. It does not cover a group whose units are off
// the map's clamp, or a tap that lands during a text input's focus.
const BUSY_MS = 600;

interface HandledTap {
  readonly inputAt: number;
  readonly handledAt: number;
}

interface BusyTapProbe {
  arm(): void;
  readonly taps: HandledTap[];
}

/** Two taps of one key, sent together: a player's second tap does not wait for the page. */
async function tapTwiceAtOnce(page: Page, key: string, code: string, keyCode: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const down = {
    type: 'keyDown' as const, key, code, text: key, unmodifiedText: key,
    windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode,
  };
  const up = { type: 'keyUp' as const, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await Promise.all([
    cdp.send('Input.dispatchKeyEvent', down),
    cdp.send('Input.dispatchKeyEvent', up),
    cdp.send('Input.dispatchKeyEvent', down),
    cdp.send('Input.dispatchKeyEvent', up),
  ]);
  await cdp.detach();
}

test('a control-group double-tap centres the camera even when the page is busy between its two taps', async ({ page }) => {
  await page.addInitScript((busyMs) => {
    const taps: HandledTap[] = [];
    let armed = false;
    const probe: BusyTapProbe = { arm: () => { armed = true; taps.length = 0; }, taps };
    (window as unknown as { __busyTaps: BusyTapProbe }).__busyTaps = probe;
    window.addEventListener('keydown', (event) => {
      if (!armed || event.key !== '1' || event.ctrlKey) return;
      taps.push({ inputAt: event.timeStamp, handledAt: performance.now() });
      if (taps.length !== 1) return;
      const until = performance.now() + busyMs;
      while (performance.now() < until) { /* one slow frame's worth of main-thread work */ }
    });
  }, BUSY_MS);

  await game.waitForBootWithSeed(page, 'aoe2-prototype');
  expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
  await page.keyboard.press('Control+1');
  const unit = await page.evaluate(() => {
    const snapshot = window.__AOE2_TEST__!.getSnapshot();
    const id = snapshot.selectionState.selectedEntityId;
    const found = snapshot.economyState.units.find((candidate) => candidate.id === id);
    return found ? { x: found.x, y: found.y } : null;
  });
  expect(unit, 'the bound group has no unit to centre on').not.toBeNull();

  // Where centring on the villager leaves the camera, and a view well away from it.
  const cameraAt = (x: number, y: number) => page.evaluate(({ worldX, worldY }) => {
    window.__AOE2_TEST__!.centerCameraOnWorldPosition(worldX, worldY);
    const camera = window.__AOE2_TEST__!.getCameraState()!;
    return { scrollX: camera.scrollX, scrollY: camera.scrollY };
  }, { worldX: x, worldY: y });
  const centred = await cameraAt(unit!.x + 0.5, unit!.y + 0.5);
  const away = await cameraAt(unit!.x + 20.5, unit!.y + 20.5);
  const gap = (a: { scrollX: number; scrollY: number }, b: { scrollX: number; scrollY: number }) =>
    Math.hypot(a.scrollX - b.scrollX, a.scrollY - b.scrollY);
  expect(gap(away, centred), 'moving the camera away from the villager did not move it').toBeGreaterThan(100);

  await page.evaluate(() => { (window as unknown as { __busyTaps: BusyTapProbe }).__busyTaps.arm(); });
  await tapTwiceAtOnce(page, '1', 'Digit1', 49);

  await expect.poll(() => page.evaluate(
    () => (window as unknown as { __busyTaps: BusyTapProbe }).__busyTaps.taps.length,
  )).toBe(2);
  const [first, second] = await page.evaluate(
    () => (window as unknown as { __busyTaps: BusyTapProbe }).__busyTaps.taps,
  );
  expect(
    second!.handledAt - first!.handledAt,
    'the page handled the two taps within one double-tap window, so the busy interval never fell between them',
  ).toBeGreaterThan(CONTROL_GROUP_DOUBLE_TAP_MS);
  expect(
    second!.inputAt - first!.inputAt,
    'the two taps left the keyboard further apart than one double-tap window',
  ).toBeLessThan(CONTROL_GROUP_DOUBLE_TAP_MS);

  await expect.poll(
    () => page.evaluate(() => {
      const camera = window.__AOE2_TEST__!.getCameraState()!;
      return { scrollX: camera.scrollX, scrollY: camera.scrollY };
    }).then((now) => gap(now, centred)),
    { message: 'a double-tap whose taps were milliseconds apart did not centre the camera because the page was busy between them' },
  ).toBeLessThan(1);
});
