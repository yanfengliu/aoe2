// The command card's tooltips say what a unit, technology or building does, as
// Definitive Edition's help text does, and an age says the buildings it needs
// (work 148 M2). DE's shape, read from the install's string table: a title
// line, DE's verb, the name in bold and the price in brackets ("Create
// <b>Villager<b> (<cost>)", 26121), then what it does, then what it needs
// ("Advance to <b>Feudal Age<b> (<cost>; two Dark Age buildings)\n... Before
// you can advance, you must have any two Dark Age buildings: ...", 28101).
// Until M2 the tooltip gave only a price and a time ("Research Feudal Age.
// Cost: 500 food; takes 130s.") and named the buildings only while the player
// lacked them (plan 106's HUD card, play-1014).
//
// Real input throughout: H selects the Town Center (DE's GO_TO_TOWN_CENTER),
// "." an idle villager (NEXT_IDLE_VILLAGER), and the mouse rests on each
// control. The help text is longer than any tooltip before it, so the last
// cases hover a copy longer than any real one at three window sizes: it stays
// on screen, above the command bar and clear of the minimap (the local rule
// "The HUD holds its shape").

import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import type { BuildingType, ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';
import { BUILDING_HELP } from '../../src/ui/hud/helpText/buildingHelp';
import { GENERAL_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/technologyHelp';
import { UNIT_HELP } from '../../src/ui/hud/helpText/unitHelp';
import { UPGRADE_TECHNOLOGY_HELP } from '../../src/ui/hud/helpText/upgradeHelp';
import { formatBuildTooltip, formatResearchTooltip, formatTrainTooltip } from '../../src/ui/hud/tooltips';

interface Box { left: number; top: number; right: number; bottom: number }
interface TooltipReadout {
  active: string | undefined;
  text: string;
  title: string | null;
  titleWeight: number | null;
  titleBox: Box | null;
  /** Where the line after the title starts, drawn: its first character's top. */
  bodyTop: number | null;
  box: Box;
  /** One line of the tooltip's text, in pixels, as the browser computes it. */
  lineHeight: number;
  /** The hovered control. */
  target: Box;
  bar: Box;
  map: Box;
  viewport: { width: number; height: number };
}

async function hoverAndRead(page: Page, selector: string): Promise<TooltipReadout> {
  await page.locator(selector).hover();
  await expect(page.locator('[data-hud="tooltip"]')).toHaveAttribute('data-hud-tooltip-active', 'true');
  // The tooltip eases 2px into place over 120ms; its box is read once it has
  // settled (the landing run read a bottom of 593.81 for a box that rests at 592).
  await page.waitForFunction(() => {
    const transform = getComputedStyle(document.querySelector('#hud-tooltip')!).transform;
    return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
  });
  return page.evaluate((hovered) => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const tooltip = document.querySelector<HTMLElement>('#hud-tooltip')!;
    const title = tooltip.querySelector<HTMLElement>('.hud-tooltip__title');
    let bodyTop: number | null = null;
    const rest = title?.nextSibling;
    if (rest && rest.nodeType === Node.TEXT_NODE && (rest.textContent ?? '').length > 1) {
      const range = document.createRange();
      range.setStart(rest, 1);
      range.setEnd(rest, 2);
      bodyTop = range.getBoundingClientRect().top;
    }
    return {
      active: tooltip.dataset.hudTooltipActive,
      text: tooltip.textContent ?? '',
      title: title?.textContent ?? null,
      titleWeight: title ? Number(getComputedStyle(title).fontWeight) : null,
      titleBox: title ? box(title) : null,
      bodyTop,
      box: box(tooltip),
      lineHeight: parseFloat(getComputedStyle(tooltip).lineHeight),
      target: box(document.querySelector(hovered)!),
      bar: box(document.querySelector('.hud-panel--selection')!),
      map: box(document.querySelector('.hud-panel--map')!),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  }, selector);
}

/** The title is a bold line of its own, and what follows starts below it. */
function expectTitledLines(read: TooltipReadout, title: string): void {
  expect(read.title).toBe(title);
  expect(read.titleWeight).toBeGreaterThanOrEqual(600);
  expect(read.bodyTop, 'the line after the title is drawn below it').not.toBeNull();
  expect(read.bodyTop!).toBeGreaterThanOrEqual(read.titleBox!.bottom - 1);
}

async function selectTownCenter(page: Page): Promise<void> {
  await page.keyboard.press('h');
  await expect(page.locator('[data-selection-name]')).toHaveText('Town Center');
}

test('the Town Center\'s and a villager\'s commands say what they do, and the Feudal Age what it needs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
  await selectTownCenter(page);

  const feudal = await hoverAndRead(page, '[data-command="research-feudal-age"]');
  expectTitledLines(feudal, 'Advance to Feudal Age (500 food; 130s; two Dark Age buildings)');
  // No Dark Age building stands at boot, so the simulation's refusal names the
  // five with its count and the tooltip says them once; with the buildings
  // standing the tooltip's own sentence says them
  // (tests/ui/commandHelpTooltipDom.test.ts, over a real bridge).
  expect(feudal.text.split('\n').at(-1))
    .toBe('Needs 2 completed Dark Age buildings (Mill, Lumber Camp, Mining Camp, Barracks, or Dock). You have 0.');
  expect(feudal.text.match(/Lumber Camp/g)).toHaveLength(1);

  const villager = await hoverAndRead(page, '[data-command="train-villager"]');
  expectTitledLines(villager, 'Create Villager (50 food)');
  expect(villager.text.split('\n')[1]).toMatch(/^Gathers resources, and builds and repairs buildings\b/);

  const loom = await hoverAndRead(page, '[data-command="research-loom"]');
  expect(loom.text.split('\n')).toEqual(['Research Loom (50 gold; 25s)', 'Villagers +15 hit points, +1 melee armor and +2 pierce armor.']);

  // A villager, by DE's key for the next idle one, and its House card.
  await page.keyboard.press('.');
  await expect(page.locator('[data-selection-name]')).toHaveText('Villager');
  const house = await hoverAndRead(page, '[data-command="build-house"]');
  expectTitledLines(house, 'Build House (25 wood)');
  expect(house.text.split('\n')[1]).toMatch(/^Supports 5 population\./);
});

// The reported shape (plan 106's HUD card): with the two buildings standing the
// tooltip gave the price alone, so a player who lost one could not learn why
// the age had gone grey without hovering again. The fixture holds a Mill and a
// Barracks and 700 food, so the age is ready.
test('the Feudal Age still says its two Dark Age buildings once the player has them', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await game.waitForPausedBootWithSeed(page, 'feudal-age-fixture');
  await selectTownCenter(page);
  await expect(page.locator('[data-command="research-feudal-age"]')).toBeEnabled();

  const feudal = await hoverAndRead(page, '[data-command="research-feudal-age"]');
  expectTitledLines(feudal, 'Advance to Feudal Age (500 food; 130s; two Dark Age buildings)');
  expect(feudal.text.split('\n').at(-1))
    .toBe('Before you can advance, you need any two Dark Age buildings: Mill, Lumber Camp, Mining Camp, Barracks, or Dock.');
});

