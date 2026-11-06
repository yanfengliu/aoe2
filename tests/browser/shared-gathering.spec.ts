import { expect, test, type Page } from '@playwright/test';

import {
  SHARED_GATHERING_SEED,
  SHARED_OPENING,
} from '../../src/game/simulation/fixtures/economyBasics/sharedGathering';
import * as game from './helpers/gameTestHelpers';

// Work 145: DE's opening, by real clicks on the paused shared-gathering
// fixture (spec §6.4, "Several villagers on one node"). A double-click on a
// villager takes the six on screen and a right-click on the sheep under the
// Town Center sends them onto it; all six eat it together, and when it runs
// out all six go on to the next sheep, as DE's shepherds do ("After depleting
// a Sheep, Shepherds will automatically go to another Sheep", Update 108769
// hotfix 109739). Until work 145 a rule cap split them: the first four took
// the next sheep and the other two a third one.
// BOUND: one fixture at the suite's 800x600 and boot framing, six villagers,
// three sheep; who eats is read from the economy (tasks and sheep food), as a
// player reads it from the sheep's food and the villagers' work.
type Economy = Awaited<ReturnType<typeof game.getEconomyState>>;

async function sheepFood(page: Page): Promise<{ a: number; b: number; c: number; ids: { a: number; b: number; c: number } }> {
  const economy = await game.getEconomyState(page);
  const at = (cell: { x: number; y: number }) => economy.resources
    .find((resource) => resource.resourceType === 'sheep' && resource.x === cell.x && resource.y === cell.y);
  const a = at(SHARED_OPENING.A);
  const b = at(SHARED_OPENING.B);
  const c = at(SHARED_OPENING.C);
  return {
    a: a?.amount ?? 0,
    b: b?.amount ?? -1,
    c: c?.amount ?? -1,
    ids: { a: a?.id ?? -1, b: b?.id ?? -1, c: c?.id ?? -1 },
  };
}

const eating = (economy: Economy): number => economy.units
  .filter((unit) => unit.owner === 1 && unit.unitType === 'villager' && unit.task === 'gathering').length;

async function step(page: Page, ticks: number): Promise<void> {
  await page.evaluate((ticks) => { window.__AOE2_TEST__!.stepTicks(ticks, 100); }, ticks);
}

test('six villagers eat one sheep under the Town Center together, and all six go on to the next sheep', async ({ page }) => {
  await game.waitForPausedBootWithSeed(page, SHARED_GATHERING_SEED);
  const start = await sheepFood(page);
  expect(start).toMatchObject({ a: 100, b: 100, c: 100 });

  const villagers = (await game.getEconomyState(page)).units
    .filter((unit) => unit.owner === 1 && unit.unitType === 'villager').map((unit) => unit.id);
  expect(villagers).toHaveLength(6);
  const point = await game.getUnitClickPoint(page, villagers[0]!);
  await page.mouse.move(point.x, point.y);
  await page.mouse.dblclick(point.x, point.y);
  await expect(page.locator('[data-selection-name]')).toHaveText('6 Villagers Selected');
  await game.clickUnit(page, start.ids.a, 'right');

  // All six at the sheep at once, eating only it.
  let together = 0;
  for (let ticks = 0; ticks < 300 && together < 6; ticks += 10) {
    await step(page, 10);
    together = Math.max(together, eating(await game.getEconomyState(page)));
  }
  expect(together, 'the six never ate together').toBe(6);
  const whileOnA = await sheepFood(page);
  expect(whileOnA.a).toBeLessThan(100);
  expect([whileOnA.b, whileOnA.c]).toEqual([100, 100]);

  // Sheep A runs out; every shepherd goes on to B, and C is never touched.
  for (let ticks = 0; ticks < 1_500 && (await sheepFood(page)).a > 0; ticks += 10) await step(page, 10);
  expect((await sheepFood(page)).a, 'sheep A was never eaten').toBe(0);
  let togetherOnB = 0;
  for (let ticks = 0; ticks < 400; ticks += 10) {
    await step(page, 10);
    togetherOnB = Math.max(togetherOnB, eating(await game.getEconomyState(page)));
  }
  const afterA = await sheepFood(page);
  expect(afterA.b, 'nobody went on to the next sheep').toBeLessThan(100);
  expect(afterA.c, 'a shepherd went to a third sheep instead of the next one').toBe(100);
  expect(togetherOnB, 'the six never ate the next sheep together').toBe(6);
});
