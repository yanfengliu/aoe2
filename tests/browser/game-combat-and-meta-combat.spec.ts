import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - game-combat-and-meta (combat)', () => {
  test('can build a Barracks and train a Militia through the live command panel', async ({
    page,
  }) => {
    test.slow();
    await game.waitForBoot(page);

    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
    await page.locator('[data-command="build-barracks"]').click();
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: Barracks');
    const barracksPlacement = await game.findValidPlacementNearTownCenter(page, 'barracks');
    await game.clickCell(page, barracksPlacement.x, barracksPlacement.y);
    await expect(page.locator('[data-hud="wood"]')).toHaveText('25');

    await game.advanceUntilBuildingComplete(page, 1, 'barracks');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'barracks')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Barracks');
    await page.locator('[data-command="train-militia"]').click();
    await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Militia');

    const trainedSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(260, 100),
    );

    expect(
      trainedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'militia',
      ),
    ).toHaveLength(1);
  });

  test('can command a Militia to attack and kill a visible enemy scout', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'militia-combat-fixture');

    expect(await game.selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    const stagedSnapshot = await game.getSnapshot(page);
    const enemyScout = stagedSnapshot.economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'scout',
    );
    expect(enemyScout).toBeDefined();
    const targetScout = enemyScout!;

    expect(await game.selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    await game.clickCell(page, targetScout.x, targetScout.y, 'right');

    const combatSnapshot = await page.evaluate((targetScoutId) => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 480; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const scoutStillAlive = snapshot.economyState.units.some(
          (unit) => unit.id === targetScoutId,
        );
        if (!scoutStillAlive) {
          break;
        }
      }
      return snapshot;
    }, targetScout.id);

    expect(
      combatSnapshot.economyState.units.some(
        (unit) => unit.id === targetScout.id,
      ),
    ).toBe(false);
  });

  test('can right-click just beyond the rendered body of a moving enemy unit to issue an attack', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'moving-enemy-attack-fixture');
    // PAUSE, because this test aims at a MOVING target. Unpaused, the view's
    // own frame loop advances the simulation in real time, so extra ticks pass
    // between reading the scout's position and clicking beside it — and how
    // many depends on how busy the machine is. That is why this failed twice
    // inside the full suite in one session and passed 4/4 in isolation. Paused,
    // `bridge.step` is a no-op and only `advanceTicks` moves the world, so the
    // scout is exactly where the snapshot said it was. Same class as the
    // fog-memory fixture defect: a browser assertion whose result depends on
    // wall-clock rather than on the game.
    await page.evaluate(() => { window.__AOE2_TEST__!.setPaused(true); });

    const stagedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();

      for (let index = 0; index < 12; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const enemyScout = snapshot.economyState.units.find(
          (unit) => unit.owner === 2 && unit.unitType === 'scout',
        );
        const renderedEnemyScout = snapshot.renderState.entities.find(
          (entity) => entity.id === (enemyScout?.id ?? -1),
        );

        if (
          enemyScout
          && renderedEnemyScout
          && (
            Math.abs(renderedEnemyScout.x - enemyScout.x) > 0
            || Math.abs(renderedEnemyScout.y - enemyScout.y) > 0
          )
        ) {
          return snapshot;
        }
      }

      return snapshot;
    });
    const enemyScout = stagedSnapshot.economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'scout',
    );
    const renderedEnemyScout = stagedSnapshot.renderState.entities.find(
      (entity) => entity.id === (enemyScout?.id ?? -1),
    );

    expect(enemyScout).toBeDefined();
    const targetScout = enemyScout!;
    expect(renderedEnemyScout).toBeDefined();
    const renderedTargetScout = renderedEnemyScout!;
    expect(renderedTargetScout.x).toBeGreaterThan(targetScout.x);
    expect(renderedTargetScout.x).toBeLessThan(targetScout.x + 1);
    const commandTargetOffset = renderedTargetScout.size * 0.5 + 0.1;

    expect(await game.selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    let militiaHasAttackOrder = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const refreshedSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(1, 100),
      );
      const refreshedEnemyScout = refreshedSnapshot.economyState.units.find(
        (unit) => unit.id === targetScout.id,
      );
      const refreshedRenderedEnemyScout = refreshedSnapshot.renderState.entities.find(
        (entity) => entity.id === targetScout.id,
      );

      if (!refreshedEnemyScout) {
        break;
      }

      await page.evaluate(
        ({ targetX, targetY }) =>
          window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(targetX, targetY),
        {
          targetX: (refreshedRenderedEnemyScout ?? refreshedEnemyScout).x + 0.5 + commandTargetOffset,
          targetY: (refreshedRenderedEnemyScout ?? refreshedEnemyScout).y + 0.5,
        },
      );
      const postCommandSnapshot = await game.getSnapshot(page);
      militiaHasAttackOrder =
        postCommandSnapshot.economyState.units.find(
          (unit) => unit.owner === 1 && unit.unitType === 'militia',
        )?.task === 'attacking';
      if (militiaHasAttackOrder) {
        break;
      }
    }
    expect(militiaHasAttackOrder).toBe(true);

    const combatSnapshot = await page.evaluate((targetScoutId) => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 480; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const scoutStillAlive = snapshot.economyState.units.some(
          (unit) => unit.id === targetScoutId,
        );
        if (!scoutStillAlive) {
          break;
        }
      }
      return snapshot;
    }, targetScout.id);

    expect(
      combatSnapshot.economyState.units.some(
        (unit) => unit.id === (enemyScout?.id ?? -1),
      ),
    ).toBe(false);
  });

  test('can command a Militia to destroy a visible enemy house', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'conquest-victory-fixture');

    const stagedSnapshot = await game.getSnapshot(page);
    const enemyHouse = stagedSnapshot.economyState.buildings.find(
      (building) =>
        building.owner === 2
        && building.buildingType === 'house'
    );
    expect(enemyHouse).toBeDefined();

    expect(await game.selectOwnedUnitDirect(page, 1, 'militia')).toBe(true);
    const enemyHouseRender = stagedSnapshot.renderState.entities.find(
      (entity) =>
        entity.owner === 2
        && entity.kind === 'building'
        && entity.entityType === 'house'
        && entity.x === (enemyHouse?.x ?? 10)
        && entity.y === (enemyHouse?.y ?? 8),
    );
    expect(enemyHouseRender).toBeDefined();
    const issuedAttack = await page.evaluate(
      ({ x, y, width, height }) =>
        window.__AOE2_TEST__!.issueContextCommandAtWorldPosition(
          x + width * 0.5,
          y + height * 0.5,
        ),
      {
        x: enemyHouseRender?.x ?? 10,
        y: enemyHouseRender?.y ?? 8,
        width: enemyHouseRender?.footprintWidth ?? 2,
        height: enemyHouseRender?.footprintHeight ?? 2,
      },
    );
    expect(issuedAttack).toBe(true);

    await expect.poll(async () => {
      const combatSnapshot = await page.evaluate(
        () => window.__AOE2_TEST__!.advanceTicks(10, 100),
      );
      return combatSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'house'
          && building.x === (enemyHouse?.x ?? 10)
          && building.y === (enemyHouse?.y ?? 8),
      );
    }, { timeout: 20_000 }).toBe(false);
  });

});
