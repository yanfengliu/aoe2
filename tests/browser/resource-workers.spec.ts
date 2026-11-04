// Bound: real lobby, canvas selection/context clicks and House placement at
// three HUD widths. No direct command, pause or synthetic simulation stepping.
// The order test orders a walk of at least MIN_WALK_CELLS; the time its checks
// take is not fixed, and a host slow enough to outlast the walk fails the
// "still walking" check rather than passing.
import { expect, test, type Page } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
import * as play from './helpers/playOpening';

// "Moving" and the walking food occupation last only as long as the walk. The
// House anchor used to be the first valid cell near the Town Center, (8,6),
// beside the sheep, so a worker that had reached the sheep walked about one
// cell. CI's runners order the move 3.3 s after the gather, when it has, and
// three runs saw the walk end between Playwright's polls: "Gathering food" then
// "Idle" twice, and once "Moving" with food 1 and food 0 45 ms later (work
// 137). So the move waits for the worker to gather on every host, and its
// anchor is at least this many cells away. At Normal speed each frame advances
// the game by at most 1.5 times the wall time since the last one, and a
// villager walks 0.8 cells a game second, so the walk lasts at least 6.7 s. On
// CI the Moving check took up to 0.9 s, and a Build House click during a walk
// 2.2 s.
const MIN_WALK_CELLS = 8;

/** The activity line and the food worker count in one read, so a check of both
 *  cannot straddle the frame in which the walk ends. */
async function readOrderHud(page: Page): Promise<{ activity: string; food: string }> {
  return page.evaluate(() => ({
    activity: document.querySelector('[data-selection-activity]')?.textContent?.trim() ?? '',
    food: document.querySelector('[data-resource-worker-count="food"]')?.textContent?.trim() ?? '',
  }));
}

async function workerState(page: Page, id: number): Promise<{ task: string; x: number; y: number }> {
  return page.evaluate((unitId) => {
    const api = window.__AOE2_TEST__!;
    const unit = api.getRenderState().entities.find((entity) => entity.id === unitId);
    const task = api.getEconomyState().units.find((entry) => entry.id === unitId)?.task ?? 'gone';
    return { task, x: unit?.x ?? Number.NaN, y: unit?.y ?? Number.NaN };
  }, id);
}

async function readResourceLayout(page: Page) {
  return page.locator('.hud-resource-readout').evaluateAll((readouts) => readouts.map((readout) => {
    const total = readout.querySelector<HTMLElement>('.hud-value')!;
    const workers = readout.querySelector<HTMLElement>('.hud-resource-workers')!;
    const chip = readout.closest<HTMLElement>('.hud-chip')!;
    const a = total.getBoundingClientRect(), b = workers.getBoundingClientRect();
    const c = chip.getBoundingClientRect(), clip = chip.parentElement!.getBoundingClientRect();
    const next = chip.nextElementSibling!.getBoundingClientRect();
    const inside = (r: DOMRect) => r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    return { kind: chip.dataset.hudChip, overlap: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
      contained: inside(a) && inside(b), neighborOverlap: Math.max(a.right, b.right) > next.left,
      visible: Math.min(a.left, b.left) >= clip.left && Math.max(a.right, b.right) <= clip.right,
      totalClipped: total.scrollWidth > total.clientWidth, ellipsis: getComputedStyle(total).textOverflow,
      overflow: getComputedStyle(total).overflowX };
  }));
}

async function barGeometry(page: Page) {
  return page.locator('.hud-bar, .hud-chip, [data-hud="menu-button"]').evaluateAll((nodes) => nodes.map((node) => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  }));
}

