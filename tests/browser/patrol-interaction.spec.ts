import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

// Attack-move shipped with four green simulation tests while every real click
// threw `Grid coordinates must be integers` and did nothing (v0.3.19). The
// simulation tests call the bridge directly; only driving the actual key and
// click proves the interaction. Patrol reuses that path, so it gets the same
// treatment — including capturing `pageerror`, which is what found the bug.
test.describe('patrol interaction', () => {
  test('P then a left click sets a standing route, and nothing throws', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => { pageErrors.push(error.message); });

    await game.waitForBoot(page);
    expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
    const selected = await page.evaluate(
      () => window.__AOE2_TEST__!.getSelectionState().selectedEntityIds[0] ?? null,
    );
    expect(selected, 'no owned unit to patrol').not.toBeNull();

    const cellOf = async (unitId: number) => page.evaluate((id) => {
      const unit = window.__AOE2_TEST__!.getEconomyState().units
        .find((entry) => entry.id === id);
      return unit ? { x: unit.x, y: unit.y } : null;
    }, unitId);
    const start = await cellOf(selected!);
    expect(start).not.toBeNull();

    await page.keyboard.press('p');

    // Click well clear of the HUD panels: a click at 60%/55% lands on the
    // SELECTION panel and produces no order at all, which looks exactly like a
    // broken feature (v0.3.19 finding).
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(
      box!.x + box!.width * 0.35,
      box!.y + box!.height * 0.38,
    );

    // Assert the BEHAVIOUR rather than a debug field: the unit leaves, and then
    // comes back. Leaving alone would also be true of an attack-move; coming
    // back without another order is what makes it a patrol.
    //
    // The walk is stepped, two ticks a look, once the click has queued the
    // order (work 123). It was waited for in real time, 250 ms a look for at
    // most 60 looks: about 150 ticks at full speed, sampled every 2.5 ticks,
    // and 7 s of this test's 30 s on CI, where slow frames slow the clock
    // too. 100 looks of two ticks, 200 ticks, cover that horizon and sample
    // more finely; the frame loop still draws between looks.
    await page.evaluate(() => { window.__AOE2_TEST__!.setPaused(true); });
    const stepAndLook = async (unitId: number) => page.evaluate((id) => {
      const api = window.__AOE2_TEST__!;
      api.stepTicks(2, 100);
      const unit = api.getEconomyState().units.find((entry) => entry.id === id);
      return unit ? { x: unit.x, y: unit.y } : null;
    }, unitId);
    let left = false;
    let returned = false;
    for (let attempt = 0; attempt < 100 && !returned; attempt += 1) {
      const now = await stepAndLook(selected!);
      if (!now) break;
      const distance = Math.abs(now.x - start!.x) + Math.abs(now.y - start!.y);
      if (distance >= 3) left = true;
      else if (left && distance <= 1) returned = true;
    }

    expect(pageErrors, `page threw: ${pageErrors.join(' | ')}`).toEqual([]);
    expect(left, 'the click produced no movement at all').toBe(true);
    expect(returned, 'the unit walked off and never came back').toBe(true);
  });
});
