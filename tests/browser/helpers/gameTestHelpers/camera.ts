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
    const canvas = document.querySelector('.voxel-world-canvas');
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

/**
 * Waits until the page has actually RENDERED `frames` animation frames, and
 * until at least `minElapsedMs` of wall clock has passed alongside them.
 *
 * Use this instead of `page.waitForTimeout` before asserting that something
 * did NOT move. Everything the camera and the renderer do accrues per rendered
 * frame, so a fixed sleep on a loaded host can contain no frame at all, and a
 * check that cannot tell "it held still" from "it was never asked to move"
 * reports the second as the first. CI's runner rendered exactly ONE frame
 * inside the 250 ms this repo's pan test used to hold a key (2026-09-06).
 *
 * Throws by name when the frames never arrive, so a page whose animation loop
 * has died fails as itself rather than as whatever is asserted next.
 *
 * BOUND: it counts the BROWSER's frames, not the app's. If the game's own frame
 * loop has stopped while the browser keeps painting — `frameHalt` after a throw
 * is the way that happens — this still returns, and a "nothing moved" assertion
 * after it is as vacuous as it was after a sleep. What it rules out is the case
 * that produced the CI failure: a wait that contained no frame at all.
 */
export async function waitForRenderedFrames(
  page: Page,
  frames: number,
  minElapsedMs = 0,
  budgetMs = 15_000,
): Promise<{ frames: number; elapsedMs: number }> {
  const result = await page.evaluate(
    ({ wanted, minMs, budget }) => new Promise<{
      frames: number;
      elapsedMs: number;
      timedOut: boolean;
    }>((resolve) => {
      const startedAt = performance.now();
      let seen = 0;
      let settled = false;
      const finish = (timedOut: boolean): void => {
        if (settled) return;
        settled = true;
        resolve({ frames: seen, elapsedMs: performance.now() - startedAt, timedOut });
      };
      // A plain timer, because requestAnimationFrame is the very thing that
      // may not be running.
      window.setTimeout(() => finish(true), budget);
      const step = (): void => {
        seen += 1;
        if (seen >= wanted && performance.now() - startedAt >= minMs) {
          finish(false);
          return;
        }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }),
    { wanted: frames, minMs: minElapsedMs, budget: budgetMs },
  );
  if (result.timedOut) {
    throw new Error(
      `Waited ${Math.round(result.elapsedMs)}ms for ${frames} rendered frames and saw ${result.frames}: `
      + 'the page is not animating, so nothing that accrues per frame — the camera, the renderer, the '
      + 'simulation clock — can have moved, and a "nothing moved" assertion after this would be '
      + 'measuring the stopped frame loop rather than the game.',
    );
  }
  return { frames: result.frames, elapsedMs: result.elapsedMs };
}

/**
 * Holds a camera key until the view has covered `distancePx`, and reports how
 * far it actually got.
 *
 * The keyboard pan accrues per RENDERED FRAME and each frame contributes at
 * most `MAX_CAMERA_FRAME_DELTA_MS` (100 ms, `src/app/AoeVoxelGameView.ts`) of
 * motion, so a key held for a fixed slice of wall clock covers whatever the
 * host's frame rate allowed — 35 px on CI's loaded runner where this machine
 * covers about 90 px in the same 250 ms.
 *
 * Returns short of the distance when the camera stops moving across
 * consecutive rendered frames: that is the world edge, which is an answer and
 * not a failure. A caller that needs the movement asserts on the number.
 */
export async function panWithKeyUntilMoved(
  page: Page,
  key: string,
  distancePx: number,
  budgetFrames = 90,
): Promise<number> {
  const readCentre = async (): Promise<{ x: number; y: number }> => page.evaluate(() => {
    const camera = window.__AOE2_TEST__!.getSnapshot().cameraState;
    return { x: camera?.scrollX ?? 0, y: camera?.scrollY ?? 0 };
  });
  const start = await readCentre();
  let previous = start;
  let stalledFrames = 0;
  let covered = 0;
  await page.keyboard.down(key);
  try {
    for (let frame = 0; frame < budgetFrames; frame += 1) {
      await waitForRenderedFrames(page, 1);
      const now = await readCentre();
      covered = Math.hypot(now.x - start.x, now.y - start.y);
      if (covered >= distancePx) break;
      // Two consecutive still frames, not one: this helper's frame callback and
      // the app's own are both once per frame but in an unpinned order, so a
      // single unchanged sample can be a one-frame lag rather than the edge.
      stalledFrames = now.x === previous.x && now.y === previous.y ? stalledFrames + 1 : 0;
      if (stalledFrames >= 2) break;
      previous = now;
    }
  } finally {
    await page.keyboard.up(key);
  }
  return covered;
}

export async function getGameCanvasBounds(page: Page): Promise<NonNullable<Awaited<ReturnType<ReturnType<Page['locator']>['boundingBox']>>>> {
  const canvas = page.locator('.voxel-world-canvas');
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
    const canvas = document.querySelector<HTMLCanvasElement>('.voxel-world-canvas');
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
