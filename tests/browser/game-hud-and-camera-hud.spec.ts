import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - game-hud-and-camera (hud)', () => {
  test('boots into a live simulation and renders the HUD/minimap', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    const snapshot = await game.getSnapshot(page);
    const minimap = await game.getMinimapStats(page);

    expect(snapshot.hudState.tick).toBeGreaterThan(0);
    expect(snapshot.hudState.worldSize).toBe('60x36');
    expect(snapshot.hudState.playerResources).toEqual({
      food: 200,
      wood: 200,
      gold: 100,
      stone: 200,
    });
    expect(snapshot.renderState.entities.length).toBeGreaterThan(0);
    expect(snapshot.renderState.frame?.visibleCells.length ?? 0).toBeGreaterThan(0);
    expect(minimap.width).toBe(220);
    expect(minimap.height).toBe(160);
    expect(minimap.nonBackgroundPixelCount).toBeGreaterThan(1_000);
    await expect(page.locator('[data-hud="match-summary"]')).toBeHidden();
  });

  test('uses the shipped HUD font while keeping debug and save-load text monospace', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    const hudFontState = await page.evaluate(async () => {
      await document.fonts.ready;
      const regularFaces = await document.fonts.load('16px "IBM Plex Sans"', 'A');
      const semiboldFaces = await document.fonts.load('600 16px "IBM Plex Sans"', 'A');
      const boldFaces = await document.fonts.load('700 16px "IBM Plex Sans"', 'A');
      const hudRoot = document.querySelector('#hud-root');
      if (!(hudRoot instanceof HTMLElement)) {
        throw new Error('Expected #hud-root to exist.');
      }

      return {
        fontFamily: window.getComputedStyle(hudRoot).fontFamily,
        regularLoaded: regularFaces.length > 0,
        semiboldLoaded: semiboldFaces.length > 0,
        boldLoaded: boldFaces.length > 0,
      };
    });
    expect(hudFontState.fontFamily).toContain('"IBM Plex Sans"');
    expect(hudFontState.regularLoaded).toBe(true);
    expect(hudFontState.semiboldLoaded).toBe(true);
    expect(hudFontState.boldLoaded).toBe(true);

    await page.keyboard.press('F2');
    const debugOverlayFontFamily = await page.locator('[data-hud="debug-overlay"]').evaluate((element) =>
      window.getComputedStyle(element).fontFamily,
    );
    expect(debugOverlayFontFamily).toContain('"Courier New"');

    // v0.1.95: Save/Load/Replay moved into the game menu (☰ / Esc). Open it first.
    await page.locator('[data-hud="menu-button"]').click();
    await page.locator('[data-hud="load-button"]').click();
    await expect(page.locator('[data-hud="load-panel"]')).toBeVisible();
    const loadPanelTextareaFontFamily = await page.locator('[data-hud="load-paste-textarea"]').evaluate((element) =>
      window.getComputedStyle(element).fontFamily,
    );
    expect(loadPanelTextareaFontFamily).toContain('"Courier New"');
  });

  test('keeps top status-bar chip positions stable as live values change', async ({ page }) => {
    await game.waitForBoot(page);

    await expect.poll(async () => game.getHudChipKeys(page)).toEqual([
      'food',
      'wood',
      'gold',
      'stone',
      'age',
      'pop',
      'time',
    ]);

    const trackedKeys = ['food', 'wood', 'gold', 'stone', 'age', 'pop', 'time'];
    const initialRects = await game.getHudChipRects(page, trackedKeys);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await page.locator('[data-command="train-villager"]').click();
    await page.locator('[data-command="train-villager"]').click();
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('50');
    await expect(page.locator('[data-hud="time"]')).toHaveText(/\d{2}:\d{2}/);

    const updatedRects = await game.getHudChipRects(page, trackedKeys);

    for (const key of trackedKeys) {
      expect(initialRects[key]).not.toBeNull();
      expect(updatedRects[key]).not.toBeNull();
      expect(updatedRects[key]?.left ?? 0).toBeCloseTo(initialRects[key]?.left ?? 0, 1);
      expect(updatedRects[key]?.width ?? 0).toBeCloseTo(initialRects[key]?.width ?? 0, 1);
    }
  });

  test('keeps a full villager command panel between the top bar and replay timeline', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await game.waitForBoot(page);
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.getByTestId('timeline-panel').evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        throw new Error('Expected the replay timeline panel.');
      }
      element.hidden = false;
    });

    for (const viewport of [
      { width: 800, height: 600 },
      { width: 700, height: 600 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(180);
      const layout = await page.evaluate(async () => {
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
        const topBar = document.querySelector('.hud-bar');
        const selectionPanel = document.querySelector('[data-hud="selection-panel"]');
        const timelinePanel = document.querySelector('.timeline-panel:not([hidden])');
        if (!(topBar instanceof HTMLElement)
          || !(selectionPanel instanceof HTMLElement)
          || !(timelinePanel instanceof HTMLElement)) {
          throw new Error('Expected visible HUD layout surfaces.');
        }
        const topRect = topBar.getBoundingClientRect();
        const selectionRect = selectionPanel.getBoundingClientRect();
        const timelineRect = timelinePanel.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          topBottom: topRect.bottom,
          selectionTop: selectionRect.top,
          selectionBottom: selectionRect.bottom,
          timelineTop: timelineRect.top,
        };
      });

      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.selectionTop).toBeGreaterThanOrEqual(layout.topBottom);
      expect(layout.selectionBottom).toBeLessThanOrEqual(layout.timelineTop);
    }
  });

});
