import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - production', () => {
  test('can train a Camel at the Stable in Castle Age and render its HUD label', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'castle-upgrades-fixture', 'Persians');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'stable')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Stable');
    await expect(page.locator('[data-command="train-camel"]')).toBeVisible();

    await page.locator('[data-command="train-camel"]').click();

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(260, 100); });

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

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(500, 100); });

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

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(400, 100); });

    const snapshot = await game.getSnapshot(page);
    const longbows = snapshot.economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'longbowman',
    );
    expect(longbows).toHaveLength(1);
    expect(longbows[0]).toMatchObject({
      attackDamage: 6,
      // 6 base + 1 Britons Castle-Age foot-archer range ladder (v0.3.145).
      attackRange: 7,
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

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(550, 100); });

    const monks = (await game.getEconomyState(page)).units.filter(
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
        .getEconomyState()
        .resources.find((r) => r.resourceType === 'relic');
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
    // position matches Monk position). The match is paused and each poll
    // steps it ten ticks (work 123): waiting on the frame loop's real time took
    // 8.5 s of this test's 30 s on CI's SwiftShader runners, whose slow frames
    // also slow the clock, and the walk is the same ticks either way. Each poll
    // reads the economy in the page and returns only the answer.
    await page.evaluate(() => { window.__AOE2_TEST__!.setPaused(true); });
    await expect
      .poll(() => page.evaluate(() => {
        const api = window.__AOE2_TEST__!;
        api.stepTicks(10, 100);
        const economy = api.getEconomyState();
        const relic = economy.resources.find((r) => r.resourceType === 'relic');
        const monk = economy.units.find((u) => u.owner === 1 && u.unitType === 'monk');
        if (!relic || !monk) return false;
        return relic.x === monk.x && relic.y === monk.y;
      }), { timeout: 30_000, intervals: [10] })
      .toBe(true);

    // Record gold before deposit.
    // Right-click the Monastery to deposit. Use the Monastery anchor cell.
    const monasteryAnchor = await page.evaluate(() => {
      const monastery = window.__AOE2_TEST__!
        .getEconomyState()
        .buildings.find(
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

    // Wait until the relic is no longer in the world (deposited), stepping
    // the paused match ten ticks a poll, as above.
    await expect
      .poll(() => page.evaluate(() => {
        const api = window.__AOE2_TEST__!;
        api.stepTicks(10, 100);
        return api.getEconomyState().resources.find((r) => r.resourceType === 'relic') === undefined;
      }), { timeout: 30_000, intervals: [10] })
      .toBe(true);

    // Sample gold and tick together so we can isolate exactly how many
    // simulation ticks pass alongside the advanceTicks(20, 100) call.
    // The game view's render loop keeps running between page.evaluate() calls,
    // so a plain "advance 20, diff the gold totals" assertion would pick
    // up 1-2 extra ticks of jitter. Capturing the tick counter at both
    // endpoints pins the expectation to exactly the ticks that elapsed.
    // PAUSED, so the only thing that moves the world is this test: the match
    // has been paused since the relic walk above, and is paused again here so
    // this count does not lean on that. Unpaused, the game view's own frame
    // loop advances the simulation in real time between `evaluate()` calls,
    // and how many ticks it slips in depends on machine load — this assertion
    // measured 28 against a 25 ceiling on a busy run. `setPaused` makes
    // `bridge.step` a no-op while `advanceTicks` still works (it unpauses,
    // steps, repauses), so the elapsed count becomes exactly what was asked for
    // and the tolerance band is unnecessary.
    await page.evaluate(() => { window.__AOE2_TEST__!.setPaused(true); });
    const depositBaseline = await page.evaluate(() => {
      const hud = window.__AOE2_TEST__!.getHudState();
      return { tick: hud.tick, gold: hud.playerResources.gold };
    });
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(20, 100); });
    const depositAfter = await page.evaluate(() => {
      const hud = window.__AOE2_TEST__!.getHudState();
      return { tick: hud.tick, gold: hud.playerResources.gold };
    });
    const ticksElapsed = depositAfter.tick - depositBaseline.tick;
    // EXACTLY the 20 requested, because the simulation is paused: nothing but
    // `advanceTicks` can move it. This replaced a 20-25 tolerance band that
    // existed only to absorb the frame loop's real-time drift.
    expect(ticksElapsed).toBe(20);
    // DE's 0.5 gold a second per relic is one gold on every 20th tick, so any 20 ticks pay exactly one (work 127).
    expect(depositAfter.gold - depositBaseline.gold).toBe(ticksElapsed / 20);
  });

  test('can build a Stable and train a Scout Cavalry through the live command panel', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'feudal-stable-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await game.clickBuildCommand(page, 'stable');
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Stable');
    const stablePlacement = await game.findValidPlacementNearTownCenter(page, 'stable', 1, [{ x: 17, y: 8 }]);
    expect(
      await page.evaluate(
        ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
        stablePlacement,
      ),
    ).toBe(true);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('75');

    // §12.4.2 walk clock (v0.3.160): the builder WALKS to the site now, so the
    // construction window carries the commute on top of the build time.
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(900, 100); });

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
      attackDamage: 5, // scout from Feudal on (v0.3.136 hidden buff)
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

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(240, 100); });

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

    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(230, 100); });

    await expect(page.locator('[data-hud="pop"]')).toHaveText('1/5');
  });

  test('can train a Skirmisher and use it to kill a visible Archer through the live command panel', async ({
    page,
  }) => {
    await game.waitForPausedBootWithSeed(page, 'feudal-skirmisher-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');
    await page.locator('[data-command="train-skirmisher"]').click();
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1, 100); });
    // units.csv (and DE): a Skirmisher costs 25 food, 35 wood. Until 2026-09-23
    // the table had the two transposed, and this pinned 215 food / 225 wood.
    await expect(page.locator('[data-hud="food"]')).toHaveText('225');
    await expect(page.locator('[data-hud="wood"]')).toHaveText('215');

    // The per-tick loops step with `stepTicks` and read the one state they
    // check, returning only what is asserted: `advanceTicks` drew the view and
    // built a whole snapshot every tick, and each loop shipped that snapshot
    // back at 0.7-0.9 s a round trip on CI (work 123).
    const trainedUnits = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let units = api.getEconomyState().units;
      for (let tick = 0; tick < 240; tick += 1) {
        api.stepTicks(1, 100);
        units = api.getEconomyState().units;
        if (units.some(
          (unit) => unit.owner === 1 && unit.unitType === 'skirmisher',
        )) {
          break;
        }
      }
      return units.map((unit) => ({ owner: unit.owner, unitType: unit.unitType }));
    });

    expect(trainedUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ owner: 1, unitType: 'skirmisher' }),
        expect.objectContaining({ owner: 2, unitType: 'archer' }),
      ]),
    );
    // This loop reads what is drawn, so it keeps `advanceTicks`, and the view
    // it draws is the one the click below aims at.
    const visibleTarget = await page.evaluate(() => {
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
      return {
        archerAlive: snapshot.economyState.units.some(
          (unit) => unit.owner === 2 && unit.unitType === 'archer',
        ),
        archerDrawn: snapshot.renderState.entities.some(
          (entity) => entity.owner === 2 && entity.entityType === 'archer',
        ),
      };
    });
    expect(visibleTarget.archerAlive).toBe(true);
    expect(visibleTarget.archerDrawn).toBe(true);
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

    const archerSurvived = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const alive = () => api.getEconomyState().units.some(
        (unit) => unit.owner === 2 && unit.unitType === 'archer',
      );
      for (let tick = 0; tick < 240; tick += 1) {
        api.stepTicks(1, 100);
        if (!alive()) break;
      }
      return alive();
    });
    expect(archerSurvived).toBe(false);
  });
});
