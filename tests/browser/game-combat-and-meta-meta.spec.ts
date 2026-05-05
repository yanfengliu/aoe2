import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('browser gameplay smoke tests - game-combat-and-meta (meta)', () => {
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
    expect(parsedBlob.schema).toBe(2);
    expect(parsedBlob.seed).toBe('aoe2-prototype');
    const savedTick: number = parsedBlob.worldSnapshot.tick;
    expect(savedTick).toBeGreaterThan(0);
    const savedFood: number = parsedBlob.worldSnapshot.state['aoe2.playerResources'].find(
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
