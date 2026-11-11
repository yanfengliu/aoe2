// A refused placement says one short sentence (work 148 M3a, spec §14.2).
//
// The defect, as a player met it on v0.3.279: a House clicked onto the Town
// Center raised "Placement blocked for house (2x2): blocked by a town-center
// (building) at (9,9); 4 of the 4 footprint cells are blocked. Nearest open
// ground you can see: (7,6).", 973px wide at 1280x720, and over unexplored
// ground a sentence of 1,262px on two lines. Definitive Edition answers a red
// ghost with no sentence (its string table holds none), and a site its builders
// find blocked with 3094, "Building site obstructed. Building canceled.".
//
// This spec drives the real controls: "." selects an idle villager, the build
// card is clicked, the mouse moves onto the cell and clicks. What the page
// then says is read from a log, not from the toast on screen: a toast leaves
// after 2.4 seconds whatever the test is doing, so every refusal the page
// raises is written down, words and box, at the moment it is added (review
// round 5: a poll that came late found the cancellation done and its toast
// gone). The room cases measure inside that same moment.
//
// Bound: four refusals on the boot map and two fixtures at 1280x720 (something
// in the way, a tree, unexplored ground, a Dock away from water) and the
// builders' cancellation on one; a site no builder can reach and a Fish Trap on
// land are held by tests/ui/placementRefusalCopy.test.ts and
// tests/simulation/placementRefusalKinds.test.ts, not through the page. The
// room cases measure ONE toast; several refusals stack, and a stack is not
// measured here.
import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  HOUSE_OVER_HIDDEN_WATER,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
} from '../../src/game/simulation/fixtures/unexploredPlacement';
import { PLACEMENT_REFUSAL_KINDS } from '../../src/game/simulation/handlers/building/placementRefusal';
import { BUILDING_HELP } from '../../src/ui/hud/helpText/buildingHelp';
import { formatEntityName } from '../../src/ui/hud/displayNames/entityNames';
import { PLACEMENT_REFUSAL_COPY } from '../../src/ui/hud/placementRefusalCopy';

const REFUSAL = '[data-hud="toast"]:not([data-hud-toast-kind])';

interface Cell { x: number; y: number }
interface Raised { text: string; height: number }
interface Room {
  copy: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  lines: number;
  lineAdvance: number;
  barBottom: number;
  floor: number;
}
type Logged = Window & { __refusals?: Raised[]; __room?: Room[] };

/**
 * From now on every refusal toast is logged as it is added, and, when `copies`
 * are given, the first one is measured holding each of them in turn, in the
 * same task that added it, so no timer of the page's runs in between.
 */
async function logRefusals(page: Page, copies: readonly string[] = []): Promise<void> {
  await page.evaluate((stress) => {
    const logged = window as Logged;
    const refusals: Raised[] = [];
    const room: Room[] = [];
    logged.__refusals = refusals;
    logged.__room = room;
    const top = (selector: string): number => document.querySelector(selector)!.getBoundingClientRect().top;
    const measure = (toast: HTMLElement, copy: string): Room => {
      toast.textContent = copy;
      const range = document.createRange();
      range.selectNodeContents(toast);
      const tops = [...new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))].sort((a, b) => a - b);
      const box = toast.getBoundingClientRect();
      // A toast is added at the start of its entry, 4px above where it comes
      // to rest: its own lift is taken off, so the box is the settled one
      // (review round 6, R6-1).
      const lift = new DOMMatrixReadOnly(getComputedStyle(toast).transform).m42;
      return {
        copy,
        left: box.left,
        right: box.right,
        top: box.top - lift,
        bottom: box.bottom - lift,
        lines: tops.length,
        lineAdvance: tops.length > 1 ? tops[1]! - tops[0]! : box.height,
        barBottom: document.querySelector('.hud-bar')!.getBoundingClientRect().bottom,
        floor: Math.min(top('[data-hud="selection-panel"]'), top('.hud-panel--map')),
      };
    };
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement) || node.dataset.hud !== 'toast' || node.dataset.hudToastKind) continue;
          const said = node.textContent ?? '';
          refusals.push({ text: said, height: node.getBoundingClientRect().height });
          if (room.length === 0) {
            for (const copy of stress) room.push(measure(node, copy));
            node.textContent = said;
          }
        }
      }
    }).observe(document.querySelector('[data-hud="toast-container"]')!, { childList: true });
  }, [...copies]);
}

const refusals = (page: Page): Promise<Raised[]> => page.evaluate(() => (window as Logged).__refusals ?? []);

