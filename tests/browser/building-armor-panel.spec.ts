// The selection panel's armor rows read DE's total armor (work 140), checked
// the way a player reads them: through the lobby's default match, a real
// left click on the canvas, and the two rows the HUD draws.
//
// Before work 140 the Town Center read Melee armor 0 and Pierce armor 0, and
// a unit showed only its armor-technology bonus, so the Scout Cavalry read
// 0/0. DE's panel shows the Dark Age Town Center 3/5 and the Scout Cavalry 0/2.
//
// BOUND: the default opening's own Town Center and Scout Cavalry, at the first
// ticks of a running match. Every other building and unit type, age and
// armor technology is tests/simulation/selectionArmorCensus.test.ts's.

import { expect, test } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import * as play from './helpers/playOpening';

const HUMAN = 1;

test('a click on the Dark Age Town Center and the Scout Cavalry shows DE\'s total armor', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = play.collectPageErrors(page);
  await play.startMatchFromLobby(page);

  const townCenter = await play.findMouseReachableEntityAfterScrolling(page, {
    kind: 'building', entityType: 'town-center', owner: HUMAN,
  });
  expect(townCenter, 'the Town Center is not where the mouse can reach it').not.toBeNull();
  await play.clickAt(page, townCenter!.screen);
  await expect.poll(() => play.selectedEntityId(page)).toBe(townCenter!.id);
  await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
  await game.expectSelectionDetail(page, 'armor', '3');
  await game.expectSelectionDetail(page, 'pierce-armor', '5');

  const scout = await play.findMouseReachableEntityAfterScrolling(page, {
    kind: 'unit', entityType: 'scout', owner: HUMAN,
  });
  expect(scout, 'the Scout Cavalry is not where the mouse can reach it').not.toBeNull();
  await play.clickAt(page, scout!.screen);
  await expect.poll(() => play.selectedEntityId(page)).toBe(scout!.id);
  await game.expectSelectionDetail(page, 'armor', '0');
  await game.expectSelectionDetail(page, 'pierce-armor', '2');

  expect(errors.pageErrors, `page threw: ${errors.pageErrors.join(' | ')}`).toEqual([]);
  expect(errors.consoleErrors, `console.error: ${errors.consoleErrors.join(' | ')}`).toEqual([]);
});
