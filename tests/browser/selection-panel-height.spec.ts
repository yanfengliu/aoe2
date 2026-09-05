// The bottom command bar keeps ONE height, whatever is selected.
//
// Owner report (2026-09-05): "the info panel at the bottom should not have
// different heights for different units. This is visually confusing when
// switching between units." The bar was as tall as whatever the selection
// rendered and it is bottom-anchored, so its TOP edge moved with every click.
// Measured by this spec on the unfixed tree (2026-09-05, tmp/hud-height-red.txt):
// at 1280x720, 72px with nothing selected, 114.2px with a tree, 144.4px with a
// sheep, 154px with every villager, 185.6px with a villager or a House
// foundation, 212.6px with the scout, 242.8px with the Town Centre — its name
// wraps to two lines beside its portrait and its seven stat chips take four
// rows; at 800x600, 65px / 82px / 186.6px (Town Centre) / 196px (scout) /
// 226.6px (villager) / 232px (every villager). The 2026-09-02 register entry
// under hud-floating-controls.spec.ts predicted this fix: "the cure is a bar
// whose height does not depend on the selection". AoE2's bar is a
// fixed-height band; what varies lives inside it. The fix is one token,
// `--hud-selection-bar-height` (246px unwrapped, 236px wrapped: the tallest
// boot-scenario card plus 2px), applied as the panel's `height`.
//
// BOUND — what this gate proves and no more. On `aoe2-prototype`, paused at
// boot, at 800x600 and 1024x768 (the wrapped regime, tiles 34px) and 1280x720
// and 1920x1080 (unwrapped, 44px), the panel's height and top edge are the
// same across exactly these states, in this order: nothing selected; a
// villager on the Economic build page, on the Military page, and placing a
// House; the Scout Cavalry; the Town Centre, empty and with one villager
// queued; a House foundation; a sheep; a tree; a berry bush; a gold mine; a
// stone mine; every villager; a box selection of every owned unit and sheep;
// nothing again. Each state is also held INSIDE the band without a vertical
// scroll, so a band kept fixed by clipping a card is red here and not only in
// command-deck-fits.spec.ts — with ONE exception, named per state: at 800x600
// the queued Town Centre is 261px of content (the wrapped bar puts the queue
// on a line of its own, 76px an entry, and its stat chips take three rows
// there), which no band under the camera-centre rule can hold, so it scrolls
// inside the band under §14.2 rule (b) and is held for height and top edge
// only; at 1024x768 the same card is 232px and must fit. Nothing here covers
// other fixtures (a Castle's or a Market's card exceeds the band and scrolls
// inside it, which command-deck-fits.spec.ts holds), a deeper queue (three
// entries fit the unwrapped band, four scroll), widths between the four, a
// window shorter than the band needs (the viewport ceilings then clamp every
// selection alike), or the replay timeline's reserve. Every state asserts
// that its selection took effect before measuring, so a selection that
// silently failed cannot pass as "the same height as before".

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';

