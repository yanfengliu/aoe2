// Work 148 M1: the production queue as in Age of Empires II: Definitive Edition
// (DE), through the real mouse and keyboard (spec §14.2; sources in
// docs/work/148_de-hud, DE never launched). DE draws a building's queue as
// icons, a run of one kind stacked into one icon with its count, with ONE bar
// for the item in production (commandpanel.json: `QueueButtons`, `ProgressBack`,
// `Progress`), its status "Creating" or "Researching" (strings 4310, 4309), and
// a unit that waits for houses named so (20607). Before this every queued item
// was a card reading "Training: Villager 0% complete", and three fit: at
// 1280x720 the fourth was below the screen, and at 800x600 all but the first.
//
// Bound: the default map (`aoe2-prototype`) at boot, the Dark Age, the Town
// Center's Villager and Loom; three window sizes. No other building's queue.

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const queueIcons = (page: Page) => page.locator('[data-queue-icons] [data-queue-entry]');

async function describeQueue(page: Page): Promise<string[]> {
  return queueIcons(page).evaluateAll((icons) => icons.map((icon) => {
    const data = (icon as HTMLElement).dataset;
    return `${data.queueEntry} x${data.queueStackCount} ${data.queueState}`;
  }));
}

async function clickCommand(page: Page, command: string): Promise<void> {
  const box = await page.locator(`[data-command="${command}"]`).boundingBox();
  expect(box, `${command} is drawn`).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

/** Runs ticks, then waits for the HUD to draw them: the queue only appears once
 *  a tick has handled the clicks (the paused boot holds them till then). */
async function runTicks(page: Page, ticks: number): Promise<void> {
  await page.evaluate((count) => { window.__AOE2_TEST__!.advanceTicks(count); }, ticks);
  await game.waitForRenderedFrames(page, 2);
}

async function selectTownCenter(page: Page): Promise<void> {
  // H selects the Town Center (DE's GO_TO_TOWN_CENTER, work 142).
  await page.keyboard.press('h');
  await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
}

for (const size of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`three villagers and Loom are two icons with one bar, all in view, at ${size.width}x${size.height}`, async ({ page }) => {
    await page.setViewportSize(size);
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    await selectTownCenter(page);
    const train = page.locator('[data-command="train-villager"]');
    const trainBefore = await train.boundingBox();

    for (let i = 0; i < 3; i += 1) await clickCommand(page, 'train-villager');
    await clickCommand(page, 'research-loom');
    await runTicks(page, 40);

    // DE's stack: the three villagers are one icon counting 3, the one in
    // production among them; Loom waits behind them.
    await expect.poll(() => describeQueue(page)).toEqual(['villager x3 active', 'loom x1 waiting']);
    await expect(queueIcons(page).first().locator('[data-queue-count]')).toHaveText('3');
    await expect(queueIcons(page).nth(1).locator('[data-queue-count]')).toHaveCount(0);

    // One bar, the villager's, with DE's word and the simulation's percent.
    const head = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().queue[0]!);
    const percent = Math.floor(((head.totalTicks - head.remainingTicks) / head.totalTicks) * 100);
    expect(percent, 'the villager has started').toBeGreaterThan(0);
    await expect(page.locator('[data-queue-status-label]')).toHaveText('Creating Villager');
    await expect(page.locator('[data-queue-percent]')).toHaveText(`${percent}%`);
    await expect(page.locator('[data-queue-progress]')).toHaveCount(1);
    await expect(page.locator('[data-selection-queue-list]')).not.toContainText('% complete');
    // Both bars draw the percent: the status bar's fill and the active icon's,
    // measured as rendered (review round 1: the icon's fill was an inline span
    // and drew nothing whatever its width said).
    for (const [track, fill] of [
      ['[data-queue-progress]', '[data-queue-progress] .hud-queue-progress-fill'],
      ['[data-queue-state="active"] .hud-queue-icon__progress', '[data-queue-state="active"] .hud-queue-icon__progress-fill'],
    ]) {
      const drawn = await page.evaluate(({ track, fill }) => (
        document.querySelector(fill)!.getBoundingClientRect().width
        / document.querySelector(track)!.getBoundingClientRect().width
      ), { track, fill });
      expect(drawn * 100, `${fill} draws ${percent}% of its track`).toBeCloseTo(percent, -0.5);
    }
    await expect(page.locator('[data-selection-activity]')).toHaveText('Creating Villager');

    // Every icon is on screen and takes the pointer, with nothing to scroll:
    // the old cards put all but the first two below the band.
    const list = page.locator('[data-selection-queue-list]');
    const scroll = await list.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight }));
    expect(scroll.scroll, 'the queue needs no scrolling').toBeLessThanOrEqual(scroll.client + 1);
    for (const icon of await queueIcons(page).all()) {
      await expect(icon).toBeInViewport({ ratio: 1 });
      const hit = await icon.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top !== null && el.contains(top);
      });
      expect(hit, `${await icon.getAttribute('data-queue-entry')} is not covered`).toBe(true);
    }
    // The queue never moves the deck (spec §14.2).
    expect(await train.boundingBox()).toEqual(trainBefore);
  });
}