/** Every refusal the page has raised since the log began, each on one line. */
async function expectRefusals(page: Page, sentences: readonly string[]): Promise<void> {
  await expect.poll(async () => (await refusals(page)).map((raised) => raised.text)).toEqual([...sentences]);
  for (const raised of await refusals(page)) {
    expect(raised.height, `"${raised.text}" is more than one line`).toBeLessThan(44);
  }
}

/** The cell's screen point, which must be on the map and not under the HUD. */
async function pointOnMap(page: Page, cell: Cell): Promise<{ x: number; y: number }> {
  const point = await game.getScreenPointForCell(page, cell.x, cell.y);
  const onCanvas = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x!, y!) instanceof HTMLCanvasElement,
    [point.x, point.y],
  );
  expect(onCanvas, `(${cell.x},${cell.y}) is under the HUD or off the window`).toBe(true);
  return point;
}

/** The first of the cells that the window shows on the map. */
async function firstOnMap(page: Page, cells: readonly Cell[]): Promise<Cell> {
  for (const cell of cells) {
    const point = await game.getScreenPointForCell(page, cell.x, cell.y);
    const onCanvas = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!) instanceof HTMLCanvasElement,
      [point.x, point.y],
    );
    if (onCanvas) return cell;
  }
  throw new Error(`none of ${JSON.stringify(cells)} is on the map in this window`);
}

async function armWithIdleVillager(page: Page, building: 'house' | 'dock'): Promise<void> {
  await page.keyboard.press('.');
  await expect.poll(async () => (await game.getSelectionState(page)).selectedEntityType).toBe('villager');
  await game.clickBuildCommand(page, building);
  await expect(page.locator('[data-placement-mode]')).toHaveText(`Placing: ${formatEntityName(building)}`);
}

/** Moves the real mouse onto the cell, checks the ghost is there and red, and clicks. */
async function clickRedGhost(page: Page, cell: Cell): Promise<void> {
  const point = await pointOnMap(page, cell);
  await page.mouse.move(point.x, point.y);
  await expect.poll(async () => page.evaluate(() => {
    const ghost = window.__AOE2_TEST__!.getPlacementPreviewState();
    return ghost ? `${ghost.cellX},${ghost.cellY},${String(ghost.isValid)}` : 'none';
  })).toBe(`${cell.x},${cell.y},false`);
  await page.mouse.click(point.x, point.y);
}

test.describe('a refused placement says one short sentence', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('something in the way, a tree and unexplored ground, each in a sentence with no cell in it', async ({ page }) => {
    await game.waitForBootWithSeed(page, 'aoe2-prototype');
    await logRefusals(page);
    await armWithIdleVillager(page, 'house');

    // Cells of the boot map: the Town Center stands on (8,8)-(11,11), a tree on
    // (10,4), and nothing of row 0 is explored at the start.
    await clickRedGhost(page, { x: 9, y: 9 });
    await expectRefusals(page, ['Building site obstructed.']);
    await clickRedGhost(page, { x: 10, y: 4 });
    await expectRefusals(page, ['Building site obstructed.', 'Building site obstructed.']);
    await clickRedGhost(page, { x: 5, y: 0 });
    await expectRefusals(page, ['Building site obstructed.', 'Building site obstructed.', "You can't build on unexplored ground."]);

    // Still placing: a refused click leaves the building armed, as before.
    await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
    // And a refusal's toast leaves by itself.
    await expect(page.locator(REFUSAL), 'the toasts never left').toHaveCount(0);
  });

  test('a Dock away from water says where a Dock goes', async ({ page }) => {
    await game.waitForBootWithSeed(page, UNEXPLORED_PLACEMENT_OPEN_SEED);
    await page.evaluate(() => window.__AOE2_TEST__!.centerCameraOnWorldPosition(22, 14));
    await logRefusals(page);
    await armWithIdleVillager(page, 'dock');
    await clickRedGhost(page, { x: 22, y: 12 });
    await expectRefusals(page, ['A Dock must be built on the shore.']);
  });

  test('a site its builders find blocked is cancelled in Definitive Edition\'s words', async ({ page }) => {
    await game.waitForBootWithSeed(page, UNEXPLORED_PLACEMENT_HIDDEN_SEED);
    await page.evaluate(() => window.__AOE2_TEST__!.centerCameraOnWorldPosition(22, 14));
    // The log begins before the click, so the words are held whenever they come.
    await logRefusals(page);
    await armWithIdleVillager(page, 'house');
    // Water lies hidden under this footprint, so the ghost is not red and the
    // click is taken; the villager walks over and finds it.
    const point = await pointOnMap(page, HOUSE_OVER_HIDDEN_WATER);
    await page.mouse.move(point.x, point.y);
    await page.mouse.click(point.x, point.y);
    const standing = (): Promise<boolean> => page.evaluate((anchor) => window.__AOE2_TEST__!.getEconomyState().buildings
      .some((b) => b.owner === 1 && b.x === anchor.x && b.y === anchor.y), HOUSE_OVER_HIDDEN_WATER);
    await expect.poll(standing, 'the foundation never went down').toBe(true);
    // The match runs: the cancellation is waited for as game state, then read.
    await expect.poll(standing, { message: 'the foundation was never cancelled', timeout: 20_000 }).toBe(false);
    await expectRefusals(page, ['Building site obstructed. Building canceled.']);
  });
});

