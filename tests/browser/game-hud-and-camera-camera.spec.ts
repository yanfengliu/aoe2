import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('browser gameplay smoke tests - game-hud-and-camera (camera)', () => {
  test('supports camera panning and zoom with in-game controls', async ({ page }) => {
    await game.waitForBoot(page);
    const gameCanvas = page.locator('.voxel-world-canvas');
    await gameCanvas.click();

    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);

    const movedCamera = (await game.getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();

    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -400);

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.cameraState?.zoom ?? 0;
    }).toBeGreaterThan((movedCamera?.zoom ?? 0) + 0.2);
  });

  test('supports middle-mouse drag panning on the game canvas', async ({ page }) => {
    await game.waitForBoot(page);

    const bounds = await game.getGameCanvasBounds(page);
    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    const dragStartX = bounds.x + bounds.width * 0.55;
    const dragStartY = bounds.y + bounds.height * 0.55;
    const dragEndX = bounds.x + bounds.width * 0.25;
    const dragEndY = bounds.y + bounds.height * 0.35;

    await page.mouse.move(dragStartX, dragStartY);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(dragEndX, dragEndY, { steps: 8 });
    await page.mouse.up({ button: 'middle' });

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return {
        scrollX: snapshot.cameraState?.scrollX ?? 0,
        scrollY: snapshot.cameraState?.scrollY ?? 0,
      };
    }).toMatchObject({
      scrollX: expect.any(Number),
      scrollY: expect.any(Number),
    });

    const movedCamera = (await game.getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();
    expect(movedCamera?.scrollX ?? 0).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);
    expect(movedCamera?.scrollY ?? 0).toBeGreaterThan((initialCamera?.scrollY ?? 0) + 20);
  });

  test('does not pan the camera when the mouse hovers near the screen edge in windowed mode', async ({
    page,
  }) => {
    await game.emulateMonitorSize(page, 1280, 720);
    await game.waitForBoot(page);

    const bounds = await game.getGameCanvasBounds(page);
    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height * 0.5);
    await page.waitForTimeout(900);

    const movedCamera = (await game.getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();
    expect(movedCamera?.scrollX ?? 0).toBe(initialCamera?.scrollX ?? 0);
    expect(movedCamera?.scrollY ?? 0).toBe(initialCamera?.scrollY ?? 0);
  });

  test('pans the camera when the mouse hovers near the screen edge in fullscreen mode', async ({
    page,
  }) => {
    await game.emulateMonitorSize(page, 1280, 720);
    await game.waitForBoot(page);
    await game.enterGameFullscreen(page);

    const bounds = await game.getGameCanvasBounds(page);
    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height * 0.5);
    await page.waitForTimeout(700);

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 35);
  });

  test('stops edge panning immediately after fullscreen exits', async ({ page }) => {
    await game.emulateMonitorSize(page, 1280, 720);
    await game.waitForBoot(page);
    await game.enterGameFullscreen(page);

    const bounds = await game.getGameCanvasBounds(page);
    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height * 0.5);
    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 35);

    await game.exitFullscreen(page);

    const postExitCamera = (await game.getSnapshot(page)).cameraState;
    expect(postExitCamera).not.toBeNull();

    await page.waitForTimeout(700);

    const settledCamera = (await game.getSnapshot(page)).cameraState;
    expect(settledCamera).not.toBeNull();
    expect(settledCamera?.scrollX ?? 0).toBe(postExitCamera?.scrollX ?? 0);
    expect(settledCamera?.scrollY ?? 0).toBe(postExitCamera?.scrollY ?? 0);
  });

  test('pans the camera when the browser window already fills the whole screen', async ({
    page,
  }) => {
    await game.emulateMonitorSize(page, 800, 600);
    await game.waitForBoot(page);

    const bounds = await game.getGameCanvasBounds(page);
    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.mouse.move(bounds.x + bounds.width - 3, bounds.y + bounds.height * 0.5);
    await page.waitForTimeout(700);

    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 35);
  });

  test('clicking the minimap pans the camera toward that map region', async ({ page }) => {
    await game.waitForBoot(page);

    const gameCanvas = page.locator('.voxel-world-canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -1200);

    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await game.clickMinimapAt(page, 0.84, 0.76);

    await expect.poll(async () => (await game.getSnapshot(page)).cameraState?.scrollX ?? 0)
      .toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);

    const movedSnapshot = await game.getSnapshot(page);
    const movedCamera = movedSnapshot.cameraState;
    const frame = movedSnapshot.renderState.frame;
    expect(movedCamera).not.toBeNull();
    expect(frame).not.toBeNull();

    // Iso camera: the minimap is a top-down cell grid, so assert in CELL space.
    // Clicking normalized (0.84, 0.76) centres the camera on cell
    // (0.84*mapWidth, 0.76*mapHeight), clamped so the visible cell AABB stays on
    // the map.
    const mapWidth = frame?.mapWidth ?? 0;
    const mapHeight = frame?.mapHeight ?? 0;
    // Full-review M8: getCameraState now exposes the 4 real view corners;
    // derive the cell-space AABB centre + half-extents from them.
    const cornerXs = (movedCamera?.viewCorners ?? []).map((c) => c.cellX);
    const cornerYs = (movedCamera?.viewCorners ?? []).map((c) => c.cellY);
    const minCellX = Math.min(...cornerXs);
    const maxCellX = Math.max(...cornerXs);
    const minCellY = Math.min(...cornerYs);
    const maxCellY = Math.max(...cornerYs);
    const halfCellW = (maxCellX - minCellX) / 2;
    const halfCellH = (maxCellY - minCellY) / 2;
    const cellCenterX = (minCellX + maxCellX) / 2;
    const cellCenterY = (minCellY + maxCellY) / 2;
    const expectedCellX = Math.min(0.84 * mapWidth, mapWidth - halfCellW);
    const expectedCellY = Math.min(0.76 * mapHeight, mapHeight - halfCellH);
    expect(Math.abs(cellCenterX - expectedCellX)).toBeLessThan(4);
    expect(Math.abs(cellCenterY - expectedCellY)).toBeLessThan(4);
    expect(cellCenterX).toBeLessThanOrEqual(mapWidth + 0.5);
    expect(cellCenterY).toBeLessThanOrEqual(mapHeight + 0.5);
  });

  test('clicking the minimap centers the camera exactly on the clicked world position', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    const gameCanvas = page.locator('.voxel-world-canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -800);

    await game.clickMinimapAt(page, 0.5, 0.5);

    // Iso camera: clicking the minimap centre (0.5, 0.5) centres the camera on
    // the map's middle CELL. Assert the visible cell-AABB centre equals the map
    // middle (no clamp at the centre), within a 1-cell rounding tolerance.
    await expect.poll(async () => {
      const snapshot = await game.getSnapshot(page);
      const camera = snapshot.cameraState;
      const frame = snapshot.renderState.frame;
      if (!camera || !frame) {
        return null;
      }
      // Full-review M8: centre = midpoint of the 4 real view corners' AABB.
      const cxs = camera.viewCorners.map((c) => c.cellX);
      const cys = camera.viewCorners.map((c) => c.cellY);
      const cellCenterX = (Math.min(...cxs) + Math.max(...cxs)) / 2;
      const cellCenterY = (Math.min(...cys) + Math.max(...cys)) / 2;
      return {
        offCentreX: Math.abs(cellCenterX - frame.mapWidth / 2) <= 1,
        offCentreY: Math.abs(cellCenterY - frame.mapHeight / 2) <= 1,
      };
    }).toMatchObject({
      offCentreX: true,
      offCentreY: true,
    });
  });

  test('dragging across the minimap continuously pans the camera', async ({ page }) => {
    await game.waitForBoot(page);

    const initialCamera = (await game.getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await game.dragMinimapTo(page, 0.2, 0.2, 0.82, 0.78);

    await expect.poll(async () => (await game.getSnapshot(page)).cameraState?.scrollX ?? 0)
      .toBeGreaterThan((initialCamera?.scrollX ?? 0) + 60);

    const movedSnapshot = await game.getSnapshot(page);
    const movedCamera = movedSnapshot.cameraState;
    const frame = movedSnapshot.renderState.frame;
    expect(movedCamera).not.toBeNull();
    expect(frame).not.toBeNull();

    // Iso camera: assert in CELL space (the minimap is a top-down cell grid).
    const mapWidth = frame?.mapWidth ?? 0;
    const mapHeight = frame?.mapHeight ?? 0;
    // Full-review M8: getCameraState now exposes the 4 real view corners;
    // derive the cell-space AABB centre + half-extents from them.
    const cornerXs = (movedCamera?.viewCorners ?? []).map((c) => c.cellX);
    const cornerYs = (movedCamera?.viewCorners ?? []).map((c) => c.cellY);
    const minCellX = Math.min(...cornerXs);
    const maxCellX = Math.max(...cornerXs);
    const minCellY = Math.min(...cornerYs);
    const maxCellY = Math.max(...cornerYs);
    const halfCellW = (maxCellX - minCellX) / 2;
    const halfCellH = (maxCellY - minCellY) / 2;
    const cellCenterX = (minCellX + maxCellX) / 2;
    const cellCenterY = (minCellY + maxCellY) / 2;
    const expectedCellX = Math.min(0.82 * mapWidth, mapWidth - halfCellW);
    const expectedCellY = Math.min(0.78 * mapHeight, mapHeight - halfCellH);
    expect(Math.abs(cellCenterX - expectedCellX)).toBeLessThan(4);
    expect(Math.abs(cellCenterY - expectedCellY)).toBeLessThan(4);
  });

  test('the minimap exposes a viewport rectangle that tracks the current camera coverage', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    const gameCanvas = page.locator('.voxel-world-canvas');
    await gameCanvas.click();
    const canvasBounds = await game.getGameCanvasBounds(page);
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 0.5,
      canvasBounds.y + canvasBounds.height * 0.5,
    );
    await page.mouse.wheel(0, -275);

    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(
      canvasBounds.x + canvasBounds.width * 0.5 + 73,
      canvasBounds.y + canvasBounds.height * 0.5 + 41,
      { steps: 6 },
    );
    await page.mouse.up({ button: 'middle' });

    await expect.poll(async () => {
      const viewport = await game.getMinimapViewportState(page);
      const snapshot = await game.getSnapshot(page);
      const frame = snapshot.renderState.frame;
      const camera = snapshot.cameraState;
      const minimap = await game.getMinimapStats(page);

      if (!viewport || !frame || !camera) {
        return false;
      }

      // Iso DIAMOND minimap (v0.1.130): the viewport dataset is the bounding
      // box of the 4 real view corners projected through the diamond transform
      // (mirrors getMinimapLayout + cellToMinimap in src/ui/hud/minimap.ts).
      // Full-review M8: project the actual corners, not their cell-space AABB.
      const span = frame.mapWidth + frame.mapHeight;
      const hw = Math.min(minimap.width / span, (2 * minimap.height) / span) * 0.96;
      const hh = hw / 2;
      const originX = minimap.width / 2 - ((frame.mapWidth - frame.mapHeight) / 2) * hw;
      const originY = minimap.height / 2 - ((frame.mapWidth + frame.mapHeight) / 2) * hh;
      const project = (cellX: number, cellY: number) => ({
        x: originX + (cellX - cellY) * hw,
        y: originY + (cellX + cellY) * hh,
      });
      const corners = camera.viewCorners.map((c) => project(c.cellX, c.cellY));
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const expectedViewport = {
        active: true,
        x: Number(minX.toFixed(2)),
        y: Number(minY.toFixed(2)),
        width: Number((Math.max(...xs) - minX).toFixed(2)),
        height: Number((Math.max(...ys) - minY).toFixed(2)),
      };

      // Tolerance compare (not exact toFixed): the dataset is written one RAF
      // behind the camera snapshot read here, and the diamond bbox folds BOTH
      // cell axes into every coordinate, so a sub-pixel camera drift shifts all
      // four fields. 1.5px tolerance confirms the viewport tracks the AABB
      // without demanding the two frame-lagged reads be bit-identical.
      const near = (a: number, b: number) => Math.abs(a - b) <= 1.5;
      return (
        viewport.active === expectedViewport.active
        && near(viewport.x, expectedViewport.x)
        && near(viewport.y, expectedViewport.y)
        && near(viewport.width, expectedViewport.width)
        && near(viewport.height, expectedViewport.height)
      );
    }).toBe(true);
  });

  test('preserves the game aspect ratio with letterboxing after the browser viewport shrinks', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    const initialSnapshot = await game.getSnapshot(page);
    const worldAspect =
      (initialSnapshot.renderState.frame?.mapWidth ?? 0)
      / (initialSnapshot.renderState.frame?.mapHeight ?? 1);

    await page.setViewportSize({
      width: 520,
      height: 560,
    });

    await expect.poll(async () => {
      const metrics = await game.getGameCanvasMetrics(page);
      const camera = (await game.getSnapshot(page)).cameraState;

      return {
        rootWidth: metrics.rootWidth,
        rootHeight: metrics.rootHeight,
        canvasWidth: metrics.canvasWidth,
        canvasHeight: metrics.canvasHeight,
        cameraWidth: Math.round(camera?.width ?? -1),
        cameraHeight: Math.round(camera?.height ?? -1),
      };
    }).toEqual({
      rootWidth: 520,
      rootHeight: 312,
      canvasWidth: 520,
      canvasHeight: 312,
      cameraWidth: 520,
      cameraHeight: 312,
    });

    const metrics = await game.getGameCanvasMetrics(page);
    expect(metrics.boundsLeft).toBeGreaterThanOrEqual(0);
    expect(metrics.boundsTop).toBeGreaterThanOrEqual(0);
    expect(metrics.boundsWidth).toBe(520);
    expect(metrics.boundsHeight).toBe(312);
    expect(metrics.boundsWidth / metrics.boundsHeight).toBeCloseTo(worldAspect, 2);
  });

  test('prevents zooming out beyond the playable map bounds', async ({ page }) => {
    await game.waitForBoot(page);

    await game.clickMinimapAt(page, 0.88, 0.82);

    const gameCanvas = page.locator('.voxel-world-canvas');
    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );

    for (let index = 0; index < 6; index += 1) {
      await page.mouse.wheel(0, 1200);
    }

    const snapshot = await game.getSnapshot(page);
    const camera = snapshot.cameraState;
    const frame = snapshot.renderState.frame;
    expect(camera).not.toBeNull();
    expect(frame).not.toBeNull();

    // Iso world extent: the map's cell rectangle projects to a diamond whose
    // bounding box has a NEGATIVE min-x (left half). Constants mirror
    // isoProjection (ISO_TILE_WIDTH/2 = 32, ISO_TILE_HEIGHT/2 = 16).
    const mapWidth = frame?.mapWidth ?? 0;
    const mapHeight = frame?.mapHeight ?? 0;
    const worldMinX = -mapHeight * 32;
    const worldMaxX = mapWidth * 32;
    const worldMinY = 0;
    const worldMaxY = (mapWidth + mapHeight) * 16;
    const visibleWorldWidth = (camera?.width ?? 0) / (camera?.zoom ?? 1);
    const visibleWorldHeight = (camera?.height ?? 0) / (camera?.zoom ?? 1);

    // Zoom cannot collapse (a lower floor keeps tiles legible); the visible
    // region must never exceed the playable iso world in either axis.
    expect(camera?.zoom ?? 0).toBeGreaterThan(0.1);
    expect(visibleWorldWidth).toBeLessThanOrEqual(worldMaxX - worldMinX + 0.5);
    expect(visibleWorldHeight).toBeLessThanOrEqual(worldMaxY - worldMinY + 0.5);
    expect(camera?.viewX ?? 0).toBeGreaterThanOrEqual(worldMinX - 0.5);
    expect(camera?.viewY ?? 0).toBeGreaterThanOrEqual(worldMinY - 0.5);
    expect((camera?.viewX ?? 0) + (camera?.viewWidth ?? 0)).toBeLessThanOrEqual(worldMaxX + 0.5);
    expect((camera?.viewY ?? 0) + (camera?.viewHeight ?? 0)).toBeLessThanOrEqual(worldMaxY + 0.5);
  });

});