test('a hovered queue icon, and Train Villager, keep their tooltips while the panel redraws them', async ({ page }) => {
  // The panel draws itself again on every tick a building trains; a tooltip
  // tied to the replaced element showed for one frame in twenty (work 148 M1).
  await page.setViewportSize({ width: 1280, height: 720 });
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await selectTownCenter(page);
  await clickCommand(page, 'train-villager');
  await clickCommand(page, 'train-villager');
  await runTicks(page, 10);
  const tooltip = page.locator('[data-hud="tooltip"]');
  for (const selector of ['[data-queue-state="active"]', '[data-command="train-villager"]']) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} is drawn`).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'true');
    // Each sample is read in the frame after the ticks, once the panel has drawn
    // the control again and the tooltip has answered the redraw, and before the
    // browser's own later hover update can paper over a tooltip that vanished.
    const samples = await page.evaluate(async (sel) => {
      const api = window.__AOE2_TEST__!;
      const tip = document.querySelector<HTMLElement>('[data-hud="tooltip"]')!;
      const out: { redrawn: boolean; active: string | undefined; text: string; copy: string | null }[] = [];
      for (let i = 0; i < 4; i += 1) {
        const before = document.querySelector(sel);
        api.advanceTicks(3);
        await new Promise<void>((resolve) => { requestAnimationFrame(() => resolve()); });
        const now = document.querySelector(sel);
        out.push({
          redrawn: before !== now, active: tip.dataset.hudTooltipActive, text: tip.textContent ?? '',
          copy: now?.getAttribute('data-tooltip') ?? null,
        });
      }
      return out;
    }, selector);
    for (const [i, sample] of samples.entries()) {
      expect(sample.redrawn, `the panel drew ${selector} again (${i + 1})`).toBe(true);
      expect(sample.active, `${selector}'s tooltip survives redraw ${i + 1}`).toBe('true');
      expect(sample.text).toBe(sample.copy);
    }
    await page.mouse.move(5, 300);
    await expect(tooltip).toHaveAttribute('data-hud-tooltip-active', 'false');
  }
});

test('a villager waiting for houses says so, and the research behind it moves', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await selectTownCenter(page);
  // The boot's population is 4 of 5: the first villager fills it.
  await clickCommand(page, 'train-villager');
  await runTicks(page, 1);
  await expect.poll(async () => {
    await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(50); });
    return page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().queue.length);
  }, { timeout: 30_000 }).toBe(0);
  const population = await page.evaluate(() => window.__AOE2_TEST__!.getEconomyState().population[1]!);
  expect(population.current, 'the trained villager filled the population').toBe(population.cap);

  for (let i = 0; i < 2; i += 1) await clickCommand(page, 'train-villager');
  await clickCommand(page, 'research-loom');
  await runTicks(page, 30);

  await expect(page.locator('[data-queue-housing]')).toHaveText('You need to build more houses.');
  await expect.poll(() => describeQueue(page)).toEqual(['villager x2 blocked', 'loom x1 active']);
  await expect(queueIcons(page).first()).toHaveAttribute(
    'data-tooltip', 'Villager (2 in the queue): You need to build more houses.',
  );
  // The one bar is Loom's, which goes on while the villager waits (spec §6.10).
  const loom = await page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().queue[2]!);
  expect(loom.technologyType, 'Loom is third, behind the two villagers').toBe('loom');
  const percent = Math.floor(((loom.totalTicks - loom.remainingTicks) / loom.totalTicks) * 100);
  expect(percent, 'Loom has started').toBeGreaterThan(0);
  await expect(page.locator('[data-queue-status-label]')).toHaveText('Researching Loom');
  await expect(page.locator('[data-queue-percent]')).toHaveText(`${percent}%`);
});
