// GATE: in the running game, the runtime does not rewrite the still world on every frame (work 130).
//
// WHY. Until work 130 every drawn frame of a running match handed the runtime a whole new snapshot, and the runtime
// rewrote every instance into its buffers: the matrix writes per frame equalled the instances on screen, 1,513 at the
// opening and about 3,000 late in a match, at about 4.8 us each (docs/debugging/2026-10-15-frame-rate-through-a-
// match.md). Now the opaque still world (buildings, resources, remembered things, terrain detail) keeps its batch
// revision while it is unchanged, and the runtime keeps those batches. tests/rendering/presentationFrameWork.test.ts
// holds the adapter's half in Node; this holds the whole path in the real page: the runtime's own write counter.
//
// HOW. The default scenario running at the default speed, so most frames fall between ticks, for 90 frames the page
// draws (counted in the page, not a wall-clock window). Read off getWorldRendererState(): the runtime's cumulative
// `instancePresentationMatrixWrites`, committed `metrics.frames`, wrapper `framesDrawn`, accepted revision and instances. Matrix
// writes per drawn frame must stay under 25% of the instances: the old presentation wrote 100% every frame, M1
// wrote about 58%, and sparse deltas leave the unchanged shadows untouched too. The accepted
// revision must advance on most frames; runtime commits must match wrapper calls, or no draw proves no saving.
//
// BOUND. The opening, one viewport, whichever rasteriser the suite draws with (the counters do not depend on it).
// A translucent lane whose instance order changes is replaced whole to preserve its blending order; this opening
// count does not cover arbitrary dense crowds. aoeVoxelSnapshotDelta.test.ts exercises moving shadows in Node.
import { expect, test } from '@playwright/test';

const FRAMES = 90;

test('the runtime keeps the still world between ticks of a running match', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/?seed=aoe2-prototype');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true, null, { timeout: 60_000 });
  const read = () => page.evaluate(() => {
    const state = window.__AOE2_TEST__!.getWorldRendererState();
    return {
      writes: state.metrics.instancePresentationMatrixWrites,
      drawn: state.framesDrawn,
      committed: state.metrics.frames,
      revision: state.metrics.acceptedRevision ?? 0,
      instances: state.metrics.instances,
    };
  });
  // Let the opening's first presents (every lane built once) pass.
  await page.evaluate(() => new Promise<void>((resolve) => {
    let left = 20;
    const tick = (): void => { left -= 1; if (left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }));
  const before = await read();
  await page.evaluate((wanted) => new Promise<void>((resolve) => {
    let left = wanted;
    const tick = (): void => { left -= 1; if (left <= 0) resolve(); else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), FRAMES);
  const after = await read();

  const drawn = after.drawn - before.drawn;
  const presented = after.revision - before.revision;
  const committed = after.committed - before.committed;
  expect(committed, 'runtime frames committed over the window').toBeGreaterThan(0);
  expect(committed, 'each world frame must commit an actual runtime draw').toBe(drawn);
  expect(drawn, 'world frames drawn over the window').toBeGreaterThanOrEqual(FRAMES - 5);
  expect(presented, 'snapshots presented over the window: a paused match would present none').toBeGreaterThanOrEqual(drawn / 2);
  const writesPerFrame = (after.writes - before.writes) / committed;
  expect(
    writesPerFrame / after.instances,
    `matrix writes per drawn frame ${writesPerFrame.toFixed(0)} against ${String(after.instances)} instances`,
  ).toBeLessThan(0.25);
});