async function screenshotResourceFixture(page: Page, name: string, includeTooltip = false) {
  const coverage = await page.evaluate((withTooltip) => {
    const bar = document.querySelector<HTMLElement>('.hud-bar')!.getBoundingClientRect();
    const tooltip = withTooltip
      ? document.querySelector<HTMLElement>('[data-hud="tooltip"]')!.getBoundingClientRect()
      : null;
    const margin = 32;
    const left = Math.floor(Math.min(bar.left, tooltip?.left ?? bar.left) - margin);
    const top = Math.floor(Math.min(bar.top, tooltip?.top ?? bar.top) - margin);
    const right = Math.ceil(Math.max(bar.right, tooltip?.right ?? bar.right) + margin);
    const bottom = Math.ceil(Math.max(bar.bottom, tooltip?.bottom ?? bar.bottom) + margin);
    const x = Math.max(0, left);
    const y = Math.max(0, top);
    const clipRight = Math.min(window.innerWidth, right);
    const clipBottom = Math.min(window.innerHeight, bottom);
    return {
      clip: { x, y, width: clipRight - x, height: clipBottom - y },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      bar: { left: bar.left, top: bar.top, right: bar.right, bottom: bar.bottom },
      tooltip: tooltip
        ? { left: tooltip.left, top: tooltip.top, right: tooltip.right, bottom: tooltip.bottom }
        : null,
    };
  }, includeTooltip);
  const { clip, viewport, bar, tooltip } = coverage;
  for (const region of [bar, ...(tooltip ? [tooltip] : [])]) {
    expect(region.left).toBeGreaterThanOrEqual(0);
    expect(region.top).toBeGreaterThanOrEqual(0);
    expect(region.right).toBeLessThanOrEqual(viewport.width);
    expect(region.bottom).toBeLessThanOrEqual(viewport.height);
    expect(clip.x).toBeLessThanOrEqual(region.left);
    expect(clip.y).toBeLessThanOrEqual(region.top);
    expect(clip.x + clip.width).toBeGreaterThanOrEqual(region.right);
    expect(clip.y + clip.height).toBeGreaterThanOrEqual(region.bottom);
  }
  // The PNG is evidence for a person comparing layouts, and H4_LAYOUT_LABEL
  // names that before/after pair; nothing asserts it. On CI's SwiftShader
  // runners each capture took 2.6-3.2 s of a 1920px run's 23 s (work 123), so
  // it is taken only when a label asks for it. The geometry above is the check,
  // and it runs either way.
  if (process.env.H4_LAYOUT_LABEL === undefined) return null;
  return play.screenshot(page, name, clip);
}

/** Writes `value` into every readout of the cloned bar, as the live HUD would. */
async function labelReadouts(page: Page, value: string): Promise<void> {
  await page.locator('.hud-resource-readout').evaluateAll((readouts, text) => {
    for (const readout of readouts) {
      const total = readout.querySelector<HTMLElement>('.hud-value')!;
      const kind = total.dataset.hud!;
      const label = `${kind[0].toUpperCase()}${kind.slice(1)} stockpile: ${text}`;
      total.textContent = text; total.setAttribute('aria-label', label); total.dataset.tooltip = label;
      const workers = readout.querySelector<HTMLElement>('.hud-resource-workers')!;
      workers.querySelector('[data-resource-worker-count]')!.textContent = '100';
      workers.setAttribute('aria-label', `${kind[0].toUpperCase()}${kind.slice(1)} workers: 100`);
    }
  }, value);
}

/** A full-page PNG of an order's moment, evidence for a person comparing
 *  layouts; nothing asserts it. Taken only when H4_LAYOUT_LABEL asks, as the
 *  fixture captures above are: three of these took 8-9 s of a 1920px run on
 *  CI's SwiftShader runners (work 123). The checks around it run either way. */
async function evidenceScreenshot(page: Page, name: string): Promise<void> {
  if (process.env.H4_LAYOUT_LABEL === undefined) return;
  await play.screenshot(page, name);
}

