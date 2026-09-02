// Helpers for the opening play test (tests/browser/play-opening.spec.ts): the
// lobby boot a player performs, the HUD numbers a player reads, mouse targets
// found through the test API's projection rather than guessed pixels, and
// screenshots under the gitignored tmp/play/ (task-run evidence, never Git).

import { expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import type { ScreenPoint } from './gameTestHelpers/types';

export const PLAY_SCREENSHOT_DIR = path.resolve(process.cwd(), 'tmp', 'play');

export interface PageErrorLog {
  readonly pageErrors: string[];
  readonly consoleErrors: string[];
}

/** Every uncaught exception and console.error from now on — asserted empty at
 *  the end of the run. Attach BEFORE navigating so boot is covered too. */
export function collectPageErrors(page: Page): PageErrorLog {
  const log: PageErrorLog = { pageErrors: [], consoleErrors: [] };
  page.on('pageerror', (error) => { log.pageErrors.push(error.message); });
  page.on('console', (message) => {
    if (message.type() === 'error') log.consoleErrors.push(message.text());
  });
  return log;
}

/** Boot exactly as a player does: a bare visit shows the lobby, Start Match
 *  with its defaults (Standard map = aoe2-prototype, 2 players, Britons,
 *  Normal speed) reloads into a RUNNING match — no test-API pause. */
export async function startMatchFromLobby(page: Page): Promise<string> {
  await page.goto('/');
  await expect(page.locator('[data-hud="setup-screen"]')).toBeVisible();
  await expect(page.locator('[data-setup="map"]')).toHaveValue('aoe2-prototype');
  await expect(page.locator('[data-setup="players"]')).toHaveValue('2');
  await expect(page.locator('[data-setup="civ"]')).toHaveValue('Britons');
  await page.locator('[data-setup="start"]').click();
  await page.waitForFunction(() => window.__AOE2_TEST__?.isBooted() === true);
  await expect.poll(() => page.evaluate(() => window.__AOE2_TEST__!.getHudState().seed))
    .toBe('aoe2-prototype');
  return page.url();
}

export async function screenshot(page: Page, name: string): Promise<string> {
  mkdirSync(PLAY_SCREENSHOT_DIR, { recursive: true });
  const file = path.join(PLAY_SCREENSHOT_DIR, name);
  await page.screenshot({ path: file });
  return file;
}

export interface HudReadout {
  food: number;
  wood: number;
  gold: number;
  stone: number;
  pop: string;
  time: string;
  idleVillagers: number;
}

/** The top bar and the idle bell as text — what the player reads, not the
 *  bridge's numbers behind them. */
export async function readHud(page: Page): Promise<HudReadout> {
  return page.evaluate(() => {
    const text = (selector: string): string =>
      document.querySelector<HTMLElement>(selector)?.textContent?.trim() ?? '';
    return {
      food: Number(text('[data-hud="food"]')),
      wood: Number(text('[data-hud="wood"]')),
      gold: Number(text('[data-hud="gold"]')),
      stone: Number(text('[data-hud="stone"]')),
      pop: text('[data-hud="pop"]'),
      time: text('[data-hud="time"]'),
      idleVillagers: Number(text('[data-hud="idle-villager-bell"] [data-idle-count]')),
    };
  });
}

export interface SelectionReadout {
  name: string;
  activity: string;
  health: string;
  inventory: string;
  placement: string;
  queueHead: string;
  /** `data-command` id → visible label, for every command button shown. */
  commands: Record<string, string>;
}

export async function readSelectionPanel(page: Page): Promise<SelectionReadout> {
  return page.evaluate(() => {
    const text = (selector: string): string =>
      document.querySelector<HTMLElement>(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const commands: Record<string, string> = {};
    for (const button of document.querySelectorAll<HTMLElement>('[data-command]')) {
      commands[button.dataset.command ?? ''] = button.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    }
    return {
      name: text('[data-selection-name]'),
      activity: text('[data-selection-activity]'),
      health: text('[data-selection-detail-value="health"]'),
      inventory: text('[data-selection-detail-value="inventory"]'),
      placement: text('[data-placement-mode]'),
      queueHead: text('[data-selection-queue-item="0"]'),
      commands,
    };
  });
}

export interface BuildCard {
  name: string;
  cost: Record<string, number>;
}

function readBuildPage(page: Page): Promise<BuildCard[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('[data-command^="build-"]'))
      .map((button) => {
        const cost: Record<string, number> = {};
        for (const chip of button.querySelectorAll<HTMLElement>('[data-build-cost-resource]')) {
          cost[chip.dataset.buildCostResource ?? ''] = Number(
            chip.querySelector('.hud-build-cost__value')?.textContent?.trim(),
          );
        }
        const name = button.querySelector('.hud-build-card__name')?.textContent
          ?.replace(/\s+/g, ' ').trim().replace(/^Build /, '') ?? '';
        return { name, cost };
      }));
}

