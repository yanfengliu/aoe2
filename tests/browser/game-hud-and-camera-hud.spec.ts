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

  test('renders dedicated accessible icons for every game-menu action', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await game.waitForBoot(page);
    await page.keyboard.press('Escape');

    const actions = [
      { hook: 'menu-resume', name: 'Resume', icon: 'resume', text: '' },
      { hook: 'save-button', name: 'Save game', icon: 'save', text: '' },
      { hook: 'load-button', name: 'Load game', icon: 'load', text: '' },
      { hook: 'menu-tech-tree', name: 'Technology tree', icon: 'techTree', text: '' },
      { hook: 'replay-load-button', name: 'Watch a replay…', icon: 'replay', text: '' },
      { hook: 'menu-restart', name: 'Restart match', icon: 'restart', text: '' },
      { hook: 'menu-quit', name: 'Quit to title', icon: 'quit', text: '' },
      { hook: 'menu-debug-cycle', name: 'Debug overlay: off', icon: 'debug', text: 'off' },
      // The live row, not the markup default: the label is republished on
      // mount from the persisted preference, so this also pins that the
      // default style really is the one the canvas is drawn in.
    ] as const;

    for (const action of actions) {
      const button = page.locator(`[data-hud="${action.hook}"]`);
      await expect(button).toHaveAccessibleName(action.name);
      await expect(button.locator(`svg[data-menu-icon="${action.icon}"]`)).toHaveCount(1);
      expect((await button.innerText()).trim()).toBe(action.text);
      const box = await button.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await expect(page.locator('[data-hud="menu-resume"]')).toBeFocused();
    const focusedState = await page.evaluate(() => {
      const panel = document.querySelector('.hud-game-menu__panel');
      const tooltip = document.querySelector('[data-hud="tooltip"]');
      const focused = document.activeElement;
      if (!(panel instanceof HTMLElement)
        || !(tooltip instanceof HTMLElement)
        || !(focused instanceof HTMLElement)) {
        throw new Error('Expected the open game menu, tooltip, and focused action.');
      }
      const panelRect = panel.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const focusedStyle = window.getComputedStyle(focused);
      return {
        menuZ: Number.parseInt(window.getComputedStyle(panel.closest('.hud-game-menu')!).zIndex, 10),
        tooltipZ: Number.parseInt(window.getComputedStyle(tooltip).zIndex, 10),
        tooltipActive: tooltip.dataset.hudTooltipActive,
        describedBy: focused.getAttribute('aria-describedby'),
        tooltipId: tooltip.id,
        outlineStyle: focusedStyle.outlineStyle,
        outlineWidth: Number.parseFloat(focusedStyle.outlineWidth),
        overlapsPanel: !(
          tooltipRect.right <= panelRect.left
          || tooltipRect.left >= panelRect.right
          || tooltipRect.bottom <= panelRect.top
          || tooltipRect.top >= panelRect.bottom
        ),
      };
    });
    expect(focusedState.tooltipZ).toBeGreaterThan(focusedState.menuZ);
    expect(focusedState.tooltipActive).toBe('true');
    expect(focusedState.describedBy).toContain(focusedState.tooltipId);
    expect(focusedState.outlineStyle).not.toBe('none');
    expect(focusedState.outlineWidth).toBeGreaterThanOrEqual(2);
    expect(focusedState.overlapsPanel).toBe(false);

    await page.keyboard.press('F2');
    await expect(page.locator('[data-hud="menu-debug-cycle"]')).toHaveAccessibleName('Debug overlay: selection-bounds');
    await expect(page.locator('[data-hud="menu-debug-mode"]')).toHaveText('selection-bounds');

    for (const action of actions.slice(1)) {
      await page.keyboard.press('Tab');
      const button = page.locator(`[data-hud="${action.hook}"]`);
      await expect(button).toBeFocused();
      await expect(page.locator('[data-hud="tooltip"]')).toContainText(action.name.split(':')[0]);
      expect(await button.getAttribute('aria-describedby')).toContain('hud-tooltip');
    }

    // Derived from the list rather than naming a button: the rule is "the trap
    // wraps at both ends", and hardcoding whichever action happens to sit last
    // makes an unrelated new menu row look like a focus regression.
    const firstAction = actions[0]!;
    const lastAction = actions.at(-1)!;

    await page.keyboard.press('Tab');
    await expect(page.locator(`[data-hud="${firstAction.hook}"]`)).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(`[data-hud="${lastAction.hook}"]`)).toBeFocused();

    for (const viewport of [
      { width: 800, height: 600 },
      { width: 700, height: 600 },
      { width: 390, height: 560 },
    ]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }));
      const layout = await page.evaluate(() => {
        const panel = document.querySelector('.hud-game-menu__panel');
        const tooltip = document.querySelector('[data-hud="tooltip"]');
        if (!(panel instanceof HTMLElement) || !(tooltip instanceof HTMLElement)) {
          throw new Error('Expected menu layout surfaces.');
        }
        const panelRect = panel.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          viewportWidth: window.innerWidth,
          panel: { left: panelRect.left, right: panelRect.right, top: panelRect.top, bottom: panelRect.bottom },
          tooltip: {
            left: tooltipRect.left,
            right: tooltipRect.right,
            top: tooltipRect.top,
            bottom: tooltipRect.bottom,
          },
          overlapsPanel: !(
            tooltipRect.right <= panelRect.left
            || tooltipRect.left >= panelRect.right
            || tooltipRect.bottom <= panelRect.top
            || tooltipRect.top >= panelRect.bottom
          ),
        };
      });
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
      expect(layout.panel.left).toBeGreaterThanOrEqual(0);
      expect(layout.panel.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.panel.top).toBeGreaterThanOrEqual(0);
      expect(layout.panel.bottom).toBeLessThanOrEqual(viewport.height);
      expect(layout.tooltip.left).toBeGreaterThanOrEqual(0);
      expect(layout.tooltip.right).toBeLessThanOrEqual(viewport.width);
      expect(layout.tooltip.top).toBeGreaterThanOrEqual(0);
      expect(layout.tooltip.bottom).toBeLessThanOrEqual(viewport.height);
      expect(layout.overlapsPanel, JSON.stringify({ viewport, layout })).toBe(false);
    }

    await page.locator('[data-hud="load-button"]').click();
    await page.locator('[data-hud="load-cancel"]').click();
    await expect(page.locator('[data-hud="load-button"]')).toBeFocused();
    await page.keyboard.press('Tab');
    // v0.3.157: the Technology-tree row sits between Load and Replay.
    await expect(page.locator('[data-hud="menu-tech-tree"]')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-hud="replay-load-button"]')).toBeFocused();

    await page.locator('[data-hud="menu-resume"]').click();
    await expect(page.locator('[data-hud="game-menu"]')).toBeHidden();
    await expect(page.locator('[data-hud="menu-button"]')).toBeFocused();
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


  test('the idle villager bell counts the idle and a REAL click selects one', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'aoe2-prototype');
    const bell = page.locator('[data-hud="idle-villager-bell"]');
    await expect(bell).toBeVisible();
    await expect(bell.locator('[data-idle-count]')).toHaveText('3');
    // A real mouse click through the DOM — the seam the modifier bug taught
    // us to keep watched.
    await bell.click();
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    // Selecting one does not change the idle count (selection is not work).
    await expect(bell.locator('[data-idle-count]')).toHaveText('3');
  });

  test('control groups bind with Ctrl+1 and recall with 1, through REAL keys', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'aoe2-prototype');
    // Select a villager, bind it to group 1, clear, recall by key.
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await page.keyboard.press('Control+1');
    await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
    await expect(page.locator('[data-selection-name]')).toHaveText('No selection');
    await page.keyboard.press('1');
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
  });
});
