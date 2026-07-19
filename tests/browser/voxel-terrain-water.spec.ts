import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test.describe('voxel terrain and water presentation', () => {
  test('animates reflective wave cues only with displayed simulation time', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'terrain-water-motion-fixture');
    const snapshot = await game.getSnapshot(page);
    const frame = snapshot.renderState.frame!;
    const terrainCenter = await game.getMinimapPoint(
      page,
      12 / frame.mapWidth,
      12 / frame.mapHeight,
    );
    await page.mouse.click(terrainCenter.x, terrainCenter.y);
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);

    const before = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics,
    }));
    await page.waitForTimeout(150);
    const sameTime = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics,
    }));

    expect(sameTime.tick).toBe(before.tick);
    expect(sha256(sameTime.capture)).toBe(sha256(before.capture));
    expect(before.metrics).toMatchObject({
      materialResources: 7,
      instanceBatches: 9,
      animatedBatches: 1,
    });
    expect(before.metrics.animatedInstances).toBeGreaterThan(10);
    expect(before.metrics.animatedInstances).toBeLessThan(500);
    expect(before.metrics.instances).toBeLessThan(2_000);
    expect(before.metrics.drawCalls).toBeLessThanOrEqual(20);
    expect(before.metrics.triangles).toBeLessThan(100_000);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 250));
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);
    const advanced = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
    }));
    // The browser host may consume one already-scheduled frame while the
    // atomic unpause/step/repause helper runs; the contract is forward display
    // progress, not a renderer-owned exact tick count.
    expect(advanced.tick).toBeGreaterThan(before.tick);
    expect(sha256(advanced.capture)).not.toBe(sha256(before.capture));

    await page.waitForTimeout(150);
    const refrozen = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
    }));
    expect(refrozen.tick).toBe(advanced.tick);
    expect(sha256(refrozen.capture)).toBe(sha256(advanced.capture));
  });
});