/** The BUILD panel as the DOM carries it: each card's name and cost, across
 *  BOTH of DE's build pages (Economic first, then Military). Since v0.3.187 a
 *  card is an icon tile and this text is not drawn — it is what a screen
 *  reader gets and what the tooltip repeats, not what the eye reads;
 *  each page in palette order. Only one page is on screen at a time, so this
 *  visits each tab and leaves the palette on the page it found it. */
export async function readBuildPanel(page: Page): Promise<BuildCard[]> {
  const tabs = page.locator('button[data-build-page]');
  if (await tabs.count() === 0) {
    return readBuildPage(page);
  }
  const openedOn = await page.locator('[data-command-group="build"]')
    .getAttribute('data-build-page');
  const cards: BuildCard[] = [];
  for (const pageId of ['economic', 'military']) {
    const tab = page.locator(`button[data-build-page="${pageId}"]`);
    if (!(await tab.isEnabled())) continue;
    await tab.click();
    await expect(page.locator('[data-command-group="build"]'))
      .toHaveAttribute('data-build-page', pageId);
    cards.push(...await readBuildPage(page));
  }
  if (openedOn) {
    await page.locator(`button[data-build-page="${openedOn}"]`).click();
  }
  return cards;
}

export interface MouseTarget {
  id: number;
  cellX: number;
  cellY: number;
  screen: ScreenPoint;
}

export interface MouseTargetQuery {
  kind: 'unit' | 'resource' | 'building';
  entityType: string;
  owner: number | null;
  /** Units only: skip any that already have a task. */
  idleOnly?: boolean;
}

/** The first rendered entity matching the query whose ground centre the mouse
 *  can actually reach — projected through the view and checked with
 *  `elementFromPoint`, because a point under a HUD panel gets no pointer
 *  event and reads exactly like a broken feature. Buildings use their
 *  footprint centre. Returns null when every match is off-canvas. */
export async function findMouseReachableEntity(
  page: Page,
  query: MouseTargetQuery,
): Promise<MouseTarget | null> {
  return page.evaluate((q) => {
    const api = window.__AOE2_TEST__!;
    const idleUnitIds = new Set(
      api.getEconomyState().units.filter((unit) => unit.task === 'idle').map((unit) => unit.id),
    );
    for (const entity of api.getRenderState().entities) {
      if (entity.kind !== q.kind || entity.entityType !== q.entityType) continue;
      if (entity.owner !== q.owner || entity.isMemory) continue;
      if (q.idleOnly && !idleUnitIds.has(entity.id)) continue;
      const cellX = entity.kind === 'building'
        ? entity.x + entity.footprintWidth / 2 - 0.5
        : entity.x;
      const cellY = entity.kind === 'building'
        ? entity.y + entity.footprintHeight / 2 - 0.5
        : entity.y;
      const screen = api.worldToScreen(cellX, cellY);
      if (document.elementFromPoint(screen.x, screen.y) instanceof HTMLCanvasElement) {
        return { id: entity.id, cellX, cellY, screen };
      }
    }
    return null;
  }, query);
}

