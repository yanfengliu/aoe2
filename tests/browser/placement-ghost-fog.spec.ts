// The placement ghost over black ground is drawn the same whatever the fog
// hides (work 122; defect register 2026-09-23; spec §12.1).
//
// The defect, as a player meets it: hold a building over unexplored ground and
// its ghost went red over hidden water, forest, enemy buildings and units, and
// green over open grass, so sweeping it across the black mapped the ground. On
// the boot map at tick 0 a house was red over 86 of 86 wholly unexplored water
// footprints and green over 228 of 228 open-grass ones. Definitive Edition
// stopped the same leak (update 44725), allows a foundation partly on explored
// ground (hotfix 45185) and refuses one wholly unexplored.
//
// This spec drives the real controls: select the villager, click the House
// card, move the mouse over each probe cell, and read the ghost the view draws
// there — its verdict and the parts it is made of — on two variants of one
// fixture that differ only under the human's fog. The simulation-level sweep
// over every footprint is tests/simulation/placementUnexplored.test.ts.
//
// Bound: seven probe cells on one fixture, one building type, one viewport, at
// boot. It proves the drawn ghost follows the fog-blind verdict at those cells,
// not that no other cell differs (the simulation sweep covers those).
import { expect, test, type Page } from '@playwright/test';

import * as game from './helpers/gameTestHelpers';
import {
  HOUSE_ON_UNEXPLORED_GRASS,
  HOUSE_OVER_HIDDEN_FOREST,
  HOUSE_OVER_HIDDEN_HOUSE,
  HOUSE_OVER_HIDDEN_UNIT,
  HOUSE_OVER_HIDDEN_WATER,
  UNEXPLORED_PLACEMENT_HIDDEN_SEED,
  UNEXPLORED_PLACEMENT_OPEN_SEED,
} from '../../src/game/simulation/fixtures/unexploredPlacement';

test.use({ viewport: { width: 1280, height: 800 } });

// Partly explored, each hiding one obstacle in the hidden variant; then wholly
// unexplored, over the hidden variant's clutter (25,12) and over open grass in
// both (28,13) and (34,14).
const PARTLY_EXPLORED = [
  HOUSE_OVER_HIDDEN_WATER,
  HOUSE_OVER_HIDDEN_FOREST,
  HOUSE_OVER_HIDDEN_HOUSE,
  HOUSE_OVER_HIDDEN_UNIT,
];
const WHOLLY_UNEXPLORED = [{ x: 25, y: 12 }, { x: 28, y: 13 }, HOUSE_ON_UNEXPLORED_GRASS];

interface Reading {
  isValid: boolean;
  cellOutlineCount: number;
  blockedMarkerCount: number;
}

async function readGhosts(page: Page, seed: string): Promise<Record<string, Reading>> {
  await game.waitForPausedBootWithSeed(page, seed);
  await page.evaluate(() => window.__AOE2_TEST__!.centerCameraOnWorldPosition(27, 17));
  expect(await game.selectOwnedUnitDirect(page, 1, 'villager')).toBe(true);
  await game.clickBuildCommand(page, 'house');
  await expect(page.locator('[data-placement-mode]')).toHaveText('Placing: House');
  const readings: Record<string, Reading> = {};
  for (const cell of [...PARTLY_EXPLORED, ...WHOLLY_UNEXPLORED]) {
    const point = await game.getScreenPointForCell(page, cell.x, cell.y);
    const onCanvas = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y) instanceof HTMLCanvasElement,
      [point.x, point.y],
    );
    expect(onCanvas, `(${cell.x},${cell.y}) is under the HUD: move the camera`).toBe(true);
    await page.mouse.move(point.x, point.y);
    const state = await page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewState());
    expect(state, `no ghost at (${cell.x},${cell.y})`).toMatchObject({ cellX: cell.x, cellY: cell.y });
    await game.waitForRenderedFrames(page, 2);
    const drawn = await page.evaluate(() => window.__AOE2_TEST__!.getPlacementPreviewVisualState());
    expect(drawn, `the view drew no ghost at (${cell.x},${cell.y})`).not.toBeNull();
    readings[`(${cell.x},${cell.y})`] = {
      isValid: drawn!.isValid,
      cellOutlineCount: drawn!.cellOutlineCount,
      blockedMarkerCount: drawn!.blockedMarkerCount,
    };
  }
  return readings;
}

test('the ghost over unexplored ground is drawn the same whatever the fog hides', async ({ page }) => {
  const open = await readGhosts(page, UNEXPLORED_PLACEMENT_OPEN_SEED);
  const hidden = await readGhosts(page, UNEXPLORED_PLACEMENT_HIDDEN_SEED);
  expect(hidden).toEqual(open);
  // And the readings are the notes': green partly on explored ground over what
  // the fog hides (44725, 45185), red with the blocked marker on ground wholly
  // unexplored (45185).
  for (const cell of PARTLY_EXPLORED) {
    expect(hidden[`(${cell.x},${cell.y})`], `(${cell.x},${cell.y})`).toEqual({
      isValid: true,
      cellOutlineCount: 4,
      blockedMarkerCount: 0,
    });
  }
  for (const cell of WHOLLY_UNEXPLORED) {
    expect(hidden[`(${cell.x},${cell.y})`]?.isValid, `(${cell.x},${cell.y})`).toBe(false);
    expect(hidden[`(${cell.x},${cell.y})`]?.blockedMarkerCount ?? 0).toBeGreaterThan(0);
  }
});
