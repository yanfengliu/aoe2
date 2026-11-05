import { type Page } from '@playwright/test';

import { getMinimapPoint, getScreenPointForCell, getScreenPointForWorldPosition } from './camera';
import type { ScreenPoint } from './types';

// A left click on a cell's centre selects a unit standing there or not by the
// unit's id: a unit is drawn on the sub-cell slot its id picks (id mod 16,
// `worldOccupancy.ts`), up to three quarters of a cell off the centre, and a
// fixture that gains an entity moves it (lessons, 2026-09-26; gate-proofs,
// work 142). So this refuses a left click on a cell a unit the page draws
// stands on, unless the click selects nothing: a building placement or a
// ground order (A, P, G) armed, when the click places or orders. Click the
// unit where the page draws it with `clickUnit`. BOUND: the cells are read
// before the click, so a unit walking into or out of the cell in between is
// outside this.
export async function clickCell(
  page: Page,
  cellX: number,
  cellY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  if (button === 'left') {
    const standing = await page.evaluate(({ x, y }) => {
      const api = window.__AOE2_TEST__!;
      if (api.getSelectionState().placementMode !== null || api.getArmedGroundOrder() !== null) return null;
      const drawn = new Set(api.getDisplayedEntities().filter((entity) => entity.kind === 'unit').map((entity) => entity.id));
      const unit = api.getEconomyState().units
        .find((candidate) => candidate.x === x && candidate.y === y && drawn.has(candidate.id));
      return unit === undefined ? null : { id: unit.id, unitType: unit.unitType };
    }, { x: cellX, y: cellY });
    if (standing !== null) {
      throw new Error(
        `clickCell refuses a left click on cell (${cellX},${cellY}): ${standing.unitType} ${standing.id} `
        + 'stands on it, and a unit is drawn on the sub-cell slot its id picks, not on the cell\'s centre, '
        + 'so whether the click selects it depends on its id. Click it where the page draws it with '
        + `game.clickUnit(page, ${standing.id}).`,
      );
    }
  }
  const point = await getScreenPointForCell(page, cellX, cellY);
  await clickCanvasAtPoint(page, point, button);
}

/**
 * Where the page draws entity `id`, read off the click stack, which selects
 * nothing: up the body from its feet, the middle of the longest run of points
 * where a left click would take it first. When no point takes it first (the
 * entity is drawn behind something that outranks it), the middle of the run
 * where it is drawn at all, so the spec, not this helper, judges what a click
 * there does. Throws when the page draws it nowhere above its feet. The search
 * draws at most the one frame a waiting snapshot needs (browser-specs rule,
 * 2026-09-24), and throws if it drew more.
 */
export async function getUnitClickPoint(
  page: Page,
  id: number,
): Promise<ScreenPoint & { readonly onTop: boolean }> {
  const found = await page.evaluate((targetId) => {
    const api = window.__AOE2_TEST__!;
    const shown = api.getDisplayedEntities().find((entity) => entity.id === targetId);
    if (shown === undefined) return { error: `the page draws no entity ${String(targetId)}` };
    const framesBefore = api.getWorldRendererState().framesDrawn;
    // Straight up the screen from the ground point: iso x stays 0, and an iso
    // y of -h is h/16 cells of x + y less (isometricProjection.ts).
    const worldAt = (isoY: number): { x: number; y: number } => ({
      x: shown.x + 0.5 + isoY / 16 / 2,
      y: shown.y + 0.5 + isoY / 16 / 2,
    });
    const onTop: number[] = [];
    const drawn: number[] = [];
    for (let isoY = 0; isoY >= -72; isoY -= 1) {
      const point = worldAt(isoY);
      const stack = api.getClickStackAtWorldPosition(point.x, point.y);
      if (stack[0]?.id === targetId) onTop.push(isoY);
      if (stack.some((entity) => entity.id === targetId)) drawn.push(isoY);
    }
    const middleOfLongestRun = (points: number[]): number | null => {
      let best: number[] = [];
      let run: number[] = [];
      for (const isoY of points) {
        run = run.length > 0 && run[run.length - 1]! - 1 === isoY ? [...run, isoY] : [isoY];
        if (run.length > best.length) best = run;
      }
      return best.length === 0 ? null : best[Math.floor(best.length / 2)]!;
    };
    const topIsoY = middleOfLongestRun(onTop);
    const isoY = topIsoY ?? middleOfLongestRun(drawn);
    const framesDrawn = api.getWorldRendererState().framesDrawn - framesBefore;
    if (isoY === null) return { error: `the page draws entity ${String(targetId)} at no point above its feet`, framesDrawn };
    const world = worldAt(isoY);
    return { ...api.worldToScreen(world.x - 0.5, world.y - 0.5), onTop: topIsoY !== null, framesDrawn };
  }, id);
  if ('error' in found) throw new Error(`getUnitClickPoint: ${found.error}`);
  if (found.framesDrawn > 1) {
    throw new Error(`getUnitClickPoint drew ${String(found.framesDrawn)} frames reading the click stack; it may draw one`);
  }
  return { x: found.x, y: found.y, onTop: found.onTop };
}

/** Clicks entity `id` where the page draws it (`getUnitClickPoint`). */
export async function clickUnit(
  page: Page,
  id: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  await clickCanvasAtPoint(page, await getUnitClickPoint(page, id), button);
}

export async function clickWorldPosition(
  page: Page,
  worldX: number,
  worldY: number,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  const point = await getScreenPointForWorldPosition(page, worldX, worldY);
  await clickCanvasAtPoint(page, point, button);
}

export async function clickCanvasAtPoint(
  page: Page,
  point: ScreenPoint,
  button: 'left' | 'right' = 'left',
): Promise<void> {
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button });
}

export async function clickMinimapAt(
  page: Page,
  normalizedX: number,
  normalizedY: number,
): Promise<void> {
  const point = await getMinimapPoint(page, normalizedX, normalizedY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { button: 'left' });
}

export async function dragMinimapTo(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): Promise<void> {
  const startPoint = await getMinimapPoint(page, startX, startY);
  const endPoint = await getMinimapPoint(page, endX, endY);

  await page.mouse.move(startPoint.x, startPoint.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(endPoint.x, endPoint.y, { steps: 10 });
  await page.mouse.up({ button: 'left' });
}

export async function moveMouseToCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<void> {
  const point = await getScreenPointForCell(page, cellX, cellY);
  await page.mouse.move(point.x, point.y);
}