const VIEWPORTS = [
  { width: 800, height: 600 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
];

// The bar's height and top edge may differ by no more than this between two
// selections: sub-pixel rounding of a fit-content panel, never a layout row.
const SAME_PX = 0.5;

interface PanelMetrics {
  state: string;
  name: string;
  top: number;
  height: number;
  scrollHeight: number;
  clientHeight: number;
  /** Set on the one state the band is allowed not to hold (see BOUND). */
  scrollsInsideTheBand?: string;
}

async function measurePanel(
  page: Page,
  state: string,
  scrollsInsideTheBand?: string,
): Promise<PanelMetrics> {
  // The HUD draws a selection on its next frame; two frames cover a render
  // that lands on the frame after the one already scheduled.
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  const metrics = await page.evaluate((label) => {
    const panel = document.querySelector<HTMLElement>('[data-hud="selection-panel"]');
    if (!panel) throw new Error('Expected [data-hud="selection-panel"] in the HUD; it is not in the DOM.');
    const rect = panel.getBoundingClientRect();
    return {
      state: label,
      name: document.querySelector('[data-selection-name]')?.textContent?.trim() ?? '',
      top: rect.top,
      height: rect.height,
      scrollHeight: panel.scrollHeight,
      clientHeight: panel.clientHeight,
    };
  }, state);
  return scrollsInsideTheBand ? { ...metrics, scrollsInsideTheBand } : metrics;
}

function describe(metrics: PanelMetrics): string {
  const n = (value: number) => Math.round(value * 10) / 10;
  return `${metrics.state} ("${metrics.name}"): top ${n(metrics.top)}, height ${n(metrics.height)}, `
    + `content ${metrics.scrollHeight}px in a ${metrics.clientHeight}px box`;
}

async function selectResource(page: Page, resourceType: string, name: string): Promise<void> {
  const cells = await game.getOwnedResourceCells(page, 1, resourceType);
  expect(cells.length, `the boot scenario gives player 1 a ${resourceType} to select`)
    .toBeGreaterThan(0);
  expect(await page.evaluate(
    ({ x, y }) => window.__AOE2_TEST__!.selectEntityAtCell(x, y),
    cells[0]!,
  )).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText(name);
}

async function clearSelection(page: Page): Promise<void> {
  await page.evaluate(() => window.__AOE2_TEST__!.clearSelection());
  await expect(page.locator('[data-selection-name]')).toHaveText('No selection');
}

async function selectVillager(page: Page): Promise<void> {
  expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
  await expect(page.locator('[data-command-group="build"]')).toHaveAttribute('data-build-page', 'economic');
}

async function selectTownCentre(page: Page): Promise<void> {
  expect(await game.selectOwnedBuildingDirect(page, 1, 'town-center')).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
  await expect(page.locator('[data-command-group="train"]')).toBeAttached();
}

/** Every state the bar can be asked to show at boot, measured in turn. */
async function measureEveryState(
  page: Page,
  viewport: { width: number; height: number },
): Promise<PanelMetrics[]> {
  const states: PanelMetrics[] = [];
  const record = async (state: string, scrollsInsideTheBand?: string): Promise<void> => {
    states.push(await measurePanel(page, state, scrollsInsideTheBand));
  };

  await clearSelection(page);
  await record('nothing selected');

  await selectVillager(page);
  await record('a villager, Economic page');

  await page.locator('button[data-build-page="military"]').click();
  await expect(page.locator('[data-command-group="build"]')).toHaveAttribute('data-build-page', 'military');
  await record('a villager, Military page');

  await page.locator('button[data-build-page="economic"]').click();
  await expect(page.locator('[data-command-group="build"]')).toHaveAttribute('data-build-page', 'economic');
  await page.locator('[data-command="build-house"]').click();
  await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
  await record('a villager placing a House');

  expect(await game.selectOwnedUnitDirect(page, 1, 'scout')).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText('Scout Cavalry');
  await expect(page.locator('[data-command-group="formation"]')).toBeAttached();
  await record('the Scout Cavalry');

  await selectTownCentre(page);
  await record('the Town Centre');

  await page.locator('[data-command="train-villager"]').click();
  // `queue.train` is a command the sim handles at the start of its NEXT step,
  // so a paused match shows no queue entry until one tick runs. `advanceTicks`
  // is atomic — unpause, step, repause — so the match stays paused.
  await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1); });
  await expect(page.locator('[data-selection-queue-item="0"]')).toContainText('Training: Villager');
  await record(
    'the Town Centre with a villager queued',
    // The BOUND's one exception: the wrapped bar's queue line, at the width
    // where the stat chips take three rows (261px of content at 800x600;
    // 232px at 1024x768, which fits and is held).
    viewport.width === 800
      ? 'the queue takes a line of its own in the wrapped bar and the 800px summary wraps to three chip rows'
      : undefined,
  );

  // A foundation: a villager places a House through the real placement pair,
  // and the paused simulation leaves it unbuilt.
  await selectVillager(page);
  await page.locator('[data-command="build-house"]').click();
  await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
  const anchor = await game.findValidPlacementNearTownCenter(page, 'house');
  expect(await page.evaluate(
    ({ x, y }) => window.__AOE2_TEST__!.confirmBuildingPlacement(x, y),
    anchor,
  )).toBe(true);
  // `building.placeConfirm` starts the construction at the sim's next step,
  // like `queue.train` above: one tick, and the foundation exists to select.
  await page.evaluate(() => { window.__AOE2_TEST__!.advanceTicks(1); });
  expect(await game.selectOwnedBuildingDirect(page, 1, 'house')).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText('House');
  await record('a House foundation');

  await selectResource(page, 'sheep', 'Sheep');
  await record('a sheep');
  await selectResource(page, 'tree', 'Tree');
  await record('a tree');
  await selectResource(page, 'berry-bush', 'Berry Bush');
  await record('a berry bush');
  await selectResource(page, 'gold-mine', 'Gold Mine');
  await record('a gold mine');
  await selectResource(page, 'stone-mine', 'Stone Mine');
  await record('a stone mine');

  const map = await page.evaluate(() => window.__AOE2_TEST__!.getMapSize());
  expect(await page.evaluate(
    ({ width, height }) => window.__AOE2_TEST__!
      .selectOwnedUnitsByTypeInRect('villager', 0, 0, width - 1, height - 1),
    map,
  )).toBe(true);
  await expect(page.locator('[data-selection-name]')).toHaveText(/^\d+ Villagers Selected$/);
  await record('every villager');

  expect(await page.evaluate(
    ({ width, height }) => window.__AOE2_TEST__!.selectUnitsInBox(0, 0, width - 1, height - 1),
    map,
  )).toBe(true);
  // Villagers, the scout and the sheep together: a mixed selection with no
  // single type, drawn as the compact chip grid.
  await expect(page.locator('[data-selection-name]')).toHaveText(/^\d+ Units Selected$/);
  await record('every owned unit and sheep in one box');

  await clearSelection(page);
  await record('nothing selected again');

  return states;
}

