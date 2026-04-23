import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - progression and production', () => {
  test('can research Feudal Age and train an Archer through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-age-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-feudal-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Feudal Age');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1320, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Feudal Age');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-archery-range"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Archery Range');
    const archeryRangePlacement = await game.findValidPlacementNearTownCenter(page, 'archery-range');
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        archeryRangePlacement,
      ),
    ).toBe(true);
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-archer"]').click();

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(380, 100),
    );

    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'archer',
      ),
    ).toHaveLength(1);
  });

  test('can research Castle Age and train a Knight through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-age-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="research-castle-age"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Castle Age');
    await expect(page.locator('[data-hud="food"]')).toHaveText('200');
    await expect(page.locator('[data-hud="gold"]')).toHaveText('200');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(1620, 100));

    await expect(page.locator('[data-hud="age"]')).toHaveText('Castle Age');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await page.locator('[data-command="train-knight"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('140');
    await expect(page.locator('[data-hud="gold"]')).toHaveText('125');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    const playerKnights = trainedSnapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'knight',
    );
    expect(playerKnights).toHaveLength(1);
    expect(playerKnights[0]).toMatchObject({
      attackDamage: 10,
      attackRange: 1,
    });
  });

  test('shows locked Town Center age-up buttons before their prerequisites are met', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
    const feudalButton = page.locator('[data-command="research-feudal-age"]');
    await expect(feudalButton).toBeVisible();
    await expect(feudalButton).toBeDisabled();
    await expect(page.locator('[data-command="research-castle-age"]')).toHaveCount(0);
  });

  test('can build an additional Town Center in Castle Age and use it to train a villager', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-town-center-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-town-center"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Town Center');

    const townCenterPlacement = await game.findValidPlacementNearTownCenter(page, 'town-center', 1, [{ x: 14, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        townCenterPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('425');
    await expect(page.locator('[data-hud="stone"]')).toHaveText('250');

    await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let index = 0; index < 420; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const townCenter = snapshot.economyState.buildings.find(
          (building) =>
            building.owner === 1
            && building.buildingType === 'town-center'
            && building.x === 14
            && building.y === 8,
        );
        if (townCenter?.isComplete) {
          break;
        }
      }
    });
    await game.clickCell(page, 18, 10, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(80, 100));

    expect(
      await game.selectOwnedBuildingAtDirect(
        page,
        1,
        'town-center',
        townCenterPlacement.x,
        townCenterPlacement.y,
      ),
    ).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="train-villager"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('150');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(320, 100),
    );

    expect(
      trainedSnapshot.economyState.buildings.filter(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      ),
    ).toHaveLength(2);
    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);
  });

  test('can research Fletching and buff both existing and newly trained Archers', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-blacksmith-fixture');

    let snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 4,
      attackRange: 4,
    });

    expect(await game.selectOwnedBuildingDirect(page, 1, 'blacksmith')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Blacksmith');
    await page.locator('[data-command="research-fletching"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Fletching');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(320, 100));

    snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find((unit) => unit.owner === 1 && unit.unitType === 'archer'),
    ).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-archer"]').click();

    snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(380, 100),
    );

    const playerArchers = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'archer',
    );
    expect(playerArchers).toHaveLength(2);
    expect(
      playerArchers.every((unit) => unit.attackDamage === 5 && unit.attackRange === 5),
    ).toBe(true);
  });

  test('can research the Crossbowman upgrade and swap the Archer train option in the HUD', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-upgrades-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await expect(page.locator('[data-command="train-archer"]')).toBeVisible();
    await expect(page.locator('[data-command="train-crossbowman"]')).toHaveCount(0);

    await page.locator('[data-command="research-crossbowman-upgrade"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Researching: Crossbowman');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(380, 100));

    const snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.find(
        (unit) => unit.owner === 1 && unit.unitType === 'crossbowman',
      ),
    ).toMatchObject({
      attackDamage: 5,
      attackRange: 5,
    });
    expect(
      snapshot.economyState.units.some(
        (unit) => unit.owner === 1 && unit.unitType === 'archer',
      ),
    ).toBe(false);

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-command="train-crossbowman"]')).toBeVisible();
    await expect(page.locator('[data-command="train-archer"]')).toHaveCount(0);
    await expect(page.locator('[data-command="research-crossbowman-upgrade"]')).toHaveCount(0);

    expect(await game.selectOwnedUnitDirect(page, 1, 'crossbowman')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Crossbowman');
    await expect(
      page.locator('[data-selection-unit-icon="crossbowman"]'),
    ).toHaveText('CB');
  });

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

  test('can research Arbalest in Imperial Age and train it through the live command panel', async ({
    page,
  }) => {
    // Slice 7E browser coverage: one canonical Imperial case. The
    // imperial-arbalest-fixture boots the human straight into Imperial
    // Age with an Archery Range and one base Crossbowman, so the test
    // skips the Dark → Feudal → Castle → Imperial climb and focuses on
    // the Arbalest research + train + HUD-label flow.
    await game.waitForBootWithSeed(page, 'imperial-arbalest-fixture');

    await expect(page.locator('[data-hud="age"]')).toHaveText('Imperial Age');

    // Research the Arbalest upgrade at the Archery Range.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await expect(page.locator('[data-command="research-arbalest-upgrade"]')).toBeVisible();
    await page.locator('[data-command="research-arbalest-upgrade"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText(
      'Researching: Arbalest',
    );

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(700, 100));

    // Post-research: the Archery Range swaps its archer-line train slot
    // to Arbalest and the pre-existing Crossbowman has mutated in place.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-command="train-arbalest"]')).toBeVisible();
    await expect(page.locator('[data-command="train-crossbowman"]')).toHaveCount(0);
    await page.locator('[data-command="train-arbalest"]').click();

    const snapshot = await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));
    const arbalests = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'arbalest',
    );
    // One from the pre-existing Crossbowman mutation + one freshly trained.
    expect(arbalests.length).toBeGreaterThanOrEqual(2);
    expect(arbalests[0]).toMatchObject({
      attackDamage: 6,
      attackRange: 5,
    });

    expect(await game.selectOwnedUnitDirect(page, 1, 'arbalest')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Arbalest');
    await expect(
      page.locator('[data-selection-unit-icon="arbalest"]'),
    ).toHaveText('Ab');
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
    // Phaser's render loop keeps running between page.evaluate() calls,
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
    // from Phaser's own update loop running between evaluate() calls.
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
    await game.waitForBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-skirmisher"]').click();
    await expect(page.locator('[data-hud="food"]')).toHaveText('215');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('225');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(240, 100));

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

    await expect.poll(async () => {
      const postCombatSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      return postCombatSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      );
    }, { timeout: 20_000 }).toBe(false);
  });

  test('can build a Watch Tower and let it automatically kill a nearby visible Scout', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-watch-tower-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-watch-tower"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Watch Tower');
    const watchTowerPlacement = await game.findValidPlacementNearTownCenter(page, 'watch-tower', 1, [
      { x: 14, y: 11 },
      { x: 12, y: 10 },
      { x: 12, y: 11 },
      { x: 16, y: 10 },
    ]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        watchTowerPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="stone"]')).toHaveText('75');

    const postTowerSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(520, 100),
    );

    expect(
      postTowerSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 1
          && building.buildingType === 'watch-tower'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      postTowerSnapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('can garrison and ungarrison a villager through the Town Center in the live game', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8))).toBe(true);

    let snapshot = await game.getSnapshot(page);
    expect(
      snapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ),
    ).toHaveLength(2);

    expect(await page.evaluate(() => window.__AOE2_TEST__!.selectEntityAtCell(8, 8))).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    await page.locator('[data-command="action-ungarrison"]').click();

    snapshot = await game.getSnapshot(page);
    const villagersAfterUngarrison = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'villager',
    );
    expect(villagersAfterUngarrison).toHaveLength(3);
    expect(
      villagersAfterUngarrison.some(
        (villager) =>
          villager.x !== 6 && villager.y !== 8 && Math.abs(villager.x - 8) <= 2 && Math.abs(villager.y - 8) <= 2,
      ),
    ).toBe(true);
  });

  test('lets a garrisoned Town Center automatically kill a nearby enemy scout', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'town-center-defense-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(8, 8))).toBe(true);

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(80, 100),
    );

    expect(
      snapshot.economyState.units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'scout',
      ),
    ).toBe(false);
  });

  test('can build a Market and exchange resources through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-market-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-market"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Market');
    const marketPlacement = await game.findValidPlacementNearTownCenter(page, 'market', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        marketPlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('275');

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(280, 100));

    expect(await game.selectOwnedBuildingDirect(page, 1, 'market')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Market');

    const afterBuild = await game.getSnapshot(page);
    await page.locator('[data-command="market-sell-wood"]').click();
    const afterFirstSale = await game.getSnapshot(page);
    expect(afterFirstSale.hudState.playerResources.wood).toBe(
      afterBuild.hudState.playerResources.wood - 100,
    );
    expect(afterFirstSale.hudState.playerResources.gold).toBeGreaterThan(
      afterBuild.hudState.playerResources.gold,
    );

    await page.locator('[data-command="market-buy-food"]').click();
    const afterFirstBuy = await game.getSnapshot(page);
    expect(afterFirstBuy.hudState.playerResources.food).toBe(
      afterFirstSale.hudState.playerResources.food + 100,
    );
    expect(afterFirstBuy.hudState.playerResources.gold).toBeLessThan(
      afterFirstSale.hudState.playerResources.gold,
    );
  });

  test('can set a rally point on an Archery Range so newly trained units move to it automatically', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    expect(await page.evaluate(() => window.__AOE2_TEST__!.issueContextCommand(15, 10))).toBe(true);
    await page.locator('[data-command="train-skirmisher"]').click();

    const postRallySnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 360; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const ralliedUnit = snapshot.economyState.units.find(
          (unit) =>
            unit.owner === 1
            && unit.unitType === 'skirmisher'
            && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
        );
        if (ralliedUnit) {
          break;
        }
      }
      return snapshot;
    });

    expect(
      postRallySnapshot.economyState.units.some(
        (unit) =>
          unit.owner === 1
          && unit.unitType === 'skirmisher'
          && Math.abs(unit.x - 15) + Math.abs(unit.y - 10) <= 1,
      ),
    ).toBe(true);
  });

  test('can place and complete a House with villager build controls', async ({ page }) => {
    test.slow();
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-house"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');

    await game.clickCell(page, 10, 5);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('175');

    const placedSnapshot = await game.getSnapshot(page);
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

    await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      for (let index = 0; index < 700; index += 1) {
        const snapshot = api.advanceTicks(1, 100);
        const isComplete = snapshot.economyState.buildings.some(
          (building) =>
            building.owner === 1
            && building.buildingType === 'house'
            && building.isComplete,
        );
        if (isComplete) {
          return snapshot;
        }
      }

      return api.getSnapshot();
    });

    await expect(page.locator('[data-hud="pop"]')).toHaveText('4/10');
    const completedSnapshot = await game.getSnapshot(page);
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
