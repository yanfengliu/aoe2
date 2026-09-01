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
  test('cues exactly the hidden villager in the owner colour and stays stable under pause', async ({
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
      // The ENEMY villager behind the same Town Center. The fixture gained it
      // because it previously spawned only owner-1 units, so every capture of
      // this cue was the friendly colour and the not-yours one — the half that
      // answers "are those mine?" — went unexamined through three iterations.
      const enemyHidden = villagers.find((entity) => Math.floor(entity.x) === 8
        && Math.floor(entity.y) === 7);
      if (!hidden || !control || !enemyHidden) {
        throw new Error('The occlusion fixture must boot a hidden, a control and an ENEMY villager.');
      }
      return {
        hiddenId: hidden.id,
        controlId: control.id,
        enemyHiddenId: enemyHidden.id,
        occluded: api.getOccludedUnitStates(),
        screen: api.worldToScreen(7, 7),
        batches: api.getWorldRendererState().metrics.instanceBatches,
      };
    });

    // BOTH hidden villagers are cued, and the control in the open is not.
    expect(new Set(states.occluded.map((entry) => entry.id)))
      .toEqual(new Set([states.hiddenId, states.enemyHiddenId]));
    expect(states.occluded.map((entry) => entry.id)).not.toContain(states.controlId);
    expect(states.occluded.every((entry) => entry.entityType === 'villager')).toBe(true);
    expect(states.batches).toBeLessThanOrEqual(9);

    // The cue is the owner's silhouette colour, not white — a flat white body
    // read as a ghost standing in FRONT of the building and said nothing about
    // whose unit it was.
    //
    // The colour is described here LITERALLY rather than imported from the
    // constant it renders from: deriving the expectation from the same value
    // the renderer uses makes the two move together, and reverting the tint to
    // white left this green. The claim is "bright and blue-dominant", which a
    // white silhouette fails.
    const cuePixels = await page.evaluate(async (screen) => {
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
      let matches = 0;
      let white = 0;
      for (let index = 0; index < data.length; index += 4) {
        const red = data[index]!;
        const green = data[index + 1]!;
        const blue = data[index + 2]!;
        if (blue > 200 && blue - red > 50 && green > red) matches += 1;
        if (red > 235 && green > 235 && blue > 235) white += 1;
      }
      return { matches, white };
    }, states.screen);

    expect(cuePixels.matches).toBeGreaterThan(20);
    // And the cue is not a white blob any more.
    expect(cuePixels.white).toBeLessThan(cuePixels.matches / 4);

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
