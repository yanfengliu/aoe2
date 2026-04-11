import {
  expect,
  type Page,
  test,
} from '@playwright/test';

import type {
  BrowserTestSnapshot,
} from '../../src/app/bootstrap/browserTestApi';

interface MinimapStats {
  width: number;
  height: number;
  nonBackgroundPixelCount: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

async function waitForBoot(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect(page.locator('[data-hud="seed"]')).toHaveText('aoe2-prototype');
  await expect.poll(async () => {
    const snapshot = await getSnapshot(page);
    return snapshot.hudState.tick;
  }).toBeGreaterThan(0);
}

async function getSnapshot(
  page: Page,
): Promise<BrowserTestSnapshot> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSnapshot());
}

async function getMinimapStats(
  page: Page,
): Promise<MinimapStats> {
  return page.locator('[data-hud="minimap"]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Expected the minimap canvas to have a 2D context.');
    }

    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let nonBackgroundPixelCount = 0;

    for (let index = 0; index < image.data.length; index += 4) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];

      if (red !== 8 || green !== 16 || blue !== 18) {
        nonBackgroundPixelCount += 1;
      }
    }

    return {
      width: canvas.width,
      height: canvas.height,
      nonBackgroundPixelCount,
    };
  });
}

async function getScreenPointForCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<ScreenPoint> {
  return page.evaluate(
    ({ cellX: x, cellY: y }) => window.__AOE2_TEST__!.worldToScreen(x, y),
    { cellX, cellY },
  );
}

async function clickCell(
  page: Page,
  cellX: number,
  cellY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  const canvas = page.locator('#game-root canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  await canvas.click({
    position: {
      x: point.x - (bounds?.x ?? 0),
      y: point.y - (bounds?.y ?? 0),
    },
    button,
    force: true,
  });
}

test.describe('browser gameplay smoke tests', () => {
  test('boots into a live simulation and renders the HUD/minimap', async ({ page }) => {
    await waitForBoot(page);

    const snapshot = await getSnapshot(page);
    const minimap = await getMinimapStats(page);

    expect(snapshot.hudState.tick).toBeGreaterThan(0);
    expect(snapshot.hudState.worldSize).toBe('36x24');
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
  });

  test('supports camera panning and zoom with in-game controls', async ({ page }) => {
    await waitForBoot(page);
    const gameCanvas = page.locator('#game-root canvas');
    await gameCanvas.click();

    const initialCamera = (await getSnapshot(page)).cameraState;
    expect(initialCamera).not.toBeNull();

    await page.keyboard.down('KeyD');
    await page.waitForTimeout(250);
    await page.keyboard.up('KeyD');

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.cameraState?.scrollX ?? 0;
    }).toBeGreaterThan((initialCamera?.scrollX ?? 0) + 40);

    const movedCamera = (await getSnapshot(page)).cameraState;
    expect(movedCamera).not.toBeNull();

    const canvasBox = await gameCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    await page.mouse.move(
      (canvasBox?.x ?? 0) + (canvasBox?.width ?? 0) * 0.5,
      (canvasBox?.y ?? 0) + (canvasBox?.height ?? 0) * 0.5,
    );
    await page.mouse.wheel(0, -400);

    await expect.poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.cameraState?.zoom ?? 0;
    }).toBeGreaterThan((movedCamera?.zoom ?? 0) + 0.2);
  });

  test('can fast-forward deterministic economy and exploration behavior', async ({ page }) => {
    await waitForBoot(page);

    const initialSnapshot = await getSnapshot(page);

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(120, 100),
    );

    await expect
      .poll(async () => page.locator('[data-hud="food"]').textContent())
      .toBe(String(advancedSnapshot.hudState.playerResources.food));

    expect(advancedSnapshot.hudState.playerResources.food).toBeGreaterThan(
      initialSnapshot.hudState.playerResources.food,
    );
    expect(advancedSnapshot.hudState.playerResources.wood).toBeGreaterThan(
      initialSnapshot.hudState.playerResources.wood,
    );
    expect(advancedSnapshot.renderState.frame?.exploredCells.length ?? 0).toBeGreaterThan(
      initialSnapshot.renderState.frame?.exploredCells.length ?? 0,
    );
    expect(
      advancedSnapshot.economyState.resources.some(
        (resource) =>
          resource.baseOwner === 1
          && (resource.resourceType === 'sheep' || resource.resourceType === 'tree')
          && resource.amount < resource.maxAmount,
      ),
    ).toBe(true);
    expect(
      advancedSnapshot.economyState.villagers.every((villager) => villager.task !== 'idle'),
    ).toBe(true);
  });

  test('can select the Town Center and train a villager through the command panel', async ({ page }) => {
    await waitForBoot(page);

    await clickCell(page, 8, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('150');
    await expect(page.locator('[data-selection-queue]')).toHaveText('1 queued');

    const advancedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
    );

    await expect(page.locator('[data-hud="pop"]')).toHaveText('5/5');
    expect(
      advancedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(4);
  });

  test('can place and complete a House with villager build controls', async ({ page }) => {
    await waitForBoot(page);

    const villager = (await getSnapshot(page)).economyState.units.find(
      (unit) => unit.owner === 1 && unit.unitType === 'villager',
    );
    expect(villager).toBeDefined();

    await clickCell(page, villager?.x ?? 0, villager?.y ?? 0);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    await clickCell(page, 10, 5);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('175');

    const placedSnapshot = await getSnapshot(page);
    expect(
      placedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.x === 10
          && building.y === 5
          && building.isComplete === false,
      ),
    ).toBe(true);

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    await expect(page.locator('[data-hud="pop"]')).toHaveText('4/10');
    const completedSnapshot = await getSnapshot(page);
    expect(
      completedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'house'
          && building.isComplete,
      ),
    ).toBe(true);
  });
});
