import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
test.describe('browser gameplay smoke tests - combat and meta', () => {
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

    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(500, 100));

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

  test('runs the baseline AI barracks rush through the live game loop', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'ai-rush-fixture');

    const advancedSnapshot = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      let snapshot = api.getSnapshot();
      for (let index = 0; index < 2_000; index += 1) {
        snapshot = api.advanceTicks(1, 100);
        const aiBarracksComplete = snapshot.economyState.buildings.some(
          (building) =>
            building.owner === 2
            && building.buildingType === 'barracks'
            && building.isComplete,
        );
        const villagerLossOccurred =
          snapshot.economyState.units.filter(
            (unit) => unit.owner === 1 && unit.unitType === 'villager',
          ).length < 3;
        if (aiBarracksComplete && villagerLossOccurred) {
          break;
        }
      }
      return snapshot;
    });

    expect(
      advancedSnapshot.economyState.buildings.some(
        (building) =>
          building.owner === 2
          && building.buildingType === 'barracks'
          && building.isComplete,
      ),
    ).toBe(true);
    expect(
      advancedSnapshot.economyState.units.filter(
        (unit) => unit.owner === 1 && unit.unitType === 'villager',
      ).length,
    ).toBeLessThan(3);
  });

  test('shows victory after the player destroys the last enemy structure in the conquest fixture', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'conquest-victory-fixture');

    await game.clickCell(page, 8, 8);
    await game.clickCell(page, 10, 8, 'right');

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(220, 100),
    );

    await expect(page.locator('[data-hud="match-summary-text"]')).toHaveText(
      'All enemy forces have been eliminated.',
    );
    expect(snapshot.hudState.matchState.outcome).toBe('victory');
    expect(snapshot.hudState.matchState.summary).toBe('All enemy forces have been eliminated.');
    expect(snapshot.hudState.matchState.winCondition).toBe('conquest');
  });

  test('shows defeat and freezes the sim after the last human structure falls in the defeat fixture', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'conquest-defeat-fixture');

    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(220, 100),
    );

    await expect(page.locator('[data-hud="match-summary-text"]')).toHaveText(
      'All of your units and buildings have been destroyed.',
    );
    expect(snapshot.hudState.matchState.outcome).toBe('defeat');
    expect(snapshot.hudState.matchState.summary).toBe(
      'All of your units and buildings have been destroyed.',
    );
    expect(snapshot.hudState.matchState.winCondition).toBe('conquest');

    const frozenTick = snapshot.hudState.tick;
    const nextSnapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(1, 100),
    );

    expect(nextSnapshot.hudState.tick).toBe(frozenTick);
  });

  test('shows Wonder Victory in the post-game card when the Wonder countdown expires', async ({
    page,
  }) => {
    await game.waitForBootWithSeed(page, 'wonder-short-countdown-fixture');

    // Override countdown is 10 ticks in the fixture; advance a comfortable
    // margin past it to let the post-game summary and score computation
    // fully settle.
    const snapshot = await page.evaluate(
      () => window.__AOE2_TEST__!.advanceTicks(40, 100),
    );

    expect(snapshot.hudState.matchState.outcome).toBe('victory');
    expect(snapshot.hudState.matchState.winCondition).toBe('wonder');
    expect(snapshot.hudState.matchState.scores).not.toBeNull();

    await expect(page.locator('[data-hud="match-summary-win-condition"]')).toHaveText(
      'Wonder Victory',
    );
    await expect(page.locator('[data-hud="match-summary-text"]')).toContainText(
      /wonder/i,
    );
  });

  // Slice 11: HUD polish — tooltip hover, debug-overlay F2 cycle, and
  // command-rejection toast surface through the DOM only; no simulation
  // assertions are needed beyond the existing boot.
  test('surfaces a tooltip when hovering a HUD chip', async ({ page }) => {
    await game.waitForBoot(page);

    const tooltip = page.locator('[data-hud="tooltip"]');
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'false');

    await page.locator('[data-hud-chip="food"]').hover();
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
    await expect(tooltip).toContainText(/food/i);

    await page.locator('[data-hud="minimap"]').hover();
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'false');
  });

  test('cycles the debug overlay when F2 is pressed', async ({ page }) => {
    await game.waitForBoot(page);

    const overlay = page.locator('[data-hud="debug-overlay"]');
    await expect(overlay).toHaveAttribute('data-hud-debug-mode', 'off');

    await page.keyboard.press('F2');
    await expect(overlay).toHaveAttribute('data-hud-debug-mode', 'selection-bounds');

    await page.keyboard.press('F2');
    await expect(overlay).toHaveAttribute('data-hud-debug-mode', 'pathing');
    await expect(overlay).toContainText(/pathing/i);

    // Cycle back to off so tests that follow this one on a shared page
    // aren't affected. Slice 12 Task D added the `coarse-vs-fine` mode
    // between `perf` and `off`.
    await page.keyboard.press('F2'); // fog-state
    await page.keyboard.press('F2'); // ai-state
    await page.keyboard.press('F2'); // perf
    await page.keyboard.press('F2'); // coarse-vs-fine
    await expect(overlay).toHaveAttribute('data-hud-debug-mode', 'coarse-vs-fine');
    await expect(overlay).toContainText(/coarse-vs-fine/i);
    await page.keyboard.press('F2'); // off
    await expect(overlay).toHaveAttribute('data-hud-debug-mode', 'off');
  });

  test('mounts the command-rejection toast container in the HUD', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    // The toast container is the single slot the HUD renders rejection
    // messages into. Full rejection-to-toast plumbing is covered by
    // vitest (it exercises the bridge directly); the browser test just
    // confirms the HUD mounts the container so a runtime rejection can
    // appear when triggered in real gameplay.
    await expect(page.locator('[data-hud="toast-container"]')).toHaveCount(1);
  });

  // FU5: Save / Load HUD plumbing. Clicking Save writes the current
  // simulation to localStorage; clicking Load → Restore swaps in a new
  // bridge rehydrated from that blob. After the round trip, gameplay
  // state (tick, resources, unit count) must match the saved state.
  test('saves to localStorage and restores the simulation through the HUD', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    // Ensure nothing is pre-stored so the Load-from-localStorage option
    // only becomes available after Save.
    await page.evaluate(() => {
      window.localStorage.removeItem('aoe2-save-v1');
    });

    // Advance a handful of ticks so the save captures non-trivial state.
    await page.evaluate(() => {
      window.__AOE2_TEST__!.advanceTicks(25, 100);
    });

    await page.locator('[data-hud="save-button"]').click();
    await expect(page.locator('[data-hud="toast-container"]')).toContainText(/saved/i);

    // Parse the stored blob — that's the authoritative snapshot of the
    // moment the Save click fired. The natural Phaser RAF loop keeps
    // ticking between our test commands, so comparing to a pre-click
    // `game.getSnapshot()` would race.
    const storedBlob = await page.evaluate(
      () => window.localStorage.getItem('aoe2-save-v1'),
    );
    expect(storedBlob).not.toBeNull();
    expect(typeof storedBlob).toBe('string');
    const parsedBlob = JSON.parse(storedBlob!);
    expect(parsedBlob.schema).toBe(1);
    expect(parsedBlob.seed).toBe('aoe2-prototype');
    const savedTick: number = parsedBlob.worldSnapshot.tick;
    expect(savedTick).toBeGreaterThan(0);
    const savedFood: number = parsedBlob.sideMaps.playerResources.find(
      ([playerId]: [number, unknown]) => playerId === 1,
    )![1].food;

    // Advance further so the running bridge's state diverges from the
    // saved blob. After loading, those extra ticks must disappear.
    await page.evaluate(() => {
      window.__AOE2_TEST__!.advanceTicks(15, 100);
    });
    const driftedSnapshot = await game.getSnapshot(page);
    expect(driftedSnapshot.hudState.tick).toBeGreaterThan(savedTick);

    // Open Load panel, confirm localStorage restore.
    await page.locator('[data-hud="load-button"]').click();
    await expect(page.locator('[data-hud="load-panel"]')).toBeVisible();
    await page.locator('[data-hud="load-source-localstorage"]').check();
    await page.locator('[data-hud="load-confirm"]').click();
    await expect(page.locator('[data-hud="toast-container"]')).toContainText(/loaded/i);
    await expect(page.locator('[data-hud="load-panel"]')).toBeHidden();

    // The loaded bridge starts at savedTick. The natural RAF loop is
    // also running — so tick may be >= savedTick by the time we observe
    // it. Assert the tick rewound (is <= driftedSnapshot.tick) and that
    // resources match the saved blob.
    const postLoadSnapshot = await game.getSnapshot(page);
    expect(postLoadSnapshot.hudState.tick).toBeGreaterThanOrEqual(savedTick);
    expect(postLoadSnapshot.hudState.tick).toBeLessThan(driftedSnapshot.hudState.tick);

    // Resources captured at the exact load moment must match the saved
    // blob — a few frames of natural RAF post-load won't change food
    // unless a drop-off fires, which the early-game fixture won't
    // trigger for 2-3 frames of wall-clock.
    expect(postLoadSnapshot.economyState.playerResources[1]!.food).toBe(savedFood);
  });

  // Iter-2 V5-4: Save flow drops back to a download when localStorage is
  // unavailable (private browsing, quota exhausted, security context).
  // Pre-fix the Save handler returned early after toasting "Save failed
  // (storage unavailable)" without invoking the existing
  // triggerBlobDownload fallback, losing the JSON blob entirely.
  test('save invokes the download fallback when localStorage.setItem throws (review V5-4)', async ({
    page,
  }) => {
    await game.waitForBoot(page);

    await page.evaluate(() => {
      window.localStorage.removeItem('aoe2-save-v1');
    });

    // Make localStorage.setItem throw to simulate quota / private mode,
    // and intercept URL.createObjectURL to record fallback download
    // attempts (anchor.click() triggers the browser's download chrome
    // but Playwright's download event is racy here; the URL hook is
    // deterministic).
    await page.evaluate(() => {
      const w = window as unknown as {
        __saveFailureRestore?: () => void;
        __downloadAttempts: number;
      };
      const originalSet = Storage.prototype.setItem;
      const originalCreate = URL.createObjectURL.bind(URL);
      w.__downloadAttempts = 0;
      Storage.prototype.setItem = function setItemStub() {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };
      URL.createObjectURL = (blob: Blob) => {
        if (blob.type === 'application/json') {
          w.__downloadAttempts += 1;
        }
        return originalCreate(blob);
      };
      w.__saveFailureRestore = () => {
        Storage.prototype.setItem = originalSet;
        URL.createObjectURL = originalCreate;
      };
    });

    await page.locator('[data-hud="save-button"]').click();

    // Toast text confirms the fix's branch: storage unavailable but
    // download triggered.
    await expect(page.locator('[data-hud="toast-container"]')).toContainText(
      /storage unavailable/i,
    );
    await expect(page.locator('[data-hud="toast-container"]')).toContainText(
      /downloaded/i,
    );

    // Download fallback was actually invoked.
    const downloadAttempts = await page.evaluate(() => {
      const w = window as unknown as { __downloadAttempts: number };
      return w.__downloadAttempts;
    });
    expect(downloadAttempts).toBeGreaterThanOrEqual(1);

    // Storage was never written.
    const storedAfterFailure = await page.evaluate(
      () => window.localStorage.getItem('aoe2-save-v1'),
    );
    expect(storedAfterFailure).toBeNull();

    // Restore so subsequent tests in the file aren't affected.
    await page.evaluate(() => {
      const w = window as unknown as { __saveFailureRestore?: () => void };
      w.__saveFailureRestore?.();
    });
  });
});
