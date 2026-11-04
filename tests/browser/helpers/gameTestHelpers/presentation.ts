import { expect, type Page } from '@playwright/test';

/**
 * Waits until the test API's presented reads answer from the world on screen:
 * `inspectPresentedVoxelPartMatrix` and every other read of the renderer's
 * presented hit state return null until then.
 *
 * The runtime's watermark alone (presentedRevision === acceptedRevision) is not
 * that. A forced view sync (`inspectVoxelUnitMotion`, `getCameraState`,
 * `worldToScreen`, `advanceTicks`, `getSnapshot`) accepts a new snapshot
 * between frames, and when the snapshot changes nothing visible on a presented
 * base, the voxel runtime marks it presented at once (render-world.ts, a delta
 * with no visual changes). The watermark then agrees, while
 * AoeVoxelWorldRenderer still holds the previous revision's hit state: it hands
 * the new one over only inside `frame()`, so the window stays open until the
 * next frame, and a read in it returns null (work 139: CI run
 * 40983419097 read revision 13 with no parts, eight forced syncs after the last
 * frame had handed over revision 5). The real click path does not need this:
 * its hit test draws a frame first whenever the hit state is behind.
 *
 * So the wait needs a world frame drawn after it began, with the runtime running
 * and the accepted epoch and revision presented after it. That is
 * `isInteractionReady()` read from outside: the renderer hands over in a frame
 * only while running, and the runtime returns to running only inside a frame.
 * The poll reads only the renderer's state, which syncs nothing, so nothing may
 * force a sync while it runs.
 */
export async function waitForPresentedHitState(page: Page): Promise<void> {
  const drawnBefore = await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState().framesDrawn);
  await expect.poll(() => page.evaluate((since) => {
    const state = window.__AOE2_TEST__!.getWorldRendererState();
    const metrics = state.metrics;
    return {
      frameDrawnSince: state.framesDrawn > since,
      running: metrics.state === 'running',
      presented: metrics.acceptedRevision !== null
        && metrics.acceptedEpoch !== null
        && metrics.presentedRevision === metrics.acceptedRevision
        && metrics.presentedEpoch === metrics.acceptedEpoch,
    };
  }, drawnBefore), {
    message: 'a world frame drawn since the wait began, the runtime running, and the accepted revision presented',
    intervals: [50],
  }).toEqual({ frameDrawnSince: true, running: true, presented: true });
}
