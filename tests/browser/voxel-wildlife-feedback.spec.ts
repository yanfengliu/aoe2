import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

async function waitForPresentedSnapshot(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
    return metrics.acceptedRevision !== null
      && metrics.presentedRevision === metrics.acceptedRevision;
  })).toBe(true);
}

test.describe('voxel wildlife feedback', () => {
  test('a boar gores its attacker, then presents as a fallen carcass when killed', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'boar-hunt-fixture');
    await waitForPresentedSnapshot(page);

    const boarId = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const boar = api.getRenderState().entities.find((entity) => (
        entity.kind === 'resource' && entity.entityType === 'boar'
      ));
      if (!boar) throw new Error('The boar-hunt fixture must contain a boar.');
      if (!api.selectUnitsInBox(12, 7, 14, 9)) throw new Error('Could not select the hunters.');
      if (!api.issueContextCommandAtWorldPosition(boar.x + 0.5, boar.y + 0.5)) {
        throw new Error('The grouped boar attack command was rejected.');
      }
      return boar.id;
    });

    // The boar retaliates through the shared successful-hit channel: its own
    // resource view carries the pose, and the tusks depart their rest matrix.
    const goring = await expect.poll(async () => page.evaluate((id) => {
      const api = window.__AOE2_TEST__!;
      const boar = api.getRenderState().entities.find((entity) => entity.id === id);
      return boar?.attackAnimation !== undefined;
    }, boarId), { timeout: 20_000 }).toBe(true);
    void goring;

    const gorePose = await page.evaluate((id) => {
      const api = window.__AOE2_TEST__!;
      const boar = api.getRenderState().entities.find((entity) => entity.id === id)!;
      const identity = `${String(boar.id)}:${String(boar.generation ?? 0)}`;
      return {
        tusk: api.inspectPresentedVoxelPartMatrix(identity, 'boar-tusk-left'),
        attack: boar.attackAnimation,
      };
    }, boarId);
    expect(gorePose.attack).toBeDefined();
    expect(gorePose.tusk).not.toBeNull();

    // Kill it: the corpse persists and must present as a fallen carcass —
    // its body drops well below the standing silhouette.
    const carcass = await expect.poll(async () => page.evaluate((id) => {
      const api = window.__AOE2_TEST__!;
      const boar = api.getRenderState().entities.find((entity) => entity.id === id);
      if (!boar) return null;
      return boar.wildlifeAlive === false ? 'dead' : 'alive';
    }, boarId), { timeout: 40_000 }).toBe('dead');
    void carcass;

    const corpseHeight = await page.evaluate((id) => {
      const api = window.__AOE2_TEST__!;
      const boar = api.getRenderState().entities.find((entity) => entity.id === id)!;
      const identity = `${String(boar.id)}:${String(boar.generation ?? 0)}`;
      const body = api.inspectPresentedVoxelPartMatrix(identity, 'boar-body');
      return body ? body.matrix[13] : null;
    }, boarId);
    expect(corpseHeight).not.toBeNull();
    // A standing boar's body sits at ~0.27 * scale; a fallen one settles low.
    expect(corpseHeight!).toBeLessThan(0.25);
  });
});
