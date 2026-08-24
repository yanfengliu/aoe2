// Technologies added since v0.3.48, proved reachable — and EFFECTIVE — with a
// mouse.
//
// The same argument as new-unit-reach.spec.ts, one layer further: a technology
// can have a cost, a research time, a passing effect test and still be
// unreachable because no building ever renders its button. And a technology
// that IS reachable can still do nothing, because the research completing and
// the effect landing are two different wires. So each test here clicks the
// real command card and then reads the world for the change it caused.

import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

test.describe('technologies added since v0.3.48 are reachable with a mouse', () => {
  test('the Archery Range researches Parthian Tactics and it armors a cavalry archer', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'new-tech-reach-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Archery Range');

    // Train the unit the technology is FOR, so the armor bump is observed on a
    // unit that already existed when the research completed — the imperative
    // half of the effect, which the combat-state factory cannot cover.
    const trainArcher = page.locator('[data-command="train-cavalry-archer"]');
    await expect(trainArcher).toBeVisible();
    await trainArcher.click();
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(400, 100));

    // Read the armor off the SELECTION PANEL — the number the player actually
    // sees — rather than out of a snapshot.
    expect(await game.selectOwnedUnitDirect(page, 1, 'cavalry-archer')).toBe(true);
    await game.expectSelectionDetail(page, 'armor', '0');
    await game.expectSelectionDetail(page, 'pierce-armor', '0');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    const research = page.locator('[data-command="research-parthian-tactics"]');
    await expect(research).toBeVisible();
    await research.click();
    // 65 s of research at 10 ticks per second, plus room for the queue to start.
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(800, 100));

    // technologies.csv: "+1/+2 AR" — one melee, two pierce, on the unit that
    // was already standing there when the research finished.
    expect(await game.selectOwnedUnitDirect(page, 1, 'cavalry-archer')).toBe(true);
    await game.expectSelectionDetail(page, 'armor', '1');
    await game.expectSelectionDetail(page, 'pierce-armor', '2');

    // A completed research leaves the card, which is how the player sees it
    // is done.
    expect(await game.selectOwnedBuildingDirect(page, 1, 'archery-range')).toBe(true);
    await expect(page.locator('[data-command="research-parthian-tactics"]')).toHaveCount(0);
  });

  test('the Monastery researches Illumination and Theocracy', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'new-tech-reach-fixture');

    expect(await game.selectOwnedBuildingDirect(page, 1, 'monastery')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Monastery');

    // Both are Imperial faith technologies, and the fixture is Imperial, so
    // both buttons should be on the card at once.
    for (const tech of ['illumination', 'theocracy'] as const) {
      expect(await game.selectOwnedBuildingDirect(page, 1, 'monastery')).toBe(true);
      const button = page.locator(`[data-command="research-${tech}"]`);
      await expect(button).toBeVisible();
      await button.click();
      // 65 s and 75 s of research at 10 ticks per second, one after the other.
      await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(900, 100));

      expect(await game.selectOwnedBuildingDirect(page, 1, 'monastery')).toBe(true);
      await expect(page.locator(`[data-command="research-${tech}"]`)).toHaveCount(0);
    }
  });

  // The mechanic the two Monastery technologies act on, driven entirely with a
  // mouse: select a monk, right-click an enemy, watch the villager change
  // sides — and watch the monk report that it is now resting rather than
  // silently being unable to convert anything else.
  test('a monk converts an enemy with a right-click and then reads Resting', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'monk-faith-rest-fixture');

    const monks = (await game.getSnapshot(page)).economyState.units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'monk',
    );
    const target = (await game.getSnapshot(page)).economyState.units.find(
      (unit) => unit.owner === 2 && unit.unitType === 'villager',
    )!;
    expect(monks.length).toBeGreaterThanOrEqual(2);

    // Put the camera on the monks — the fixture's town centre is elsewhere, and
    // the clicks below are real mouse input on the canvas, so the cells have to
    // be in frame.
    await page.evaluate(
      ([x, y]) => window.__AOE2_TEST__!.centerCameraOnWorldPosition(x!, y!),
      [monks[0]!.x, monks[0]!.y],
    );
    expect(await game.selectOwnedUnitDirect(page, 1, 'monk')).toBe(true);
    await expect(page.locator('[data-selection-name]')).toHaveText('Monk');
    const selectedId = (await game.getSnapshot(page)).selectionState.selectedEntityId;
    await game.clickCell(page, target.x, target.y, 'right');
    await page.evaluate(() => window.__AOE2_TEST__!.advanceTicks(200, 100));

    const converted = (await game.getSnapshot(page)).economyState.units.find(
      (unit) => unit.id === target.id,
    );
    expect(converted?.owner).toBe(1);

    // Re-select the monk that did it and read the panel.
    const monk = (await game.getSnapshot(page)).economyState.units.find(
      (unit) => unit.id === selectedId,
    )!;
    await game.clickCell(page, monk.x, monk.y, 'left');
    await expect(page.locator('[data-selection-name]')).toHaveText('Monk');
    await expect(page.locator('[data-selection-activity]')).toContainText('Resting');
  });
});
