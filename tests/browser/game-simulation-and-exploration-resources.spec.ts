import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('browser gameplay smoke tests - game-simulation-and-exploration (resources)', () => {
  test('can select the Town Center and train a villager through the command panel', async ({ page }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await expect(page.locator('[data-selection-entity-icon="town-center"]')).toHaveText('TC');
    await game.expectSelectionDetail(page, 'health', '2400 / 2400');
    await game.expectSelectionDetail(page, 'attack', '5');
    await game.expectSelectionDetail(page, 'armor', '0');
    await game.expectSelectionDetail(page, 'faction', 'Player');
    await game.expectSelectionDetail(page, 'civ', 'Britons');
    await game.expectSelectionDetail(page, 'inventory', '0 / 15 garrisoned');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    await expect(page.locator('[data-placement-mode]')).toHaveCount(0);
    await page.locator('[data-command="train-villager"]').click();

    await expect(page.locator('[data-hud="food"]')).toHaveText('150');
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Villager');
    await expect(page.locator('[data-selection-queue-item="0"]')).not.toContainText('ticks remaining');

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

  test('can inspect visible resources through the HUD selection panel', async ({ page }) => {
    await game.waitForBoot(page);
    const sheepCells = await game.getOwnedResourceCells(page, 1, 'sheep');
    expect(sheepCells.length).toBeGreaterThan(0);

    const initialSnapshot = await game.getSnapshot(page);
    expect(
      initialSnapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1 && resource.owner === 1,
      ),
    ).toBe(true);

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
        sheepCells[0],
      ),
    ).toBe(true);
    const selectedSnapshot = await game.getSnapshot(page);

    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect(page.locator('[data-selection-entity-icon="sheep"]')).toHaveText('SH');
    await game.expectSelectionDetail(page, 'faction', 'Player');
    await game.expectSelectionDetail(page, 'inventory', '100 / 100 food remaining');
    await game.expectSelectionDetailAbsent(page, 'health');
    await game.expectSelectionDetailAbsent(page, 'attack');
    await game.expectSelectionDetailAbsent(page, 'armor');
    await game.expectSelectionDetailAbsent(page, 'civ');
    await expect(page.locator('[data-selection-position]')).toHaveCount(0);
    await expect(page.locator('[data-selection-cycle]')).toHaveCount(0);
    await expect(page.locator('[data-selection-resource]')).toHaveCount(0);
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('renders shoreline fish on water and lets villagers gather food from them', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'fish-fixture');

    const fish = await page.evaluate(() =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.resources.find((resource) => resource.resourceType === 'fish') ?? null,
    );
    expect(fish).not.toBeNull();

    // The iso camera frames the human base; the fish is on distant water, so
    // centre the camera on it via the minimap before the canvas click (matches
    // the owned-sheep test's approach to off-screen targets).
    const fishMinimap = await game.getMinimapPoint(page, (fish?.x ?? 0) / 60, (fish?.y ?? 0) / 36);
    await page.mouse.click(fishMinimap.x, fishMinimap.y);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 16));

    await game.clickCell(page, fish?.x ?? 0, fish?.y ?? 0);
    await expect(page.locator('[data-selection-name]')).toHaveText('Fish');
    await expect(page.locator('[data-selection-entity-icon="fish"]')).toHaveText('F');
    await game.expectSelectionDetail(page, 'faction', 'Neutral');
    await game.expectSelectionDetail(page, 'inventory', `${fish?.amount} / ${fish?.maxAmount} food remaining`);
    await game.expectSelectionDetailAbsent(page, 'health');
    await game.expectSelectionDetailAbsent(page, 'attack');
    await game.expectSelectionDetailAbsent(page, 'armor');
    await game.expectSelectionDetailAbsent(page, 'civ');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        { x: fish?.x ?? 0, y: fish?.y ?? 0 },
      ),
    ).toBe(true);

    await expect.poll(async () => {
      // §6.3 pacing (v0.3.159): 25 ticks per poll — a shore-fish carry is
      // 20 ticks/food plus the wade, far past 1-tick-per-poll inside 15s.
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(25, 100),
      );
      return snapshot.hudState.playerResources.food;
    }, { timeout: 15_000 }).toBeGreaterThan(0);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.economyState.resources.find((resource) => resource.resourceType === 'fish')?.amount ?? 0;
    }, { timeout: 15_000 }).toBeLessThan(fish?.amount ?? 0);
  });

  test('removes depleted resources from the live world instead of rendering zero-amount nodes', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'resource-depletion-fixture');

    await game.clickCell(page, 12, 8);
    await expect(page.locator('[data-selection-name]')).toHaveText('Tree');
    await game.expectSelectionDetailAbsent(page, 'faction');
    await game.expectSelectionDetail(page, 'inventory', '1 / 1 wood remaining');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(12, 8))).toBe(true);

    await expect.poll(async () => {
      // §6.3+§12.4.2 pacing: the walk plus one 26-tick chop per poll tick
      // would outlast the poll budget at 1 tick/poll.
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(25, 100));
      return snapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'tree' && resource.x === 12 && resource.y === 8,
      );
    }, { timeout: 15_000 }).toBe(false);

    const depletedSnapshot = await game.getSnapshot(page);
    expect(
      depletedSnapshot.economyState.resources.some(
        (resource) => resource.resourceType === 'tree' && resource.x === 12 && resource.y === 8,
      ),
    ).toBe(false);
    expect(
      depletedSnapshot.renderState.entities.some(
        (entity) => entity.kind === 'resource' && entity.entityType === 'tree' && entity.x === 10 && entity.y === 8,
      ),
    ).toBe(false);
  });

  test('claims neutral sheep for the player once a nearby scout moves into range', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'sheep-ownership-fixture');

    const initialSnapshot = await game.getSnapshot(page);
    expect(
      initialSnapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep'),
    ).toMatchObject({
      owner: null,
      baseOwner: null,
      x: 10,
      y: 8,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(7, 8))).toBe(true);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return snapshot.economyState.resources.find((resource) => resource.resourceType === 'sheep')?.owner ?? null;
    }).toBe(1);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(10, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Sheep');
    await expect.poll(async () => (await game.getSnapshot(page)).selectionState.owner).toBe(1);
  });

  test('lets the player right-click an owned sheep to walk it to a destination', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'sheep-movement-fixture');

    // Wait for the human villager to claim its adjacent sheep at (20, 19).
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.find(
        (resource) => resource.resourceType === 'sheep' && resource.x === 20 && resource.y === 19,
      )?.owner ?? null;
    }).toBe(1);

    // Select the now-owned sheep at its current cell.
    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(20, 19))).toBe(true);

    // Right-click a destination several tiles away on open terrain.
    const targetX = 14;
    const targetY = 19;
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        { x: targetX, y: targetY },
      ),
    ).toBe(true);

    // Advance enough ticks for the sheep to make visible progress and assert the cell
    // position has shifted toward the target.
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(20, 100));
      const sheep = snapshot.economyState.resources.find(
        (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
      );
      if (!sheep) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(sheep.x - targetX) + Math.abs(sheep.y - targetY);
    }).toBeLessThan(Math.abs(20 - targetX) + Math.abs(19 - targetY));
  });

  test('double clicking an owned sheep selects every visible owned sheep', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'sheep-movement-fixture');

    // Wait for the human villager to claim the adjacent sheep cluster.
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
      return snapshot.economyState.resources.filter(
        (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
      ).length;
    }).toBeGreaterThanOrEqual(2);

    // Snapshot owned sheep positions and the villager position before any selection.
    const ownedSheepCells = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getSnapshot()
        .economyState.resources.filter(
          (resource) => resource.resourceType === 'sheep' && resource.owner === 1,
        )
        .map((resource) => ({ x: resource.x, y: resource.y })),
    );
    expect(ownedSheepCells.length).toBeGreaterThanOrEqual(2);

    // The sheep cluster is at (19-20, 18-19); the default camera is centered on the
    // human TC at (4, 4), so the sheep may land off the rendered canvas. Click the
    // minimap to center the camera on the sheep before issuing the canvas clicks.
    const minimapPoint = await game.getMinimapPoint(page, 20 / 60, 19 / 36);
    await page.mouse.click(minimapPoint.x, minimapPoint.y);
    // Let the scene flush the new camera position.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 16));

    const renderedSheep = await game.getRenderedOwnedEntitiesByType(page, 1, 'resource', 'sheep');
    expect(renderedSheep.length).toBeGreaterThanOrEqual(ownedSheepCells.length);

    // Double-click the first visible sheep body. The first click selects the single
    // sheep; the second (inside the double-click window) triggers same-type selection
    // expansion to every visible owned sheep.
    await game.doubleClickWorldPosition(
      page,
      (renderedSheep[0]?.x ?? 0) + 0.5,
      (renderedSheep[0]?.y ?? 0) + 0.5,
    );

    const selectedSnapshot = await game.getSnapshot(page);
    expect(selectedSnapshot.selectionState.selectedCount).toBeGreaterThanOrEqual(
      ownedSheepCells.length,
    );
    expect(selectedSnapshot.selectionState.selectedKind).toBe('resource');
    expect(selectedSnapshot.selectionState.owner).toBe(1);
  });

  test('remembers an enemy house with reduced-opacity memory rendering after the scout walks away', async ({ page }) => {
    test.slow();
    await game.waitForBootWithSeed(page, 'fog-memory-fixture');

    // Warm up a couple of ticks so visibility updates run.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(3, 100));

    // Confirm the enemy house starts in live vision (non-memory).
    const initialHouse = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getRenderState()
        .entities.find(
          (entity) =>
            entity.kind === 'building'
            && entity.entityType === 'house'
            && entity.owner === 2,
        ),
    );
    expect(initialHouse).toBeTruthy();
    expect(initialHouse!.isMemory).toBe(false);

    // Select the scout and walk it back near the human TC so the house leaves vision.
    expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueMoveCommand(4, 5))).toBe(true);

    // Poll until the scout arrives — §12.4.2 walk clock: a cross-base return
    // leg is hundreds of ticks now, so stride 40 per poll and give it 30s.
    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(40, 100));
      const scout = snapshot.economyState.units.find(
        (unit) => unit.owner === 1 && unit.unitType === 'scout',
      );
      if (!scout) {
        return Number.POSITIVE_INFINITY;
      }
      return Math.abs(scout.x - 4) + Math.abs(scout.y - 5);
    }, { timeout: 30_000 }).toBeLessThanOrEqual(1);

    // A few more ticks for visibility to settle.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(5, 100));

    const memoryHouse = await page.evaluate(() =>
      window
        .__AOE2_TEST__!.getRenderState()
        .entities.find(
          (entity) =>
            entity.kind === 'building'
            && entity.entityType === 'house'
            && entity.owner === 2,
        ),
    );
    expect(memoryHouse).toBeTruthy();
    expect(memoryHouse!.isMemory).toBe(true);
    expect(memoryHouse!.x).toBe(14);
    expect(memoryHouse!.y).toBe(10);
  });

});