// The room a toast has. It hangs from the window's top right, under the top
// bar, and grows to the left and then down; what it must not reach is the
// window's left edge, the command bar and the minimap. Two sentences are
// measured at each size: the longest the HUD can write for a refused
// placement (every kind, with every building's name, though only a Dock and a
// Fish Trap have a ground rule), which must hold ONE line with a quarter of
// the window to spare; and one four times as long, which must stay 18px inside
// the window and six of its own lines clear of the bar and the minimap. Each
// case prints what it measured, so a run's log holds the platform's numbers.
const BUILDING_NAMES = Object.keys(BUILDING_HELP).map((type) => formatEntityName(type as never));
const EVERY_REAL = PLACEMENT_REFUSAL_KINDS.flatMap((kind) => BUILDING_NAMES.map((name) => PLACEMENT_REFUSAL_COPY[kind](name)));
const LONGEST_REAL = EVERY_REAL.reduce((longest, sentence) => (sentence.length > longest.length ? sentence : longest));
const PADDING = ' A sentence longer than any the game writes for a refused site.';
const LONGER_THAN_ANY = LONGEST_REAL + PADDING.repeat(Math.ceil((LONGEST_REAL.length * 3) / PADDING.length));

for (const size of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`a refusal's toast keeps its room at ${size.width}x${size.height}`, async ({ page }) => {
    expect(BUILDING_NAMES.length).toBeGreaterThanOrEqual(20);
    expect(LONGER_THAN_ANY.length).toBeGreaterThanOrEqual(LONGEST_REAL.length * 4);
    await page.setViewportSize(size);
    await game.waitForBootWithSeed(page, 'aoe2-prototype');
    await armWithIdleVillager(page, 'house');
    // The toast the click raises is measured as it is added, holding each copy.
    await logRefusals(page, [LONGEST_REAL, LONGER_THAN_ANY]);
    // A House on the Town Center, (8,8)-(11,11), from whichever of its cells
    // this window shows above the command bar.
    await clickRedGhost(page, await firstOnMap(page, [{ x: 9, y: 9 }, { x: 8, y: 8 }, { x: 10, y: 8 }, { x: 8, y: 10 }]));
    await expectRefusals(page, ['Building site obstructed.']);
    const room = await page.evaluate(() => (window as Logged).__room ?? []);
    expect(room.map((read) => read.copy)).toEqual([LONGEST_REAL, LONGER_THAN_ANY]);

    for (const read of room) {
      const name = read.copy === LONGEST_REAL ? 'the longest real sentence' : 'one four times as long';
      const spareLeft = read.left;
      const spareBelow = read.floor - read.bottom;
      console.log(`[toast-room] ${size.width}x${size.height} ${name} (${read.copy.length} characters): ${read.lines} line(s), `
        + `${(read.right - read.left).toFixed(0)}px wide, ${spareLeft.toFixed(0)}px from the window's left edge `
        + `(${((spareLeft / size.width) * 100).toFixed(0)}% of it), ${spareBelow.toFixed(0)}px above the bar and the minimap `
        + `(${(spareBelow / read.lineAdvance).toFixed(1)} of its lines)`);

      expect(read.right, name).toBeLessThanOrEqual(size.width - 18 + 0.5);
      expect(read.top, name).toBeGreaterThanOrEqual(read.barBottom);
      if (read.copy === LONGEST_REAL) {
        expect(read.lines, `${name} wrapped`).toBe(1);
        expect(spareLeft, `${name} has under a quarter of the window to spare`).toBeGreaterThanOrEqual(size.width / 4);
      } else {
        expect(spareLeft, `${name} reaches the window's left edge`).toBeGreaterThanOrEqual(18 - 0.5);
        expect(spareBelow / read.lineAdvance, `${name} has under six lines above the bar and the minimap`).toBeGreaterThanOrEqual(6);
      }
    }
  });
}
