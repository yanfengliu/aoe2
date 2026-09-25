// Stepping through a replayed raid does not re-announce it on every step
// (v0.3.229, the independent review of the attack-warning change).
//
// THE DEFECT, caught before it shipped: the first version of the load fix
// reset the audio controller whenever the bridge object changed. A replay
// builds a new bridge on EVERY step, scrub, marker jump and fog-owner switch,
// and the replayed world carries its recent blows with their participants
// (the hit feed since v0.3.235, which re-simulation refills), so each step
// forgot the throttle and announced the same raid again: a horn
// and a "You are under attack!" toast per step. The fix resets only on a load,
// which createApp announces; a replay step keeps the controller's memory.
//
// THE CLASS this gates: a bridge swap that is not a load must not re-arm the
// warning. The replay is stepped one tick at a time through a raid that lands
// a blow every few ticks, with frames rendered between steps so the audio
// mount polls each replayed world, and the alert toasts raised are counted.
//
// BOUNDS, so a green run is not read for more than it holds:
//  - Forty single-tick steps with the step-forward button, on one recording.
//    Scrubs, marker jumps and fog-owner switches swap the bridge the same way
//    and are not driven here.
//  - Toasts are counted, not horns: the horn is audio, and the two come from
//    one decision in `gameAudioController`, so a horn storm would be a toast
//    storm too. The selection chirp is audio only and is not observed.
//  - At most one toast is allowed while stepping: the replay may announce the
//    replayed raid once, as it happened, because the load that closed the
//    live session reset the throttle.
import { expect, test } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';

const STEPS = 40;

test('stepping through a replayed raid announces it at most once', async ({ page }) => {
  test.slow();
  await page.addInitScript(() => {
    const timer = window.setInterval(() => {
      if (!window.__AOE2_TEST__) return;
      window.__AOE2_TEST__.setPaused(true);
      window.clearInterval(timer);
    }, 0);
  });
  await page.goto('/?seed=raid-warning-fixture');
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  // Count every alert toast the page raises, with the mode it was raised in.
  await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    api.setPaused(true);
    const container = document.querySelector('[data-hud="toast-container"]')!;
    const raised: string[] = [];
    (window as unknown as { __aoe2AlertModes: string[] }).__aoe2AlertModes = raised;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof HTMLElement && node.dataset.hudToastKind === 'alert') {
            raised.push(api.replay.getReplayMode());
          }
        }
      }
    }).observe(container, { childList: true });
  });
  const alertModes = (): Promise<string[]> => page.evaluate(
    () => [...(window as unknown as { __aoe2AlertModes: string[] }).__aoe2AlertModes],
  );

  // The live raid: owner 2's Militia ordered onto the human House.
  await page.evaluate(async () => {
    const api = window.__AOE2_TEST__!;
    const economy = api.getEconomyState();
    const house = economy.buildings.find((building) => building.owner === 1 && building.buildingType === 'house');
    if (!house) throw new Error('raid-warning-fixture must give the human a House to raid.');
    for (const militia of economy.units.filter((unit) => unit.owner === 2 && unit.unitType === 'militia')) {
      const result = await api.agent.dispatchAgentCommand(
        { type: 'unit.attack', data: { unitId: militia.id, targetEntityId: house.id, targetEntityKind: 'building' } },
        { expectedOwner: 2 },
      );
      if (!result.accepted) throw new Error(`owner 2's militia ${militia.id} refused the attack order: ${JSON.stringify(result)}`);
    }
    api.advanceTicks(120, 100);
  });
  await game.waitForRenderedFrames(page, 3);
  expect(await alertModes(), 'the live raid was not announced, so there is nothing to replay').toEqual(['live']);

  // Close the live session into a prior one, and open it as a replay.
  await page.evaluate(async () => {
    await window.__AOE2_TEST__!.replay.seedPriorSession();
  });
  await page.locator('[data-hud="menu-button"]').click();
  await page.locator('[data-hud="replay-load-button"]').click();
  await page.locator('[data-testid="replay-load-tab-prior"]').click();
  await page.locator('[data-testid="replay-load-prior-row"]').first().click();
  await expect.poll(
    () => page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayMode()),
    { timeout: 5000 },
  ).toBe('replay');
  const before = (await alertModes()).length;
  const startTick = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick());

  // Step through the replayed raid one tick at a time, letting the audio
  // mount poll every replayed world.
  const step = page.locator('[data-testid="timeline-step-forward"]');
  for (let i = 0; i < STEPS; i += 1) {
    await step.click();
    await game.waitForRenderedFrames(page, 2);
  }
  const endTick = await page.evaluate(() => window.__AOE2_TEST__!.replay.getReplayCurrentTick());
  expect(endTick - startTick, 'the step button did not step the replay').toBe(STEPS);

  // Instrument check: the stepped window really holds the raid's blows.
  const houseHp = await page.evaluate(() => {
    const api = window.__AOE2_TEST__!;
    const house = api.getRenderState().entities.find((entity) => entity.owner === 1 && entity.entityType === 'house');
    return house ? { hp: house.currentHp, max: house.maxHp } : null;
  });
  expect(houseHp && houseHp.hp !== null && houseHp.max !== null && houseHp.hp < houseHp.max,
    `the replayed House was never hit by tick ${endTick}: ${JSON.stringify(houseHp)}`).toBe(true);

  const during = (await alertModes()).slice(before);
  test.info().annotations.push({ type: 'measured', description: `${during.length} alert toasts over replay ticks ${startTick}-${endTick}; House at ${JSON.stringify(houseHp)}` });
  expect(during.length, `${during.length} alert toasts while stepping ${STEPS} replay ticks — `
    + 'every step re-announced the raid').toBeLessThanOrEqual(1);
});