/**
 * The same search, but scrolling the view first when the entity's centre is
 * behind a HUD panel — what a player does when their base has drifted under
 * the command bar. Keyboard camera movement only: no test API moves the
 * camera here, because "can the mouse reach it" is the thing being measured.
 */
export async function findMouseReachableEntityAfterScrolling(
  page: Page,
  query: MouseTargetQuery,
  attempts = 10,
): Promise<MouseTarget | null> {
  let found = await findMouseReachableEntity(page, query);
  if (found) return found;

  const screenY = async (): Promise<number | null> => page.evaluate((q) => {
    const api = window.__AOE2_TEST__!;
    for (const entity of api.getRenderState().entities) {
      if (entity.kind !== q.kind || entity.entityType !== q.entityType) continue;
      if (entity.owner !== q.owner || entity.isMemory) continue;
      const cellX = entity.kind === 'building'
        ? entity.x + entity.footprintWidth / 2 - 0.5 : entity.x;
      const cellY = entity.kind === 'building'
        ? entity.y + entity.footprintHeight / 2 - 0.5 : entity.y;
      return api.worldToScreen(cellX, cellY).y;
    }
    return null;
  }, query);

  const scroll = async (key: string): Promise<void> => {
    await page.keyboard.down(key);
    await page.waitForTimeout(220);
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
  };

  // Which arrow raises it on screen depends on where the camera drifted to;
  // measure rather than assume.
  const before = await screenY();
  await scroll('ArrowUp');
  const after = await screenY();
  const key = before !== null && after !== null && after > before ? 'ArrowDown' : 'ArrowUp';
  found = await findMouseReachableEntity(page, query);
  for (let attempt = 0; attempt < attempts && !found; attempt += 1) {
    await scroll(key);
    found = await findMouseReachableEntity(page, query);
  }
  return found;
}

/** A real left or right click on the canvas — the same path a player's mouse
 *  takes (pointermove, pointerdown, pointerup) — never the test API. */
export async function clickAt(
  page: Page,
  point: ScreenPoint,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button });
}

export async function selectedEntityId(page: Page): Promise<number | null> {
  return page.evaluate(() => window.__AOE2_TEST__!.getSelectionState().selectedEntityId);
}

export interface ConstructionWatch {
  /** Stop sampling and report the ticks seen (null = never observed). */
  stop(): Promise<{ startedTick: number | null; completedTick: number | null; samples: number }>;
}

/** Samples one owned building's construction every ~200 ms in the background,
 *  so the walk (order -> first progress) and the build (first progress ->
 *  complete) can be told apart in GAME ticks while the test is busy elsewhere.
 *  Sampling stops on completion, on stop(), or when the page goes away. */
export function watchConstruction(
  page: Page,
  building: { type: string; x: number; y: number },
): ConstructionWatch {
  let startedTick: number | null = null;
  let completedTick: number | null = null;
  let samples = 0;
  let running = true;
  const loop = (async () => {
    while (running && completedTick === null) {
      try {
        const sample = await page.evaluate((target) => {
          const api = window.__AOE2_TEST__!;
          const found = api.getEconomyState().buildings.find((candidate) =>
            candidate.owner === 1 && candidate.buildingType === target.type
            && candidate.x === target.x && candidate.y === target.y);
          return {
            tick: api.getHudState().tick,
            progress: found?.buildProgressTicks ?? 0,
            complete: found?.isComplete === true,
          };
        }, building);
        samples += 1;
        if (sample.progress > 0 && startedTick === null) startedTick = sample.tick;
        if (sample.complete && completedTick === null) completedTick = sample.tick;
      } catch {
        break; // the page is closing; the test's own assertions report that
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  })();
  return {
    async stop() {
      running = false;
      await loop;
      return { startedTick, completedTick, samples };
    },
  };
}