for (const viewport of VIEWPORTS) {
  test(`the command bar keeps one height at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');

    const states = await measureEveryState(page, viewport);
    expect(states.length).toBeGreaterThanOrEqual(16);
    const table = states.map(describe).join('\n  ');
    const reference = states[0]!;

    // Every assertion is soft, so one red run lists every state that differs
    // rather than the first.
    for (const state of states) {
      expect.soft(
        Math.abs(state.height - reference.height),
        `${state.state}: the bar is ${state.height}px tall against ${reference.height}px with `
          + `${reference.state}; the bar's height must not depend on the selection.\n  ${table}`,
      ).toBeLessThanOrEqual(SAME_PX);
      expect.soft(
        Math.abs(state.top - reference.top),
        `${state.state}: the bar's top edge is at ${state.top} against ${reference.top} with `
          + `${reference.state}; the bar must not move when the selection changes.\n  ${table}`,
      ).toBeLessThanOrEqual(SAME_PX);
      // What varies lives INSIDE the band — and fits. A band kept fixed by
      // clipping a villager's palette would pass the two checks above.
      if (state.scrollsInsideTheBand) continue;
      expect.soft(
        state.scrollHeight,
        `${state.state}: the bar's content (${state.scrollHeight}px) must fit its `
          + `${state.clientHeight}px box without a vertical scroll.\n  ${table}`,
      ).toBeLessThanOrEqual(state.clientHeight + 1);
    }
    // The exception is exactly one state at exactly one viewport, and it is
    // still reachable: rule (b) says what the band cannot show scrolls.
    const excepted = states.filter((state) => state.scrollsInsideTheBand);
    expect(excepted.map((state) => state.state)).toEqual(
      viewport.width === 800 ? ['the Town Centre with a villager queued'] : [],
    );
    for (const state of excepted) {
      expect.soft(
        state.scrollHeight,
        `${state.state} is excepted because ${state.scrollsInsideTheBand}, yet its content `
          + `(${state.scrollHeight}px) fits the ${state.clientHeight}px band: the exception is `
          + `stale — delete it and let the state be held like the others.\n  ${table}`,
      ).toBeGreaterThan(state.clientHeight);
    }
  });
}