// Longer than any real tooltip: the longest the copy makes (an age's, priced in
// all four resources at five digits each, its requirement sentence included)
// with the longest refusal the simulation gives (an age's, naming its
// buildings) though the real tooltip never holds both, and a third of that
// again.
//
// The longest is taken over EVERY unit, building and technology the copy tables
// hold, each at that price and with that refusal, so a longer line added later
// lengthens this test's copy with it (review round 2: the first version took
// the Imperial Age's alone, a constant, not a maximum).
const PRICE = { food: 99999, wood: 99999, gold: 99999, stone: 99999 };
const LONGEST_REFUSAL = 'Needs 2 completed Castle Age buildings (University, Siege Workshop, Monastery, or Castle), or one completed Castle. You have 0.';
const EVERY_REAL = [
  ...(Object.keys(UNIT_HELP) as UnitType[]).map((unitType) => formatTrainTooltip(unitType, PRICE)),
  ...(Object.keys(BUILDING_HELP) as BuildingType[]).map((buildingType) => formatBuildTooltip(buildingType, PRICE)),
  ...(Object.keys({ ...GENERAL_TECHNOLOGY_HELP, ...UPGRADE_TECHNOLOGY_HELP }) as ResearchableTechnologyType[])
    .map((technologyType) => formatResearchTooltip(technologyType, PRICE)),
].map((tooltip) => `${tooltip}\n${LONGEST_REFUSAL}`);
const LONGEST_REAL = EVERY_REAL.reduce((longest, tooltip) => (tooltip.length > longest.length ? tooltip : longest));
const PADDING = 'A line longer than any tooltip the game writes. ';
const LONGER_THAN_ANY = `${LONGEST_REAL}\n${PADDING.repeat(Math.ceil((LONGEST_REAL.length * 0.35) / PADDING.length)).trim()}`;