for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`resource occupations stay readable and follow real orders at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const errors = play.collectPageErrors(page);
    const matchUrl = await play.startMatchFromLobby(page);
    // MIN_WALK_CELLS is worked out at Normal speed.
    expect(new URL(matchUrl).searchParams.get('speed'), 'the lobby started the match at Normal speed').toBe('normal');
    const food = page.locator('[data-resource-workers="food"]');
    for (const kind of ['food', 'wood', 'gold', 'stone']) {
      await expect(page.locator(`[data-resource-worker-count="${kind}"]`)).toHaveText('0');
    }
    const villager = await play.findMouseReachableEntity(page, { kind: 'unit', entityType: 'villager', owner: 1, idleOnly: true });
    expect(villager).not.toBeNull();
    await play.clickAt(page, villager!.screen);
    await expect.poll(() => play.selectedEntityId(page)).toBe(villager!.id);
    const sheep = await play.findMouseReachableEntity(page, { kind: 'resource', entityType: 'sheep', owner: 1 });
    expect(sheep).not.toBeNull();
    await play.clickAt(page, sheep!.screen, 'right');
    await expect(food).toHaveAttribute('aria-label', 'Food workers: 1');
    await expect(page.locator('[data-resource-worker-count="food"]')).toHaveText('1');
    await evidenceScreenshot(page, `h4-${viewport.width}-gather.png`);

    // Every host orders the walk from where CI's runners did: the sheep.
    await expect.poll(async () => (await workerState(page, villager!.id)).task, { timeout: 20_000 })
      .toBe('gathering');
    await page.locator('[data-command="build-house"]').click();
    const gathering = await workerState(page, villager!.id);
    const anchor = await game.findValidPlacementNearTownCenter(page, 'house', 1, [],
      { x: gathering.x, y: gathering.y, distance: MIN_WALK_CELLS });
    await page.keyboard.press('Escape');
    // A guard on the setup, re-reading where the worker stands: the anchor
    // the search returned keeps the walk long.
    const start = await workerState(page, villager!.id);
    expect(Math.hypot(anchor.x + 0.5 - start.x, anchor.y + 0.5 - start.y),
      `cells from the worker at (${start.x},${start.y}) to the centre of House anchor (${anchor.x},${anchor.y})`)
      .toBeGreaterThanOrEqual(MIN_WALK_CELLS);
    await game.clickCell(page, anchor.x, anchor.y, 'right');
    await expect.poll(() => readOrderHud(page)).toEqual({ activity: 'Moving', food: '1' });
    await evidenceScreenshot(page, `h4-${viewport.width}-walk.png`);
    await page.locator('[data-command="build-house"]').click();
    // The House order has to reach a worker that is still walking, and the 0
    // has to be the order's: the end of a walk reads "Idle", and only a build
    // order reads "Building House". One gap is left: this read comes before
    // clickCell's three round trips, so a walk that ended inside them would
    // still pass. That is as long as those round trips, which were not
    // measured, at the end of a walk of at least 6.7 s.
    expect(await readOrderHud(page), 'the worker is still walking as the House is placed')
      .toEqual({ activity: 'Moving', food: '1' });
    await game.clickCell(page, anchor.x, anchor.y);
    await expect.poll(() => readOrderHud(page)).toEqual({ activity: 'Building House', food: '0' });
    await expect(page.locator('[data-resource-worker-count="food"]')).toHaveText('0');
    await evidenceScreenshot(page, `h4-${viewport.width}-build.png`);

    const layout = await readResourceLayout(page);
    expect(layout).toHaveLength(4);
    expect(layout.every((item) => !item.overlap && item.contained && item.visible && !item.neighborOverlap && !item.totalClipped)).toBe(true);
    await expect(page.locator('[data-hud="food"]')).toHaveAttribute('aria-label', /^Food stockpile: \d+$/);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  // Rendered readout fixture only: no claim about acquiring these resources.
  // Clone the actual bar so live controller updates cannot overwrite the fixture.
  // The separate test above continues to exercise the real input path.
  // One test per width and amount (work 123): one test per width ran 21.7 s of
  // its 30 s on a slow CI runner even without its captures. Each amount starts
  // from a fresh boot and compares the bar with its own untouched geometry, as
  // every amount did with the geometry measured before the first.
  for (const amount of ['100000', '1000000', '9007199254740991']) {
    test(`large resource readouts stay inside fixed chips at ${viewport.width}px, ${amount}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
      await page.evaluate(() => { const bar = document.querySelector('.hud-bar')!; bar.replaceWith(bar.cloneNode(true)); });
      const geometry = await barGeometry(page);
      // The same elements are labelled and hovered twice, as they were when one
      // test per width ran the three amounts in turn: a tooltip that kept an
      // element's first text fails the hovers below.
      await labelReadouts(page, '0');
      await page.locator('[data-hud="food"]').hover();
      await expect(page.locator('[data-hud="tooltip"]')).toContainText('stockpile: 0');
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
      await labelReadouts(page, amount);
      const label = process.env.H4_LAYOUT_LABEL ?? 'after';
      await screenshotResourceFixture(page, `r1-${viewport.width}-${amount}-${label}.png`);
      const layout = await readResourceLayout(page);
      expect.soft(layout).toHaveLength(4);
      for (const item of layout) {
        expect.soft(item, `${amount} ${item.kind}`).toMatchObject({ overlap: false, contained: true, neighborOverlap: false, visible: true });
        if (amount.length <= 7) expect.soft(item.totalClipped, `${amount} ${item.kind} exact inline value`).toBe(false);
        else expect.soft(item).toMatchObject({ totalClipped: true, ellipsis: 'ellipsis', overflow: 'hidden' });
      }
      expect.soft(await barGeometry(page)).toEqual(geometry);
      for (const kind of ['food', 'wood', 'gold', 'stone']) {
        const total = page.locator(`[data-hud="${kind}"]`);
        await expect(total).toHaveText(amount);
        await expect(total).toHaveAttribute('aria-label', new RegExp(`stockpile: ${amount}$`));
        await total.hover();
        await expect(page.locator('[data-hud="tooltip"]')).toBeVisible();
        await expect(page.locator('[data-hud="tooltip"]')).toContainText(`stockpile: ${amount}`);
        if (amount.length > 7 && kind === 'stone') {
          await screenshotResourceFixture(page, `r1-${viewport.width}-full-value-tooltip.png`, true);
        }
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
    });
  }
}
