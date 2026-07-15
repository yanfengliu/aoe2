import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

async function waitForPresentedSnapshot(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
    return metrics.acceptedRevision !== null
      && metrics.presentedRevision === metrics.acceptedRevision;
  })).toBe(true);
}

test.describe('voxel behind-building unit silhouette', () => {
  test('cues exactly the hidden villager with white pixels and stays stable under pause', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'occlusion-showcase-fixture');
    await waitForPresentedSnapshot(page);

    const states = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const entities = api.getRenderState().entities;
      const villagers = entities.filter((entity) => (
        entity.kind === 'unit' && entity.entityType === 'villager'
      ));
      const hidden = villagers.find((entity) => Math.floor(entity.x) === 7
        && Math.floor(entity.y) === 7);
      const control = villagers.find((entity) => Math.floor(entity.x) === 3);
      if (!hidden || !control) {
        throw new Error('The occlusion fixture must boot one hidden and one control villager.');
      }
      return {
        hiddenId: hidden.id,
        controlId: control.id,
        occluded: api.getOccludedUnitStates(),
        screen: api.worldToScreen(7, 7),
        batches: api.getWorldRendererState().metrics.instanceBatches,
      };
    });

    expect(states.occluded.map((entry) => entry.id)).toEqual([states.hiddenId]);
    expect(states.occluded[0]!.entityType).toBe('villager');
    expect(states.batches).toBeLessThanOrEqual(7);

    const whitePixels = await page.evaluate(async (screen) => {
      const api = window.__AOE2_TEST__!;
      const frame = api.captureWorldFrame();
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => { resolve(); };
        image.onerror = () => { reject(new Error('capture decode failed')); };
        image.src = frame.dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      const worldCanvas = document.querySelector('canvas')!;
      const scale = image.width / worldCanvas.clientWidth;
      const width = Math.round(70 * scale);
      const height = Math.round(90 * scale);
      const originX = Math.max(0, Math.round(screen.x * scale) - width / 2);
      const originY = Math.max(0, Math.round(screen.y * scale) - height + Math.round(12 * scale));
      const data = context.getImageData(originX, originY, width, height).data;
      let white = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (data[index]! > 235 && data[index + 1]! > 235 && data[index + 2]! > 235) white += 1;
      }
      return white;
    }, states.screen);

    expect(whitePixels).toBeGreaterThan(20);

    const stability = await page.evaluate(async () => {
      const api = window.__AOE2_TEST__!;
      const first = JSON.stringify(api.getOccludedUnitStates());
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => { resolve(); });
        });
      });
      const second = JSON.stringify(api.getOccludedUnitStates());
      return { first, second };
    });
    expect(stability.second).toBe(stability.first);
  });
});