// What each copy is held to (v0.3.279's landing CI, run 43060908486, and the
// coordinator's three conditions of 2026-11-11).
//
// The bound. The positioner floats a command-bar tooltip above the bar, 8px
// clear of it and of the window's top. At 800x600 the bar's top is at 352px, so
// the room is 336px: eighteen lines of text at 16.8px a line inside the box's
// 18px of padding and border. A copy taller than the room falls back: the
// positioner puts it under the control it describes, pulled up to stay 8px
// inside the window's foot, and slid clear of the minimap. At 1280x720 the
// room is 446px and at 1920x1080 806px.
//
// The worst real copy, LONGEST_REAL, is already longer than any tooltip the
// game draws (it holds an age's requirement sentence AND the refusal that
// stands for it, which the say-once rule never draws together, and four
// five-digit prices). At every size it must float above the bar with at least
// one line of room to spare above it: if a platform leaves it less, that red is
// true, and the answer is the product (a wider tooltip in a narrow window), not
// this test.
//
// LONGER_THAN_ANY, a third longer again, must float above the bar at 1280x720
// and 1920x1080, whatever the platform, so a positioner that always fell back
// goes red. At 800x600 it is past the room or within a line of it (on Windows
// it fitted by one line, on Linux it did not, where the same text wraps a
// little differently, and the first version of this test asserted it above the
// bar there: nobody had read its margin). So there the test measures: a copy
// whose height fits the room must be above the bar, and one that does not must
// be exactly where the fallback puts it. Each case prints its height and its
// spare room in lines, so a run's log shows the platform's own numbers.
const MARGIN = 8;

for (const size of [{ width: 800, height: 600 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`a tooltip longer than any real one stays on screen, above the bar and off the minimap, at ${size.width}x${size.height}`, async ({ page }) => {
    expect(EVERY_REAL.length).toBeGreaterThan(250);
    expect(LONGER_THAN_ANY.length).toBeGreaterThan(LONGEST_REAL.length * 1.3);
    await page.setViewportSize(size);
    await game.waitForPausedBootWithSeed(page, 'aoe2-prototype');
    await selectTownCenter(page);
    const feudal = page.locator('[data-command="research-feudal-age"]');

    for (const [name, copy] of [['the worst real copy', LONGEST_REAL], ['a third longer again', LONGER_THAN_ANY]] as const) {
      // The paused boot draws the card once; the copy is set on the drawn
      // button, and the pointer comes back to it from the map.
      await page.mouse.move(size.width / 2, 120);
      await expect(page.locator('[data-hud="tooltip"]')).toHaveAttribute('data-hud-tooltip-active', 'false');
      await feudal.evaluate((button, text) => { button.setAttribute('data-tooltip', text); }, copy);

      const read = await hoverAndRead(page, '[data-command="research-feudal-age"]');
      expect(read.text, name).toBe(copy);
      expectTitledLines(read, copy.split('\n')[0]!);
      const height = read.box.bottom - read.box.top;
      const room = read.bar.top - 2 * MARGIN;
      const fits = height <= room;
      const spareLines = (read.box.top - MARGIN) / read.lineHeight;
      console.log(`[tooltip-room] ${size.width}x${size.height} ${name} (${copy.length} characters): ${height.toFixed(1)}px tall in a room of ${room.toFixed(1)}px at ${read.lineHeight.toFixed(1)}px a line; ${fits ? `above the bar with ${spareLines.toFixed(1)} lines to spare` : `${((height - room) / read.lineHeight).toFixed(1)} lines past the room, so it falls back under its control`}`);

      // On screen and off the minimap, wherever it is.
      expect(read.box.left, name).toBeGreaterThanOrEqual(0);
      expect(read.box.top, name).toBeGreaterThanOrEqual(0);
      expect(read.box.right, name).toBeLessThanOrEqual(read.viewport.width);
      expect(read.box.bottom, name).toBeLessThanOrEqual(read.viewport.height);
      const overlapsMap = read.box.left < read.map.right && read.map.left < read.box.right
        && read.box.top < read.map.bottom && read.map.top < read.box.bottom;
      expect(overlapsMap, `${name}: no tooltip covers the minimap`).toBe(false);

      if (copy === LONGEST_REAL) {
        expect(read.box.bottom, `${name} floats above the bar`).toBeLessThanOrEqual(read.bar.top);
        expect(spareLines, `${name} has a line of room to spare above it`).toBeGreaterThanOrEqual(1);
      } else if (size.height > 600) {
        expect(read.box.bottom, `${name} floats above the bar where the window has the room`).toBeLessThanOrEqual(read.bar.top);
      } else if (fits) {
        expect(read.box.bottom, `${name} fits the room, so it floats above the bar`).toBeLessThanOrEqual(read.bar.top);
        expect(read.box.top, name).toBeGreaterThanOrEqual(MARGIN - 0.5);
      } else {
        // The fallback, as a claim of its own: under the hovered control, pulled
        // up to stay inside the window's foot (tooltips.ts `positionTooltip`).
        const fallbackTop = Math.max(MARGIN, Math.min(read.target.bottom + MARGIN, read.viewport.height - height - MARGIN));
        expect(Math.abs(read.box.top - fallbackTop), `${name} is past the room, so it sits where the fallback puts it (top ${fallbackTop.toFixed(1)}px)`).toBeLessThanOrEqual(1);
      }
    }
  });
}
