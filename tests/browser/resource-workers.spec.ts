// Bound: real lobby, canvas selection/context clicks and House placement at
// three HUD widths. No direct command, pause or synthetic simulation stepping.
import { expect, test, type Page } from '@playwright/test';
import * as game from './helpers/gameTestHelpers';
import * as play from './helpers/playOpening';

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

for (const viewport of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`resource occupations stay readable and follow real orders at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(viewport);
    const errors = play.collectPageErrors(page);
    await play.startMatchFromLobby(page);
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
    await play.screenshot(page, `h4-${viewport.width}-gather.png`);

    await page.locator('[data-command="build-house"]').click();
    const anchor = await game.findValidPlacementNearTownCenter(page, 'house');
    await page.keyboard.press('Escape');
    await game.clickCell(page, anchor.x, anchor.y, 'right');
    await expect(page.locator('[data-selection-activity]')).toHaveText('Moving');
    await expect(page.locator('[data-resource-worker-count="food"]')).toHaveText('1');
    await play.screenshot(page, `h4-${viewport.width}-walk.png`);
    await page.locator('[data-command="build-house"]').click();
    await game.clickCell(page, anchor.x, anchor.y);
    await expect(page.locator('[data-resource-worker-count="food"]')).toHaveText('0');
    await play.screenshot(page, `h4-${viewport.width}-build.png`);

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
  test(`large resource readouts stay inside fixed chips at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    await page.evaluate(() => { const bar = document.querySelector('.hud-bar')!; bar.replaceWith(bar.cloneNode(true)); });
    const geometry = await barGeometry(page);
    for (const amount of ['100000', '1000000', '9007199254740991']) {
      await page.locator('.hud-resource-readout').evaluateAll((readouts, value) => {
        for (const readout of readouts) {
          const total = readout.querySelector<HTMLElement>('.hud-value')!;
          const kind = total.dataset.hud!;
          const label = `${kind[0].toUpperCase()}${kind.slice(1)} stockpile: ${value}`;
          total.textContent = value; total.setAttribute('aria-label', label); total.dataset.tooltip = label;
          const workers = readout.querySelector<HTMLElement>('.hud-resource-workers')!;
          workers.querySelector('[data-resource-worker-count]')!.textContent = '100';
          workers.setAttribute('aria-label', `${kind[0].toUpperCase()}${kind.slice(1)} workers: 100`);
        }
      }, amount);
      await play.screenshot(page, `r1-${viewport.width}-${amount}-${process.env.H4_LAYOUT_LABEL ?? 'after'}.png`);
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
        if (amount.length > 7 && kind === 'stone') await play.screenshot(page, `r1-${viewport.width}-full-value-tooltip.png`);
      }
      await page.mouse.move(viewport.width - 1, viewport.height - 1);
    }
  });
}
