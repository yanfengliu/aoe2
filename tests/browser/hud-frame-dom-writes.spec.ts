// GATE: a frame in which nothing on the HUD changes writes nothing to the page and lays nothing out (work 130).
//
// WHY. The HUD's animation-frame callback rewrote every resource count, worker count, label and tooltip, the
// match-result overlay and the match summary on every frame: 30 DOM mutations a frame with the match paused, and a
// text or attribute write dirties style and layout even when the value is unchanged. So every frame paid a style
// recalculation and a layout (Chrome's own counts: 1.01 of each per frame, paused), and the first rect read after the
// writes forced it synchronously: the audio loop's `stackAboveBell` was where that showed in a CPU profile, 3.5% of
// the main thread late in a match and 6.2% at the opening (docs/debugging/2026-10-15-frame-rate-through-a-match.md).
// The writes now happen only when the value differs (src/ui/hud/hudDomWrites.ts).
//
// HOW. The default scenario booted paused at 800x600, left to settle, then 60 rendered frames under a
// MutationObserver over the whole document, with Chrome's LayoutCount and RecalcStyleCount (CDP
// Performance.getMetrics) read on either side of the same frames. A frame count from the page's own animation
// frames, not a wall-clock window, so a starved host measures the same frames (local rules, "A browser spec asserts
// on frames rendered").
//
// BOUND. A paused match at the opening view, nothing selected or hovered: a running match changes the clock and the
// counters and must write them. The thresholds allow a stray write (a toast expiring inside the window) and are far
// under the old 1,800 mutations and 60 layouts over 60 frames. Chrome's counters are Chromium's only.
import { expect, test } from '@playwright/test';

import { waitForPausedBootWithSeed } from './helpers/gameTestHelpers';

const FRAMES = 60;

test('a paused frame writes nothing to the HUD and lays nothing out', async ({ page }) => {
  await waitForPausedBootWithSeed(page, 'aoe2-prototype');
  // Settle: the first frames mount panels, draw the minimap and place the floating controls.
  await page.evaluate(() => new Promise<void>((resolve) => {
    let left = 30;
    const tick = (): void => { left -= 1; if (left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async (): Promise<Record<string, number>> => Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map((metric) => [metric.name, metric.value]),
  );

  const before = await metrics();
  const observed = await page.evaluate((wanted) => new Promise<{ frames: number; mutations: number; first: string[] }>((resolve) => {
    let mutations = 0;
    const first: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        mutations += 1;
        if (first.length >= 8) continue;
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        first.push(`${record.type} ${record.attributeName ?? ''} on ${target?.getAttribute('data-hud') ?? target?.className ?? target?.tagName ?? '?'}`);
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    let frames = 0;
    const tick = (): void => {
      frames += 1;
      if (frames < wanted) {
        requestAnimationFrame(tick);
        return;
      }
      observer.takeRecords().forEach(() => { mutations += 1; });
      observer.disconnect();
      resolve({ frames, mutations, first });
    };
    requestAnimationFrame(tick);
  }), FRAMES);
  const after = await metrics();

  expect(observed.frames, 'the page drew the frames the count is over').toBe(FRAMES);
  expect(observed.mutations, `DOM mutations over ${String(FRAMES)} paused frames; the first: ${observed.first.join('; ')}`)
    .toBeLessThanOrEqual(10);
  expect(after.LayoutCount! - before.LayoutCount!, 'layouts over the paused frames').toBeLessThanOrEqual(5);
  expect(after.RecalcStyleCount! - before.RecalcStyleCount!, 'style recalculations over the paused frames')
    .toBeLessThanOrEqual(5);
});
