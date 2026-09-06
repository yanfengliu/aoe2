import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('browser gameplay smoke tests - selection: click', () => {
  test('selects a town center by clicking its raised voxel tower roof', async ({ page }) => {
    await game.waitForPausedBootWithSeed(page, 'voxel-raised-picking');
    const target = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const building = api.getRenderState().entities.find((entity) => (
        entity.kind === 'building'
        && entity.owner === 1
        && entity.entityType === 'town-center'
        && !entity.isMemory
      ));
      const camera = api.getCameraState();
      if (!building || !camera) return null;
      const groundCenter = api.worldToScreen(
        building.x + building.footprintWidth / 2 - 0.5,
        building.y + building.footprintHeight / 2 - 0.5,
      );
      const verticalPixelsPerWorldUnit = 64 / Math.SQRT2 * Math.sqrt(1 - (32 / 64) ** 2);
      return {
        id: building.id,
        x: groundCenter.x,
        y: groundCenter.y - 2.61 * verticalPixelsPerWorldUnit * camera.zoom,
      };
    });
    expect(target).not.toBeNull();
    const resolved = target!;
    expect(await page.evaluate(({ x, y }) => (
      document.elementFromPoint(x, y)?.classList.contains('voxel-world-canvas') ?? false
    ), resolved)).toBe(true);

    await page.mouse.click(resolved.x, resolved.y);

    await expect.poll(() => page.evaluate(() => (
      window.__AOE2_TEST__!.getSelectionState().selectedEntityId
    ))).toBe(resolved.id);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
  });

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

  test('only advances an overlapping exact-click stack at the same presented hit point', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'tile-selection-cycle-fixture');
    const stackPoint = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      api.setPaused(true);
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

      // Aim at the MIDDLE of the region where all three bodies answer one
      // click, and measure how many screen pixels of room that middle has.
      //
      // The previous scan walked a grid of world offsets in raster order and
      // took the first one that cycled. Raster order reaches a region at its
      // tip — a point with no margin in at least one direction — and the
      // presented hit polygons are evaluated at the renderer's animation
      // clock, which advances with simulation display time. A host that
      // reaches a different tick before this scan freezes the world reads the
      // bodies at a different phase, the region's edge moves by about half a
      // pixel, and a click at the tip lands outside it. That is how this test
      // failed on a slow Linux runner while passing here. Nothing about what
      // the four clicks must DO changes below; only where they are aimed.
      //
      // Pixels, not cells, because a pixel is what the pointer can be wrong
      // by. These are iso pixels before the camera zoom (>= 1), so the real
      // on-screen margin is at least this.
      const HALF_TILE_WIDTH = 32;
      const HALF_TILE_HEIGHT = 16;
      const ground = { x: militia.x + 0.5, y: militia.y + 0.5 };
      const worldAt = (isoX: number, isoY: number): { x: number; y: number } => {
        const halfDifference = isoX / HALF_TILE_WIDTH;
        const halfSum = isoY / HALF_TILE_HEIGHT;
        return {
          x: ground.x + (halfDifference + halfSum) / 2,
          y: ground.y + (halfSum - halfDifference) / 2,
        };
      };
      const cycles = (isoX: number, isoY: number): boolean => {
        const point = worldAt(isoX, isoY);
        api.selectEntityAtWorldPosition(-10, -10);
        const sequence: Array<string | null> = [];
        for (let click = 0; click < 4; click += 1) {
          if (!api.selectEntityAtWorldPosition(point.x, point.y)) break;
          sequence.push(api.getSnapshot().selectionState.selectedEntityType);
          // Cheap reject: the cycle can only read militia,house,sheep,militia
          // if it opens on the militia, so a point that opens on anything else
          // costs one click instead of four. Same verdict, and it is what
          // keeps this search inside the test's own timeout.
          if (click === 0 && sequence[0] !== 'militia') break;
        }
        return sequence.join(',') === 'militia,house,sheep,militia';
      };

      // Up the militia's body: its voxels are drawn straight up the screen
      // from its ground point, so this crosses the stack from its feet to
      // above its head. Take the middle of the longest run that cycles.
      const COLUMN_TOP = -40;
      const COLUMN_STEP = 2;
      let bestRun: { from: number; to: number } | null = null;
      let runStart: number | null = null;
      for (let isoY = 0; isoY >= COLUMN_TOP - COLUMN_STEP; isoY -= COLUMN_STEP) {
        const ok = isoY >= COLUMN_TOP && cycles(0, isoY);
        if (ok && runStart === null) runStart = isoY;
        if (!ok && runStart !== null) {
          const run = { from: runStart, to: isoY + COLUMN_STEP };
          if (!bestRun || run.from - run.to > bestRun.from - bestRun.to) bestRun = run;
          runStart = null;
        }
      }
      if (!bestRun) {
        api.selectEntityAtWorldPosition(-10, -10);
        return { ...ground, marginPx: -1, runPx: 0 };
      }
      const midIsoY = (bestRun.from + bestRun.to) / 2;

      // How far off in ANY screen direction the click may be. Eight compass
      // points per radius, growing until one of them stops cycling.
      const MAX_MARGIN_PX = 4;
      const COMPASS = 8;
      let marginPx = 0;
      for (let radius = 1; radius <= MAX_MARGIN_PX; radius += 1) {
        let whole = true;
        for (let point = 0; point < COMPASS && whole; point += 1) {
          const angle = (point / COMPASS) * Math.PI * 2;
          if (!cycles(Math.cos(angle) * radius, midIsoY + Math.sin(angle) * radius)) whole = false;
        }
        if (!whole) break;
        marginPx = radius;
      }

      api.selectEntityAtWorldPosition(-10, -10);
      return {
        ...worldAt(0, midIsoY),
        marginPx,
        runPx: bestRun.from - bestRun.to,
      };
    });
    expect(stackPoint).not.toBeNull();
    const resolvedStackPoint = stackPoint!;
    // The fixture's three bodies are meant to genuinely cover one another, so
    // a player clicking the stack has room to be several pixels off. When they
    // only grazed each other, 4 of the 625 offsets the old scan probed
    // qualified, in a ribbon one sample wide whose best margin was a fraction
    // of one pixel — this test passed for as long as the animation phase
    // happened to agree. Fail on the fixture, not on a click.
    expect(
      resolvedStackPoint.marginPx,
      'no click point on tile-selection-cycle-fixture has 2 screen pixels of room in every '
      + 'direction: the militia, house and sheep no longer overlap enough to cycle from a '
      + `stable point. Best margin ${resolvedStackPoint.marginPx} px, over a `
      + `${resolvedStackPoint.runPx} px run up the militia's body (-1 means no point on that `
      + 'line cycles all three at all)',
    ).toBeGreaterThanOrEqual(2);

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

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtWorldPosition(x, y),
        resolvedStackPoint,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtWorldPosition(x, y),
        resolvedStackPoint,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Militia');
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
          && authority.task === 'moving'
          && (Math.floor(displayed.x) !== villager.x || Math.floor(displayed.y) !== villager.y)
        ) {
          for (let offsetY = -0.3; offsetY <= 0.3; offsetY += 0.1) {
            for (let offsetX = -0.3; offsetX <= 0.3; offsetX += 0.1) {
              // A second villager can legitimately cover the root centre. Probe
              // the moving body's exposed area and reset exact-click cycling
              // between points so the target must win the current hit test.
              api.selectEntityAtWorldPosition(-10, -10);
              const didSelect = api.selectEntityAtWorldPosition(
                displayed.x + 0.5 + offsetX,
                displayed.y + 0.5 + offsetY,
              );
              const selectionState = api.getSnapshot().selectionState;
              if (didSelect && selectionState.selectedEntityId === villager.id) {
                return {
                  didSelect,
                  selectedCount: selectionState.selectedCount,
                  selectedEntityId: selectionState.selectedEntityId,
                  villagerId: villager.id,
                  task: authority.task,
                };
              }
            }
          }
        }
      }

      return null;
    });
    expect(selectionResult).not.toBeNull();
    const resolvedSelectionResult = selectionResult!;
    expect(resolvedSelectionResult.didSelect).toBe(true);
    expect(resolvedSelectionResult.selectedCount).toBe(1);
    expect(resolvedSelectionResult.selectedEntityId).toBe(resolvedSelectionResult.villagerId);
    expect(resolvedSelectionResult.task).toBe('moving');
  });

  test('does not select a unit when the click lands in the visible gap between adjacent unit bodies', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'villager-selection-fixture');
    const renderedVillagers = await game.getRenderedOwnedUnits(page, 1, 'villager');
    expect(renderedVillagers.length).toBeGreaterThan(1);

    const bestGap = game.findClearGapBetweenUnitBodies(renderedVillagers, 0.02);
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

    // A genuinely player-clickable terrain destination: on screen, and not under
    // the HUD. Which cells qualify depends on the camera and on the HUD's
    // shape, so the test FINDS one near the villagers rather than naming a cell
    // — a hardcoded (14, 7) stopped being visible the moment the default camera
    // moved closer in. The arrival assertion below is what actually has teeth.
    // Clear of the player's own Town Center, whose 4x4 footprint at (8, 8)
    // covers x 8-11 / y 8-11 — right-clicking inside it garrisons instead of
    // moving, which is exactly what the first attempt at this list did.
    const candidates = [
      { x: 10, y: 7 }, { x: 7, y: 7 }, { x: 11, y: 6 },
      { x: 6, y: 8 }, { x: 9, y: 6 }, { x: 12, y: 7 },
    ];
    let destination: { x: number; y: number } | null = null;
    let destinationPoint: { x: number; y: number } | null = null;
    for (const candidate of candidates) {
      const point = await game.getScreenPointForCell(page, candidate.x, candidate.y);
      const onCanvas = await page.evaluate(
        ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('voxel-world-canvas'),
        point,
      );
      if (onCanvas === true) {
        destination = candidate;
        destinationPoint = point;
        break;
      }
    }
    expect(destination, 'no candidate destination cell was clickable terrain').not.toBeNull();
    expect(destinationPoint).not.toBeNull();
    await game.clickCell(page, destination!.x, destination!.y, 'right');

    const movedSnapshot = await page.evaluate((target) => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();

      for (let index = 0; index < 160; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const arrivedCount = snapshot.economyState.units.filter(
          (unit) => unit.owner === 1
            && unit.unitType === 'villager'
            && Math.abs(unit.x - target.x) <= 2
            && Math.abs(unit.y - target.y) <= 2,
        ).length;
        if (arrivedCount === 3) {
          break;
        }
      }

      return snapshot;
    }, destination!);

    // Every villager ends up AT the destination, whichever way it lay from
    // them. The previous half-open box (east of x, north of y) only described
    // arrival for a destination up and to the right of the cluster.
    expect(
      movedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1
          && unit.unitType === 'villager'
          && Math.abs(unit.x - destination!.x) <= 2
          && Math.abs(unit.y - destination!.y) <= 2,
      ),
    ).toHaveLength(renderedVillagers.length);
  });

});
