import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import * as game from './helpers/gameTestHelpers';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test.describe('voxel world renderer', () => {
  test('composes matching canvases and presents bounded metrics when explicitly enabled', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);

    await expect.poll(async () => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics?.presentedRevision ?? null,
    )).not.toBeNull();
    await expect.poll(async () => (
      await game.getMinimapStats(page)
    ).nonBackgroundPixelCount).toBeGreaterThan(1_000);

    const result = await page.evaluate(async () => {
      const overlay = document.querySelector<HTMLCanvasElement>('.phaser-overlay-canvas')!;
      const world = document.querySelector<HTMLCanvasElement>('.voxel-world-canvas')!;
      const capture = window.__AOE2_TEST__!.captureCompositeFrame();
      const worldCapture = window.__AOE2_TEST__!.captureWorldFrame();
      if (!capture || !worldCapture) throw new Error('Voxel capture surfaces are unavailable.');

      const decode = async (dataUrl: string): Promise<ImageData> => {
        const image = new Image();
        image.src = dataUrl;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('2D decode context is unavailable.');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, canvas.width, canvas.height);
      };

      const overlayOnly = document.createElement('canvas');
      overlayOnly.width = capture.width;
      overlayOnly.height = capture.height;
      const overlayContext = overlayOnly.getContext('2d', { willReadFrequently: true });
      if (!overlayContext) throw new Error('2D overlay context is unavailable.');
      overlayContext.drawImage(overlay, 0, 0, overlayOnly.width, overlayOnly.height);

      const [compositePixels, worldPixels] = await Promise.all([
        decode(capture.dataUrl),
        decode(worldCapture.dataUrl),
      ]);
      const overlayPixels = overlayContext.getImageData(
        0,
        0,
        overlayOnly.width,
        overlayOnly.height,
      );
      let worldContributionPixels = 0;
      let unoccludedWorldMatches = 0;
      for (let offset = 0; offset < compositePixels.data.length; offset += 4) {
        const compositeDiffersFromOverlay =
          compositePixels.data[offset] !== overlayPixels.data[offset]
          || compositePixels.data[offset + 1] !== overlayPixels.data[offset + 1]
          || compositePixels.data[offset + 2] !== overlayPixels.data[offset + 2]
          || compositePixels.data[offset + 3] !== overlayPixels.data[offset + 3];
        const worldIsVisible = worldPixels.data[offset + 3]! > 0;
        if (compositeDiffersFromOverlay && worldIsVisible) worldContributionPixels += 1;

        const compositeMatchesWorld =
          compositePixels.data[offset] === worldPixels.data[offset]
          && compositePixels.data[offset + 1] === worldPixels.data[offset + 1]
          && compositePixels.data[offset + 2] === worldPixels.data[offset + 2]
          && compositePixels.data[offset + 3] === worldPixels.data[offset + 3];
        if (overlayPixels.data[offset + 3] === 0 && worldIsVisible && compositeMatchesWorld) {
          unoccludedWorldMatches += 1;
        }
      }

      const context = world.getContext('webgl2') ?? world.getContext('webgl');
      return {
        state: window.__AOE2_TEST__!.getWorldRendererState(),
        singleThreeIdentity: window.__AOE2_TEST__!.hasSingleThreeIdentity(),
        capture,
        captureProof: {
          pixelCount: capture.width * capture.height,
          worldContributionPixels,
          unoccludedWorldMatches,
        },
        preserveDrawingBuffer: context?.getContextAttributes()?.preserveDrawingBuffer ?? null,
        canvasCount: document.querySelectorAll('#game-root > canvas').length,
        overlayRect: overlay.getBoundingClientRect().toJSON(),
        worldRect: world.getBoundingClientRect().toJSON(),
        overlayWidth: overlay.width,
        overlayHeight: overlay.height,
        overlayZ: getComputedStyle(overlay).zIndex,
        worldZ: getComputedStyle(world).zIndex,
      };
    });

    expect(result.state.mode).toBe('voxel');
    expect(result.singleThreeIdentity).toBe(true);
    expect(result.capture).toMatchObject({
      width: result.overlayWidth,
      height: result.overlayHeight,
    });
    expect(result.capture!.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(result.capture!.dataUrl.length).toBeGreaterThan(10_000);
    expect(result.preserveDrawingBuffer).toBe(false);
    expect(result.captureProof.worldContributionPixels).toBeGreaterThan(1_000);
    expect(result.captureProof.unoccludedWorldMatches).toBeGreaterThan(1_000);
    expect(result.captureProof.worldContributionPixels).toBeLessThanOrEqual(
      result.captureProof.pixelCount,
    );
    expect(result.canvasCount).toBe(2);
    expect(result.worldRect).toEqual(result.overlayRect);
    expect(Number(result.worldZ)).toBeLessThan(Number(result.overlayZ));
    expect(result.state.metrics).toMatchObject({
      state: 'running',
      acceptedEpoch: 'aoe2:bridge:0',
      presentedEpoch: 'aoe2:bridge:0',
      chunks: 12,
      visibleChunks: 12,
      materialResources: 5,
      geometryResources: 1,
      instanceBatches: 6,
      animatedBatches: 2,
      contextLosses: 0,
      contextRestorations: 0,
    });
    expect(result.state.metrics!.animatedInstances).toBeGreaterThan(20);
    expect(result.state.metrics!.animatedInstances).toBeLessThan(500);
    expect(result.state.metrics!.animationMatrixUpdates).toBeGreaterThan(
      result.state.metrics!.animatedInstances,
    );
    expect(result.state.metrics!.instances).toBeGreaterThan(500);
    expect(result.state.metrics!.instances).toBeLessThan(5_000);
    expect(result.state.metrics!.drawCalls).toBeGreaterThan(0);
    expect(result.state.metrics!.drawCalls).toBeLessThanOrEqual(16);
    expect(result.state.metrics!.triangles).toBeLessThan(100_000);
    expect(result.state.metrics!.rendererGeometries).toBeLessThanOrEqual(20);
    expect(result.state.metrics!.rendererTextures).toBeLessThanOrEqual(4);
  });

  test('animates rigid unit parts without accepting new world state while paused', async ({ page }) => {
    await page.addInitScript(() => {
      const timer = window.setInterval(() => {
        if (!window.__AOE2_TEST__) return;
        window.__AOE2_TEST__.setPaused(true);
        window.clearInterval(timer);
      }, 0);
    });
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.animatedInstances,
    )).toBeGreaterThan(20);
    await page.waitForTimeout(100);

    const before = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics!,
      dataUrl: window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
    }));
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.animationMatrixUpdates,
    )).toBeGreaterThan(
      before.metrics.animationMatrixUpdates + before.metrics.animatedInstances * 2,
    );
    const after = await page.evaluate(() => ({
      tick: window.__AOE2_TEST__!.getRenderState().tick,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics!,
      dataUrl: window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
    }));

    expect(after.tick).toBe(before.tick);
    expect(after.metrics.acceptedEpoch).toBe(before.metrics.acceptedEpoch);
    expect(after.metrics.acceptedRevision).toBe(before.metrics.acceptedRevision);
    expect(after.metrics.presentedRevision).toBe(before.metrics.presentedRevision);
    expect(after.metrics.drawCalls).toBe(before.metrics.drawCalls);
    expect(after.metrics.materialResources).toBe(before.metrics.materialResources);
    expect(after.metrics.geometryResources).toBe(before.metrics.geometryResources);
    expect(after.metrics.chunks).toBe(before.metrics.chunks);
    expect(after.metrics.visibleChunks).toBe(before.metrics.visibleChunks);
    expect(after.metrics.instanceBatches).toBe(before.metrics.instanceBatches);
    expect(after.metrics.instances).toBe(before.metrics.instances);
    expect(after.metrics.animatedBatches).toBe(before.metrics.animatedBatches);
    expect(after.metrics.animatedInstances).toBe(before.metrics.animatedInstances);
    expect(after.metrics.rendererGeometries).toBe(before.metrics.rendererGeometries);
    expect(after.metrics.rendererTextures).toBe(before.metrics.rendererTextures);
    expect(sha256(after.dataUrl)).not.toBe(sha256(before.dataUrl));
  });

  test('keeps commanded roots smooth and freezes speed-matched gait across pause redraws', async ({ page }) => {
    await page.addInitScript(() => {
      const timer = window.setInterval(() => {
        if (!window.__AOE2_TEST__) return;
        window.__AOE2_TEST__.setPaused(true);
        window.clearInterval(timer);
      }, 0);
    });
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    await page.evaluate(() => window.__AOE2_TEST__!.setPaused(true));
    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(6, 8))).toBe(true);
    const selected = await page.evaluate(() => {
      const id = window.__AOE2_TEST__!.getSelectionState().selectedEntityIds[0];
      return window.__AOE2_TEST__!.getRenderState().entities.find((entity) => entity.id === id);
    });
    expect(selected).toBeDefined();
    const identity = `${String(selected!.id)}:${String(selected!.generation ?? 0)}`;
    const before = await page.evaluate(() => ({
      capture: window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics!,
    }));
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(15, 15))).toBe(true);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
    const admitted = await page.evaluate((key) => ({
      motion: window.__AOE2_TEST__!.inspectVoxelUnitMotion(key),
      displayed: window.__AOE2_TEST__!.getDisplayedEntities(),
    }), identity);
    const partial = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 150));
    const moving = await page.evaluate((key) => ({
      motion: window.__AOE2_TEST__!.inspectVoxelUnitMotion(key),
      displayed: window.__AOE2_TEST__!.getDisplayedEntities(),
    }), identity);
    const admittedRoot = admitted.displayed.find((entity) => entity.id === selected!.id)!;
    const movingRoot = moving.displayed.find((entity) => entity.id === selected!.id)!;
    const projectedRoot = partial.renderState.entities.find((entity) => entity.id === selected!.id)!;
    expect(Math.hypot(movingRoot.x - admittedRoot.x, movingRoot.y - admittedRoot.y)).toBeGreaterThan(0);
    expect(movingRoot).not.toMatchObject({ x: projectedRoot.x, y: projectedRoot.y });
    expect(moving.motion?.gaitPhaseRadians).not.toBe(admitted.motion?.gaitPhaseRadians);
    expect(moving.motion?.speedWorldUnitsPerSecond).toBeGreaterThan(0);
    expect(moving.motion?.locomotionWeight).toBeGreaterThan(0);

    await page.waitForTimeout(150);
    const frozen = await page.evaluate((key) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(key), identity);
    expect(frozen).toEqual(moving.motion);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 150));
    const resumed = await page.evaluate((key) => window.__AOE2_TEST__!.inspectVoxelUnitMotion(key), identity);
    expect(resumed?.gaitPhaseRadians).not.toBe(frozen?.gaitPhaseRadians);
    expect(resumed?.sampleTimeMs).toBeGreaterThan(frozen!.sampleTimeMs);

    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics!;
      return metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);
    const after = await page.evaluate(() => ({
      capture: window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics!,
    }));
    expect(after.metrics.acceptedRevision).toBeGreaterThan(before.metrics.acceptedRevision!);
    expect(after.metrics.drawCalls).toBe(before.metrics.drawCalls);
    expect(after.metrics.instances).toBe(before.metrics.instances);
    expect(sha256(after.capture)).not.toBe(sha256(before.capture));
  });

  test('starts a fresh renderer epoch when save/load replaces the bridge', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    const before = await page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.acceptedEpoch,
    );

    await page.evaluate(() => window.__AOE2_TEST__!.replay.seedPriorSession());

    await expect.poll(async () => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.presentedEpoch,
    )).not.toBe(before);
    expect(await page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.acceptedRevision,
    )).toBeGreaterThan(0);
  });

  test('rebuilds visible Three resources when a replay scrub changes epoch at revision one', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(6, 8))).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(15, 15))).toBe(true);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(120, 100));
    await page.evaluate(() => window.__AOE2_TEST__!.replay.seedPriorSession());

    await page.locator('[data-hud="menu-button"]').click();
    await page.locator('[data-hud="replay-load-button"]').click();
    await page.locator('[data-testid="replay-load-tab-prior"]').click();
    await page.locator('[data-testid="replay-load-prior-row"]').first().click();
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.replay.getReplayMode(),
    )).toBe('replay');
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics!;
      return metrics.presentedEpoch === metrics.acceptedEpoch
        && metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);

    const startEpoch = await page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.presentedEpoch,
    );
    const startUnits = await page.evaluate(() => JSON.stringify(
      window.__AOE2_TEST__!.getRenderState().entities
        .filter((entity) => entity.kind === 'unit')
        .map((entity) => [entity.id, entity.x, entity.y]),
    ));
    const startCanvas = await page.evaluate(
      () => window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
    );

    const timeline = page.locator('[data-testid="timeline-range"]');
    const maxTick = Number(await timeline.getAttribute('max'));
    await timeline.evaluate((input: HTMLInputElement) => {
      input.value = input.max;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.replay.getReplayCurrentTick(),
    )).toBe(maxTick);
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.presentedEpoch,
    )).not.toBe(startEpoch);
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics!;
      return metrics.presentedEpoch === metrics.acceptedEpoch
        && metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);

    const endUnits = await page.evaluate(() => JSON.stringify(
      window.__AOE2_TEST__!.getRenderState().entities
        .filter((entity) => entity.kind === 'unit')
        .map((entity) => [entity.id, entity.x, entity.y]),
    ));
    const endCanvas = await page.evaluate(
      () => window.__AOE2_TEST__!.captureWorldFrame()!.dataUrl,
    );
    expect(endUnits).not.toBe(startUnits);
    expect(sha256(endCanvas)).not.toBe(sha256(startCanvas));
  });

  test('fences presentation during context loss and catches up after restoration', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype&renderer=voxel');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.presentedRevision,
    )).not.toBeNull();

    const lossAttempt = await page.locator('.voxel-world-canvas').evaluate((canvas) => {
      const webglCanvas = canvas as HTMLCanvasElement;
      const webgl2 = webglCanvas.getContext('webgl2');
      const context = webgl2 ?? webglCanvas.getContext('webgl');
      const extension = context?.getExtension('WEBGL_lose_context') ?? null;
      if (!context || !extension) {
        return {
          extensionAvailable: false,
          contextType: context ? (webgl2 ? 'webgl2' : 'webgl') : null,
          preserveDrawingBuffer: context?.getContextAttributes()?.preserveDrawingBuffer ?? null,
        };
      }
      const holder = window as typeof window & {
        __AOE2_VOXEL_CONTEXT_LOSS__?: { restoreContext(): void };
      };
      holder.__AOE2_VOXEL_CONTEXT_LOSS__ = extension;
      const preserveDrawingBuffer = context.getContextAttributes()?.preserveDrawingBuffer ?? null;
      extension.loseContext();
      return {
        extensionAvailable: true,
        contextType: webgl2 ? 'webgl2' : 'webgl',
        preserveDrawingBuffer,
      };
    });
    expect(
      lossAttempt.extensionAvailable,
      `Chromium ${lossAttempt.contextType ?? 'WebGL'} must expose WEBGL_lose_context`,
    ).toBe(true);
    expect(lossAttempt.preserveDrawingBuffer).toBe(false);
    await expect.poll(() => page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!.state,
    )).toBe('lost');
    await expect.poll(() => page.locator('.voxel-world-canvas').evaluate((canvas) => {
      const webglCanvas = canvas as HTMLCanvasElement;
      const context = webglCanvas.getContext('webgl2') ?? webglCanvas.getContext('webgl');
      return context?.isContextLost() ?? false;
    })).toBe(true);
    const lost = await page.evaluate(
      () => window.__AOE2_TEST__!.getWorldRendererState().metrics!,
    );
    expect(lost.contextLosses).toBe(1);

    expect(await page.evaluate(() => {
      const holder = window as typeof window & {
        __AOE2_VOXEL_CONTEXT_LOSS__?: { restoreContext(): void };
      };
      const extension = holder.__AOE2_VOXEL_CONTEXT_LOSS__;
      if (!extension) return false;
      extension.restoreContext();
      delete holder.__AOE2_VOXEL_CONTEXT_LOSS__;
      return true;
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics!;
      return metrics.state === 'running'
        && metrics.contextRestorations === 1
        && metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);
    await expect.poll(() => page.locator('.voxel-world-canvas').evaluate((canvas) => {
      const webglCanvas = canvas as HTMLCanvasElement;
      const context = webglCanvas.getContext('webgl2') ?? webglCanvas.getContext('webgl');
      return context?.isContextLost() ?? true;
    })).toBe(false);
  });

  test('retains Phaser as the safe default without creating a Three canvas', async ({ page }) => {
    await page.goto('/?seed=aoe2-prototype');
    await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.getWorldRendererState())).toEqual({
      mode: 'phaser',
      metrics: null,
    });
    await expect(page.locator('.voxel-world-canvas')).toHaveCount(0);
    await expect(page.locator('.phaser-overlay-canvas')).toHaveCount(1);
  });
});
