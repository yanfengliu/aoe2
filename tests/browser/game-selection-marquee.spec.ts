import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import * as game from './helpers/gameTestHelpers';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test.describe('browser gameplay smoke tests - selection: marquee + activity', () => {
  test('shows a live marquee preview for the exact unit body that will be selected on mouse-up', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'villager-selection-fixture');
    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    const leadVillager = renderedVillagers
      .slice()
      .sort((left, right) => left.x - right.x || left.y - right.y || left.id - right.id)[0] ?? null;
    expect(leadVillager).not.toBeNull();
    const resolvedLeadVillager = leadVillager!;
    const centerX = resolvedLeadVillager.x + 0.5;
    const centerY = resolvedLeadVillager.y + 0.5;
    const halfSize = (resolvedLeadVillager.size * 0.5) * 0.5;

    await game.dragSelectWorldRect(
      page,
      centerX - halfSize,
      centerY - halfSize,
      centerX + halfSize,
      centerY + halfSize,
    );

    const marqueeState = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    const livePreviewState = marqueeState!;
    expect(livePreviewState.active).toBe(true);
    expect(livePreviewState.previewEntityIds).toEqual([resolvedLeadVillager.id]);

    await page.mouse.up({ button: 'left' });

    const snapshot = await game.getSnapshot(page);
    expect(snapshot.selectionState.selectedCount).toBe(1);
    expect(snapshot.selectionState.selectedEntityIds).toEqual([resolvedLeadVillager.id]);
  });

  test('does not preview or select units when the marquee only crosses the visible gap between adjacent unit bodies', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'villager-selection-fixture');
    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    expect(renderedVillagers.length).toBeGreaterThan(1);

    let bestGap:
      | {
        gap: number;
        x: number;
        y: number;
        dx: number;
        dy: number;
      }
      | null = null;
    for (let leftIndex = 0; leftIndex < renderedVillagers.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < renderedVillagers.length; rightIndex += 1) {
        const left = renderedVillagers[leftIndex]!;
        const right = renderedVillagers[rightIndex]!;
        const leftCenterX = left.x + 0.5;
        const leftCenterY = left.y + 0.5;
        const rightCenterX = right.x + 0.5;
        const rightCenterY = right.y + 0.5;
        const leftRadius = left.size * 0.5;
        const rightRadius = right.size * 0.5;
        const dx = rightCenterX - leftCenterX;
        const dy = rightCenterY - leftCenterY;
        const distance = Math.hypot(dx, dy);
        const gap = distance - leftRadius - rightRadius;
        if (gap <= 0.05 || distance <= 0) {
          continue;
        }

        const unitX = dx / distance;
        const unitY = dy / distance;
        const gapX = leftCenterX + unitX * (leftRadius + gap * 0.5);
        const gapY = leftCenterY + unitY * (leftRadius + gap * 0.5);
        if (!bestGap || gap > bestGap.gap) {
          bestGap = { gap, x: gapX, y: gapY, dx, dy };
        }
      }
    }
    expect(bestGap).not.toBeNull();
    const resolvedPreviewGap = bestGap!;
    const stripHalfWidth = Math.min(0.04, resolvedPreviewGap.gap * 0.2);
    const stripHalfLength = 0.3;
    const alignMostlyHorizontally = Math.abs(resolvedPreviewGap.dx) >= Math.abs(resolvedPreviewGap.dy);
    const before = await page.evaluate(() => ({
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
      metrics: window.__AOE2_TEST__!.getWorldRendererState().metrics,
    }));

    if (alignMostlyHorizontally) {
      await game.dragSelectWorldRect(
        page,
        resolvedPreviewGap.x - stripHalfWidth,
        resolvedPreviewGap.y - stripHalfLength,
        resolvedPreviewGap.x + stripHalfWidth,
        resolvedPreviewGap.y + stripHalfLength,
      );
    } else {
      await game.dragSelectWorldRect(
        page,
        resolvedPreviewGap.x - stripHalfLength,
        resolvedPreviewGap.y - stripHalfWidth,
        resolvedPreviewGap.x + stripHalfLength,
        resolvedPreviewGap.y + stripHalfWidth,
      );
    }

    const marqueeState = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    const emptyPreviewState = marqueeState!;
    expect(emptyPreviewState.active).toBe(true);
    expect(emptyPreviewState.previewEntityIds).toEqual([]);
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.presentedRevision === metrics.acceptedRevision
        ? metrics.instances
        : -1;
    })).toBe(before.metrics.instances + 4);
    const marqueeCapture = await page.evaluate(
      () => window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
    );
    expect(sha256(marqueeCapture)).not.toBe(sha256(before.capture));

    await page.mouse.up({ button: 'left' });

    const snapshot = await game.getSnapshot(page);
    expect(snapshot.selectionState.selectedCount).toBe(0);
  });

  test('drag-selects every friendly movable unit in the box while ignoring buildings', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'mixed-selection-fixture');
    const movableUnits = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getRenderState()
        .entities.filter(
          (entity) =>
            entity.kind === 'unit'
            && entity.owner === 1
            && ['villager', 'militia', 'scout'].includes(String(entity.entityType)),
        )
        .map((entity) => ({
          id: entity.id,
          x: entity.x,
          y: entity.y,
          size: entity.size,
        })),
    );
    const minX = Math.min(...movableUnits.map((unit) => unit.x + 0.5 - unit.size * 0.5));
    const maxX = Math.max(...movableUnits.map((unit) => unit.x + 0.5 + unit.size * 0.5));
    const minY = Math.min(...movableUnits.map((unit) => unit.y + 0.5 - unit.size * 0.5));
    const maxY = Math.max(...movableUnits.map((unit) => unit.y + 0.5 + unit.size * 0.5));
    await game.dragSelectWorldRect(page, minX - 0.05, minY - 0.05, maxX + 0.05, maxY + 0.05);

    const marqueeState = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    expect(marqueeState?.active).toBe(true);

    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText('3 Units Selected');
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-icon="militia"]')).toHaveText('M');
    await expect(page.locator('[data-selection-unit-icon="scout"]')).toHaveText('SC');

    const selectedSnapshot = await game.getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(3);
    expect(selectedSnapshot.selectionState.selectedEntityType).toBeNull();

    expect(
      await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(14, 12)),
    ).toBe(true);

    const movedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(40, 100),
    );

    expect(
      movedSnapshot.economyState.units.filter(
        (unit) =>
          unit.owner === 1
          && ['villager', 'militia', 'scout'].includes(unit.unitType)
          && unit.x >= 13
          && unit.y >= 11,
      ),
    ).toHaveLength(3);
  });

  test('keeps the voxel marquee visible while its border crosses a town center', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    const building = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const target = api.getRenderState().entities.find((entity) => (
        entity.kind === 'building'
        && entity.owner === 1
        && entity.entityType === 'town-center'
        && !entity.isMemory
      ));
      return target ? {
        x: target.x,
        y: target.y,
        width: target.footprintWidth,
        height: target.footprintHeight,
      } : null;
    });
    expect(building).not.toBeNull();
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.presentedRevision === metrics.acceptedRevision;
    })).toBe(true);
    const before = await page.evaluate(() => ({
      capture: window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
      instances: window.__AOE2_TEST__!.getWorldRendererState().metrics.instances,
    }));

    await game.dragSelectWorldRect(
      page,
      building!.x + 0.8,
      building!.y + 0.8,
      building!.x + building!.width - 0.8,
      building!.y + building!.height - 0.8,
    );

    const marquee = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionBoxState());
    expect(marquee?.active).toBe(true);
    expect(marquee?.previewEntityIds).toBeDefined();
    const previewRingInstances = (marquee?.previewEntityIds.length ?? 0) * 4;
    await expect.poll(() => page.evaluate(() => {
      const metrics = window.__AOE2_TEST__!.getWorldRendererState().metrics;
      return metrics.presentedRevision === metrics.acceptedRevision
        ? metrics.instances
        : -1;
    })).toBe(before.instances + previewRingInstances + 4);
    const after = await page.evaluate(
      () => window.__AOE2_TEST__!.captureWorldFrame().dataUrl,
    );
    expect(sha256(after)).not.toBe(sha256(before.capture));
    await page.mouse.up({ button: 'left' });
  });

  test('double clicking a friendly unit selects same-type friendly units on screen', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'double-click-selection-fixture');
    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    expect(renderedVillagers).toHaveLength(3);
    const firstVillager = renderedVillagers[0]!;

    await game.doubleClickWorldPosition(
      page,
      firstVillager.x + 0.5,
      firstVillager.y + 0.5,
    );

    await expect(page.locator('[data-selection-name]')).toHaveText('3 Villagers Selected');

    const selectedSnapshot = await game.getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(3);
    expect(selectedSnapshot.selectionState.selectedEntityType).toBe('villager');
  });

  test('shows "Gathering wood" activity for a villager chopping a tree', async ({ page }) => {
    await game.waitForBoot(page);

    // Find any tree resource owned by player 1.
    const treeCells = await game.getOwnedResourceCells(page, 1, 'tree');
    expect(treeCells.length).toBeGreaterThan(0);
    const treeCell = treeCells[0]!;

    // Select a player-1 villager.
    const villagerCells = await game.getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells.length).toBeGreaterThan(0);
    const villagerCell = villagerCells[0]!;
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        villagerCell,
      ),
    ).toBe(true);

    // Issue a gather-wood context command.
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        treeCell,
      ),
    ).toBe(true);

    // Advance ticks until the villager reaches the tree and starts gathering.
    await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let index = 0; index < 120; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const act = snapshot.selectionState.activity;
        const gatheringWood =
          act !== null &&
          typeof act === 'object' &&
          act.verb === 'gathering' &&
          act.target?.kind === 'economy-resource' &&
          act.target?.type === 'wood';
        if (gatheringWood) break;
      }
    });

    await expect(page.locator('[data-selection-activity]')).toContainText('Gathering wood');
  });

  test('shows activity breakdown with "3 idle" for a multi-selection of idle villagers', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');

    // All 3 villagers in this fixture start idle.
    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    expect(renderedVillagers).toHaveLength(3);

    // Box-select all villagers.
    const minX = Math.min(...renderedVillagers.map((unit) => unit.x + 0.5 - unit.size * 0.5));
    const maxX = Math.max(...renderedVillagers.map((unit) => unit.x + 0.5 + unit.size * 0.5));
    const minY = Math.min(...renderedVillagers.map((unit) => unit.y + 0.5 - unit.size * 0.5));
    const maxY = Math.max(...renderedVillagers.map((unit) => unit.y + 0.5 + unit.size * 0.5));
    await game.dragSelectWorldRect(page, minX - 0.05, minY - 0.05, maxX + 0.05, maxY + 0.05);
    await page.mouse.up({ button: 'left' });

    const snapshot = await game.getSnapshot(page);
    expect(snapshot.selectionState.selectedCount).toBe(3);

    await expect(page.locator('[data-selection-activity-multi]')).toContainText('3 idle');
  });

});
