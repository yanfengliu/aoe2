import { expect, type Page } from '@playwright/test';

import type { ScreenPoint } from './types';

export async function emulateMonitorSize(
  page: Page,
  screenWidth = 1280,
  screenHeight = 720,
): Promise<void> {
  await page.addInitScript(
    ({ emulatedScreenWidth, emulatedScreenHeight }) => {
      Object.defineProperty(window.screen, 'width', {
        configurable: true,
        get: () => emulatedScreenWidth,
      });
      Object.defineProperty(window.screen, 'height', {
        configurable: true,
        get: () => emulatedScreenHeight,
      });
    },
    {
      emulatedScreenWidth: screenWidth,
      emulatedScreenHeight: screenHeight,
    },
  );
}

async function isCanvasContainedByFullscreenElement(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('.phaser-overlay-canvas');
    const fullscreenElement = document.fullscreenElement;
    return canvas instanceof Node && fullscreenElement instanceof Element && fullscreenElement.contains(canvas);
  });
}

export async function enterGameFullscreen(page: Page): Promise<void> {
  const isAlreadyFullscreen = await isCanvasContainedByFullscreenElement(page);
  if (isAlreadyFullscreen) {
    return;
  }

  await page.evaluate(() => {
    const root = document.getElementById('game-root');
    if (!root) {
      throw new Error('Expected #game-root to exist.');
    }

    // Chromium requires user activation for requestFullscreen(), so arm the
    // next click on a temporary button to promote the game root into
    // fullscreen mode without sending spurious input to the canvas.
    const trigger = document.createElement('button');
    trigger.id = '__aoe2-test-fullscreen-trigger';
    trigger.type = 'button';
    trigger.textContent = 'enter fullscreen';
    Object.assign(trigger.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      zIndex: '2147483647',
    });
    trigger.addEventListener(
      'click',
      () => {
        void root.requestFullscreen();
      },
      { once: true },
    );
    document.body.appendChild(trigger);
  });
  await page.locator('#__aoe2-test-fullscreen-trigger').click();
  await expect.poll(async () => isCanvasContainedByFullscreenElement(page)).toBe(true);
  await page.evaluate(() => {
    document.getElementById('__aoe2-test-fullscreen-trigger')?.remove();
  });
}

export async function exitFullscreen(page: Page): Promise<void> {
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(async () =>
    page.evaluate(() => document.fullscreenElement === null)
  ).toBe(true);
}

export async function getScreenPointForCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ cellX: x, cellY: y }) => window.__AOE2_TEST__!.worldToScreen(x, y),
    { cellX, cellY },
  );
}

export async function getScreenPointForWorldPosition(
  page: Page,
  worldX: number,
  worldY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ worldX: x, worldY: y }) => window.__AOE2_TEST__!.worldToScreen(x - 0.5, y - 0.5),
    { worldX, worldY },
  );
}

export async function getGameCanvasBounds(page: Page): Promise<NonNullable<Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>>> {
  const canvas = page.locator('.phaser-overlay-canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  return bounds!;
}

export async function getGameCanvasMetrics(page: Page): Promise<{
  canvasWidth: number;
  canvasHeight: number;
  rootWidth: number;
  rootHeight: number;
  boundsWidth: number;
  boundsHeight: number;
  boundsLeft: number;
  boundsTop: number;
}> {
  return page.evaluate(() => {
    const root = document.getElementById('game-root');
    const canvas = document.querySelector<HTMLCanvasElement>('.phaser-overlay-canvas');
    if (!root || !canvas) {
      throw new Error('Expected #game-root and its canvas to exist.');
    }

    const bounds = canvas.getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      rootWidth: root.clientWidth,
      rootHeight: root.clientHeight,
      boundsWidth: bounds.width,
      boundsHeight: bounds.height,
      boundsLeft: bounds.left,
      boundsTop: bounds.top,
    };
  });
}

// The minimap is an iso DIAMOND (matches src/ui/hud/minimap.ts). Callers pass
// normalized map fractions (cellX/mapWidth, cellY/mapHeight); this projects the
// corresponding cell through the same diamond transform to a screen point.
export async function getMinimapPoint(
  page: Page,
  normalizedX: number,
  normalizedY: number,
): Promise<ScreenPoint> {
  return page.locator('[data-hud="minimap"]').evaluate(
    (canvas: HTMLCanvasElement, point: { x: number; y: number }) => {
      const frame = window.__AOE2_TEST__!.getSnapshot().renderState.frame;
      if (!frame) {
        throw new Error('Expected the minimap frame to exist.');
      }

      const bounds = canvas.getBoundingClientRect();
      // Mirror getMinimapLayout + cellToMinimap in src/ui/hud/minimap.ts. This
      // math is duplicated because the helper runs in page-eval context and
      // cannot import the module — KEEP IN SYNC with minimap.ts (span, the
      // 0.96 margin, hw/hh, originX/originY) if the projection changes.
      const span = frame.mapWidth + frame.mapHeight;
      const margin = 0.96;
      const hw = Math.min(canvas.width / span, (2 * canvas.height) / span) * margin;
      const hh = hw / 2;
      const originX = canvas.width / 2 - ((frame.mapWidth - frame.mapHeight) / 2) * hw;
      const originY = canvas.height / 2 - ((frame.mapWidth + frame.mapHeight) / 2) * hh;

      const cellX = point.x * frame.mapWidth;
      const cellY = point.y * frame.mapHeight;
      const px = originX + (cellX - cellY) * hw;
      const py = originY + (cellX + cellY) * hh;

      const cssScaleX = bounds.width / canvas.width;
      const cssScaleY = bounds.height / canvas.height;
      return {
        x: bounds.left + px * cssScaleX,
        y: bounds.top + py * cssScaleY,
      };
    },
    { x: normalizedX, y: normalizedY },
  );
}
