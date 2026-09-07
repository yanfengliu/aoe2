// DE muscle-memory hotkeys (v0.3.155): H selects the Town Center and
// centres, ',' cycles idle military, F3 pauses, +/- steps the game speed.
// Real key presses per the unwatched-seam rule — a registry entry proves
// nothing about what a keyboard does.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

test.describe('DE control hotkeys', () => {
  test('H selects the Town Center and centres the camera on it', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('h');
    await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
    const centred = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const tc = api.getEconomyState().buildings.find(
        (b) => b.owner === 1 && b.buildingType === 'town-center',
      )!;
      return { tcSelected: api.getSnapshot().selectionState?.selectedEntityId === tc.id };
    });
    expect(centred.tcSelected).toBe(true);
  });

  test("',' selects an idle military unit", async ({ page }) => {
    // los-techs-fixture: a militia parked far from any enemy, so it is
    // still idle when the key lands (auto-aggression empties the cycle in
    // fixtures where soldiers spawn in sight of each other).
    await game.waitForBootWithSeed(page, 'los-techs-fixture');
    await page.keyboard.press(',');
    const selected = await page.evaluate(() => {
      const api = window.__AOE2_TEST__!;
      const id = api.getSnapshot().selectionState?.selectedEntityId;
      const unit = api.getEconomyState().units.find((u) => u.id === id);
      return unit?.unitType ?? null;
    });
    expect(selected).toBe('militia');
  });

  test('F3 pauses and unpauses the simulation', async ({ page }) => {
    await game.waitForBoot(page);
    await page.keyboard.press('F3');
    const tick = async (): Promise<number> => page.evaluate(
      () => window.__AOE2_TEST__!.getSnapshot().hudState.tick,
    );
    const t1 = await tick();
    // FRAMES, not a bare sleep: the clock advances per rendered frame, so a
    // sleep that contained none would report a paused world for a world that
    // was simply never asked to run.
    await game.waitForRenderedFrames(page, 6, 700);
    const t2 = await tick();
    expect(t2, 'F3 pauses: the tick stands still while frames keep rendering').toBe(t1);
    await page.keyboard.press('F3');
    // POLL, not a sleep: asserting after a fixed window asks whether one tick
    // fits in 700ms on THIS host, which is what failed CI run 34041883943 in
    // play-opening. Nothing else moves the clock, so a world that never
    // resumes exhausts the poll.
    await expect.poll(tick, { message: 'F3 unpauses: the world never advanced past the paused tick' })
      .toBeGreaterThan(t2);
  });

  test('+ and - step the game speed ladder', async ({ page }) => {
    await game.waitForBoot(page);
    // A speed ladder IS a rate, so this one legitimately holds a clock — but it
    // reads the clock the sample was actually taken over instead of assuming
    // `waitForTimeout(1000)` slept exactly 1000ms. On a loaded host it sleeps
    // longer, by different amounts each time, and a longer 1.0x window can then
    // out-count a shorter 1.5x one. The floor names a starved host rather than
    // letting integer ticks decide the comparison: below a few ticks per window
    // the difference between 1.0x and 1.5x rounds away.
    const rate = async (): Promise<number> => {
      const sample = async (): Promise<{ tick: number; atMs: number }> => page.evaluate(() => ({
        tick: window.__AOE2_TEST__!.getSnapshot().hudState.tick,
        atMs: performance.now(),
      }));
      const a = await sample();
      await page.waitForTimeout(1000);
      const b = await sample();
      expect(
        b.tick - a.tick,
        `the world advanced ${b.tick - a.tick} ticks in ${Math.round(b.atMs - a.atMs)}ms, too few `
          + 'for one speed to be told from another: this host is starved, not slow at the ladder',
      ).toBeGreaterThanOrEqual(3);
      return (b.tick - a.tick) / ((b.atMs - a.atMs) / 1000);
    };
    const slow = await rate();
    await page.keyboard.press('+');
    const normal = await rate();
    expect(normal).toBeGreaterThan(slow);
    await page.keyboard.press('-');
    const backDown = await rate();
    expect(backDown).toBeLessThan(normal);
  });
});
