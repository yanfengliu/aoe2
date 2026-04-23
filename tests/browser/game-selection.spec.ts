import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - selection', () => {
  test('shows a player-facing info card for an individually selected unit', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
    const villagerCells = await game.getOwnedUnitCells(page, 1, 'villager');
    expect(villagerCells.length).toBeGreaterThan(0);

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        villagerCells[0],
      ),
    ).toBe(true);

    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-label="villager"]')).toHaveText('Villager');
    await game.expectSelectionDetail(page, 'health', '25 / 25');
    await game.expectSelectionDetail(page, 'attack', '3');
    await game.expectSelectionDetail(page, 'armor', '0');
    await game.expectSelectionDetail(page, 'faction', 'Player');
    await game.expectSelectionDetail(page, 'civ', 'Britons');
    await game.expectSelectionDetail(page, 'inventory', 'Empty');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);
  });

  test('cycles through every selectable entity stacked on a clicked tile', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'tile-selection-cycle-fixture');
    const stackCell = await page.evaluate(() => {
      const house = window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (building) => building.owner === 1 && building.buildingType === 'house',
        );
      return house ? { x: house.x, y: house.y } : null;
    });
    expect(stackCell).not.toBeNull();
    const resolvedStackCell = stackCell!;

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        resolvedStackCell,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');
    await game.expectSelectionDetail(page, 'attack', '4');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        resolvedStackCell,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('House');
    await expect(page.locator('[data-selection-entity-icon="house"]')).toHaveText('H');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        resolvedStackCell,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await game.expectSelectionDetail(page, 'inventory', '100 / 100 food remaining');
  });

  test('only advances an overlapping exact-click stack after a repeated click on the same click cell', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'tile-selection-cycle-fixture');
    const stackPoint = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const militia = api
        .getDisplayedEntities()
        .find(
          (candidate) =>
            candidate.owner === 1
            && candidate.kind === 'unit'
            && candidate.entityType === 'militia',
        );
      if (!militia) {
        return null;
      }

      for (let offsetY = -0.2; offsetY <= 0.2; offsetY += 0.05) {
        for (let offsetX = -0.2; offsetX <= 0.2; offsetX += 0.05) {
          const point = {
            x: militia.x + 0.5 + offsetX,
            y: militia.y + 0.5 + offsetY,
          };
          api.clearSelection();
          if (!api.selectEntityAtWorldPosition(point.x, point.y)) {
            continue;
          }

          const selectionState = api.getSnapshot().selectionState;
          if (
            selectionState.selectedCount === 1
            && selectionState.selectedEntityType === 'militia'
          ) {
            api.selectEntityAtWorldPosition(-10, -10);
            return point;
          }
        }
      }

      return null;
    });
    expect(stackPoint).not.toBeNull();
    const resolvedStackPoint = stackPoint!;
    // The probe loop above uses exact world-position selection to discover a
    // real "Militia wins here" overlap point. Reboot the deterministic fixture
    // so the assertion below starts from a clean scene state.
    await game.waitForBootWithSeed(page, 'tile-selection-cycle-fixture');

    expect(
      await page.evaluate(
        () => window.__AOE2_TEST__!.selectEntityAtCell(13, 12),
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtWorldPosition(x, y),
        resolvedStackPoint,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtWorldPosition(x, y),
        resolvedStackPoint,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('House');
  });

  test('can click the visible body of a moving unit after it has crossed into a new cell', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
    const selectionResult = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const villager = api
        .getSnapshot()
        .economyState.units.find(
          (unit) => unit.owner === 1 && unit.unitType === 'villager',
        );
      if (!villager) {
        return null;
      }

      api.selectEntityAtCell(villager.x, villager.y);
      api.issueMoveCommand(villager.x + 3, villager.y);
      api.clearSelection();

      for (let index = 0; index < 40; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const authority = snapshot.economyState.units.find((unit) => unit.id === villager.id);
        const displayed = api.getDisplayedEntities().find((entity) => entity.id === villager.id);
        if (
          authority
          && displayed
          && (Math.floor(displayed.x) !== authority.x || Math.floor(displayed.y) !== authority.y)
        ) {
          const didSelect = api.selectEntityAtWorldPosition(displayed.x + 0.5, displayed.y + 0.5);
          const selectionState = api.getSnapshot().selectionState;
          return {
            didSelect,
            selectedCount: selectionState.selectedCount,
            selectedEntityId: selectionState.selectedEntityId,
            villagerId: villager.id,
          };
        }
      }

      return null;
    });
    expect(selectionResult).not.toBeNull();
    const resolvedSelectionResult = selectionResult!;
    expect(resolvedSelectionResult.didSelect).toBe(true);
    expect(resolvedSelectionResult.selectedCount).toBe(1);
    expect(resolvedSelectionResult.selectedEntityId).toBe(resolvedSelectionResult.villagerId);
  });

  test('does not select a unit when the click lands in the visible gap between adjacent unit bodies', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
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
        if (gap <= 0.02 || distance <= 0) {
          continue;
        }

        const unitX = dx / distance;
        const unitY = dy / distance;
        const gapX = leftCenterX + unitX * (leftRadius + gap * 0.5);
        const gapY = leftCenterY + unitY * (leftRadius + gap * 0.5);
        if (!bestGap || gap < bestGap.gap) {
          bestGap = { gap, x: gapX, y: gapY, dx, dy };
        }
      }
    }
    expect(bestGap).not.toBeNull();
    const resolvedBestGap = bestGap!;

    await game.clickWorldPosition(page, resolvedBestGap.x, resolvedBestGap.y);

    const snapshot = await game.getSnapshot(page);
    expect(snapshot.selectionState.selectedCount).toBe(0);
  });

  test('shows a marquee while dragging and selects multiple villagers with one drag box', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');

    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    expect(renderedVillagers).toHaveLength(3);
    const minX = Math.min(...renderedVillagers.map((unit) => unit.x + 0.5 - unit.size * 0.5));
    const maxX = Math.max(...renderedVillagers.map((unit) => unit.x + 0.5 + unit.size * 0.5));
    const minY = Math.min(...renderedVillagers.map((unit) => unit.y + 0.5 - unit.size * 0.5));
    const maxY = Math.max(...renderedVillagers.map((unit) => unit.y + 0.5 + unit.size * 0.5));
    await game.dragSelectWorldRect(page, minX - 0.05, minY - 0.05, maxX + 0.05, maxY + 0.05);

    const marqueeState = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionBoxState(),
    );
    expect(marqueeState).not.toBeNull();
    const activeMarqueeState = marqueeState!;
    expect(activeMarqueeState.active).toBe(true);
    expect(activeMarqueeState.width).toBeGreaterThan(0);
    expect(activeMarqueeState.height).toBeGreaterThan(0);

    await page.mouse.up({ button: 'left' });

    await expect(page.locator('[data-selection-name]')).toHaveText(`${renderedVillagers.length} Villagers Selected`);
    await expect(page.locator('[data-selection-unit-icon="villager"]')).toHaveText('V');
    await expect(page.locator('[data-selection-unit-count="villager"]')).toHaveText('x3');

    const selectedSnapshot = await game.getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBe(renderedVillagers.length);

    await game.clickCell(page, 10, 12, 'right');

    const movedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();

      for (let index = 0; index < 80; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const arrivedCount = snapshot.economyState.units.filter(
          (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
        ).length;
        if (arrivedCount === 3) {
          break;
        }
      }

      return snapshot;
    });

    expect(
      movedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.x >= 9 && unit.y >= 11,
      ),
    ).toHaveLength(renderedVillagers.length);
  });

  test('shows a live marquee preview for the exact unit body that will be selected on mouse-up', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
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
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
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

});
