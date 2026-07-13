import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - production', () => {
  test('can train a Camel at the Stable in Castle Age and render its HUD label', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-upgrades-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await expect(page.locator('[data-command="train-camel"]')).toBeVisible();

    await page.locator('[data-command="train-camel"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(260, 100));

    const snapshot = await game.getSnapshot(page);
    const camels = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'camel',
    );
    expect(camels).toHaveLength(1);
    expect(camels[0]).toMatchObject({
      attackDamage: 5,
      attackRange: 1,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'camel')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Camel');
    await expect(
      page.locator('[data-selection-unit-icon="camel"]'),
    ).toHaveText('Cm');
  });

  test('can train a Mangonel at the Siege Workshop in Castle Age and render its HUD label', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'siege-workshop-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'siege-workshop')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Siege Workshop');
    await expect(page.locator('[data-command="train-mangonel"]')).toBeVisible();
    await expect(page.locator('[data-command="train-scorpion"]')).toBeVisible();
    await expect(page.locator('[data-command="train-battering-ram"]')).toBeVisible();

    await page.locator('[data-command="train-mangonel"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

    const snapshot = await game.getSnapshot(page);
    const mangonels = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'mangonel',
    );
    expect(mangonels).toHaveLength(1);
    expect(mangonels[0]).toMatchObject({
      attackDamage: 40,
      attackRange: 7,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'mangonel')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Mangonel');
    await expect(
      page.locator('[data-selection-unit-icon="mangonel"]'),
    ).toHaveText('Mg');
  });

  test('can train a Longbowman at a Britons Castle in Castle Age and render its HUD label', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-unique-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'castle')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Castle');
    await expect(page.locator('[data-command="train-longbowman"]')).toBeVisible();

    await page.locator('[data-command="train-longbowman"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    const snapshot = await game.getSnapshot(page);
    const longbows = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'longbowman',
    );
    expect(longbows).toHaveLength(1);
    expect(longbows[0]).toMatchObject({
      attackDamage: 6,
      attackRange: 6,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'longbowman')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Longbowman');
    await expect(
      page.locator('[data-selection-unit-icon="longbowman"]'),
    ).toHaveText('LB');
  });

  test('can train a Monk at the Monastery, pick up a relic, deposit it, and earn gold income', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'monastery-fixture');

    // Train a Monk at the Monastery.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'monastery')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Monastery');
    await expect(page.locator('[data-command="train-monk"]')).toBeVisible();
    await page.locator('[data-command="train-monk"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(550, 100));

    const monkSnapshot = await game.getSnapshot(page);
    const monks = monkSnapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'monk',
    );
    expect(monks).toHaveLength(1);
    expect(monks[0]).toMatchObject({
      unitType: 'monk',
      attackDamage: 0,
    });

    // Confirm HUD labels.
    expect(await game.selectOwnedUnitDirect(page, 1, 'monk')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Monk');
    await expect(page.locator('[data-selection-unit-icon="monk"]')).toHaveText('Mn');

    // Right-click the neutral relic. The fixture places it at (14, 12). The
    // scene's context-command-at-world uses entity hit-testing, so click the
    // relic's cell.
    const relicCell = await page.evaluate(() => {
      const relic = window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.resources.find((r) => r.resourceType === 'relic');
      return relic ? { x: relic.x, y: relic.y } : null;
    });
    expect(relicCell).not.toBeNull();

    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        relicCell!,
      ),
    ).toBe(true);

    // Wait until the Monk has walked to and picked up the relic (relic
    // position matches Monk position).
    await expect
      .poll(async () => {
        const snapshot = await game.getSnapshot(page);
        const relic = snapshot.economyState.resources.find((r) => r.resourceType === 'relic');
        const monk = snapshot.economyState.units.find(
          (u) => u.owner === 1 && u.unitType === 'monk',
        );
        if (!relic || !monk) return false;
        return relic.x === monk.x && relic.y === monk.y;
      }, { timeout: 30_000 })
      .toBe(true);

    // Record gold before deposit.
    // Right-click the Monastery to deposit. Use the Monastery anchor cell.
    const monasteryAnchor = await page.evaluate(() => {
      const monastery = window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (b) => b.owner === 1 && b.buildingType === 'monastery',
        );
      return monastery ? { x: monastery.x, y: monastery.y } : null;
    });
    expect(monasteryAnchor).not.toBeNull();

    // Re-select the Monk before issuing the deposit.
    expect(await game.selectOwnedUnitDirect(page, 1, 'monk')).toBe(true);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommand(x, y),
        monasteryAnchor!,
      ),
    ).toBe(true);

    // Wait until the relic is no longer in the world (deposited).
    await expect
      .poll(async () => {
        const snapshot = await game.getSnapshot(page);
        return snapshot.economyState.resources.find((r) => r.resourceType === 'relic') === undefined;
      }, { timeout: 30_000 })
      .toBe(true);

    // Sample gold and tick together so we can isolate exactly how many
    // simulation ticks pass alongside the advanceTicks(20, 100) call.
    // The game view's render loop keeps running between page.evaluate() calls,
    // so a plain "advance 20, diff the gold totals" assertion would pick
    // up 1-2 extra ticks of jitter. Capturing the tick counter at both
    // endpoints pins the expectation to exactly the ticks that elapsed.
    const depositBaseline = await page.evaluate(() => {
      const hud = window.__AOE2_TEST__!.getHudState();
      return { tick: hud.tick, gold: hud.playerResources.gold };
    });
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(20, 100));
    const depositAfter = await page.evaluate(() => {
      const hud = window.__AOE2_TEST__!.getHudState();
      return { tick: hud.tick, gold: hud.playerResources.gold };
    });
    const ticksElapsed = depositAfter.tick - depositBaseline.tick;
    // At least the 20 ticks from advanceTicks, allow up to a few more
    // from the game view's own update loop running between evaluate() calls.
    expect(ticksElapsed).toBeGreaterThanOrEqual(20);
    expect(ticksElapsed).toBeLessThanOrEqual(25);
    // Gold income is exactly +1 per tick per stored relic.
    expect(depositAfter.gold - depositBaseline.gold).toBe(ticksElapsed);
  });

  test('can build a Stable and train a Scout Cavalry through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-stable-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-stable"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Stable');
    const stablePlacement = await game.findValidPlacementNearTownCenter(page, 'stable', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        stablePlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('75');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await page.locator('[data-command="train-scout"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('170');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    const playerScouts = trainedSnapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'scout',
    );
    expect(playerScouts).toHaveLength(1);
    expect(playerScouts[0]).toMatchObject({
      attackDamage: 3,
      attackRange: 1,
    });
  });

  test('can train a Spearman and use it to kill a visible Scout through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-spearman-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');
    await page.locator('[data-command="train-spearman"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('215');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('125');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(240, 100));

    expect(await game.selectOwnedUnitDirect(page, 1, 'spearman')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Spearman');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(14, 10))).toBe(true);

    const postCombatSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(80, 100),
    );

    expect(
      postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('shows military units consuming population in the live HUD', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'feudal-spearman-fixture');

    await expect(page.locator('[data-hud="pop"]')).toHaveText('0/5');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await page.locator('[data-command="train-spearman"]').click();

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(230, 100));

    await expect(page.locator('[data-hud="pop"]')).toHaveText('1/5');
  });

  test('can train a Skirmisher and use it to kill a visible Archer through the live command panel', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-skirmisher"]').click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1, 100));
    await expect(page.locator('[data-hud="food"]')).toHaveText('215');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('225');

    const trainedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let tick = 0; tick < 240; tick += 1) {
        snapshot = api.advanceTicks(1, 100);
        if (snapshot.economyState.units.some(
          (unit) => unit.owner === 1 && unit.unitType === 'skirmisher',
        )) {
          break;
        }
      }
      return snapshot;
    });

    expect(trainedSnapshot.economyState.units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: 1, unitType: 'skirmisher' }),
        expect.objectContaining({ owner: 2, unitType: 'archer' }),
      ]),
    );
    const visibleTargetSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let tick = 0; tick < 20; tick += 1) {
        snapshot = api.advanceTicks(1, 100);
        if (snapshot.renderState.entities.some(
          (entity) => entity.owner === 2 && entity.entityType === 'archer',
        )) {
          break;
        }
      }
      return snapshot;
    });
    expect(
      visibleTargetSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
    ).toBe(true);
    expect(
      visibleTargetSnapshot.renderState.entities.some(
        (entity) => entity.owner === 2 && entity.entityType === 'archer',
      ),
    ).toBe(true);
    expect(await game.selectOwnedUnitDirect(page, 1, 'skirmisher')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Skirmisher');
    const enemyArcher = await game.getDisplayedEntityState(page, 2, 'unit', 'archer');
    expect(enemyArcher).not.toBeNull();
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(x + 0.5, y + 0.5),
        { x: enemyArcher?.x ?? 14, y: enemyArcher?.y ?? 10 },
      ),
    ).toBe(true);

    const postCombatSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let tick = 0; tick < 240; tick += 1) {
        snapshot = api.advanceTicks(1, 100);
        if (!snapshot.economyState.units.some(
          (unit) => unit.owner === 2 && unit.unitType === 'archer',
        )) {
          break;
        }
      }
      return snapshot;
    });
    expect(
      postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      ),
    ).toBe(false);
  });
});
