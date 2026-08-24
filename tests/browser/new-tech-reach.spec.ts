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
    await game.waitForBootWithSeed(page, 'new-unit-reach-fixture');

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
});
