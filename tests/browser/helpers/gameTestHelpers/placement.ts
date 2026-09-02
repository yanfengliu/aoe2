import { expect, type Page } from '@playwright/test';

import type { BuildableBuildingType } from '../../../../src/game/simulation/types';
import { buildPageOf } from '../../../../src/ui/hud/selectionPanel/buildPages';

/**
 * Click a BUILD card the way a player does. DE's villager command card has two
 * pages — Economic and Military — and only the active one is on screen, so a
 * card on the other page is reached by its tab first (spec §14.1).
 */
export async function clickBuildCommand(
  page: Page,
  buildingType: BuildableBuildingType,
): Promise<void> {
  const card = page.locator(`[data-command="build-${buildingType}"]`);
  if (await card.count() === 0) {
    const tab = page.locator(`button[data-build-page="${buildPageOf(buildingType)}"]`);
    await expect(
      tab,
      `no ${buildPageOf(buildingType)} build page tab to reach ${buildingType} through`,
    ).toHaveCount(1);
    await tab.click();
  }
  await card.click();
}

export async function findValidPlacementNearTownCenter(
  page: Page,
  buildingType: string,
  owner = 1,
  preferredAnchors: Array<{ x: number; y: number }> = [],
): Promise<{ x: number; y: number }> {
  const townCenter = await page.evaluate(
    (playerOwner) =>
      window.__AOE2_TEST__!
        .getSnapshot()
        .economyState.buildings.find(
          (building) => building.owner === playerOwner && building.buildingType === 'town-center',
        ) ?? null,
    owner,
  );

  if (!townCenter) {
    throw new Error(`Expected Town Center for player ${owner}.`);
  }

  const isValidAnchor = async (x: number, y: number): Promise<boolean> => {
    const preview = await page.evaluate(
      ({ anchorX, anchorY }) => window.__AOE2_TEST__!.getPlacementPreviewAt(anchorX, anchorY),
      { anchorX: x, anchorY: y },
    );
    if (preview?.isValid !== true) return false;
    // The anchor also has to be REACHABLE BY THE MOUSE. A cell whose screen
    // point sits under a HUD panel gets no pointermove on the canvas, so the
    // preview keeps its previous cell and the caller sees a stale, invalid
    // state that looks exactly like a broken feature. The selection panel grows
    // with the command groups it shows, so which cells are covered changes as
    // the game gains commands — this check is what stops that from silently
    // re-breaking placement tests (it did, when Formation was added in
    // v0.3.25).
    return isPointerReachableCell(page, x, y);
  };

  for (const anchor of preferredAnchors) {
    if (await isValidAnchor(anchor.x, anchor.y)) {
      return anchor;
    }
  }

  for (let radius = 1; radius <= 12; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) {
          continue;
        }

        const x = townCenter.x + offsetX;
        const y = townCenter.y + offsetY;
        if (await isValidAnchor(x, y)) {
          return { x, y };
        }
      }
    }
  }

  throw new Error(`Expected a valid ${buildingType} placement near player ${owner}'s Town Center.`);
}

/**
 * Whether the screen point for this cell is on the world canvas and not
 * covered by a HUD panel. `document.elementFromPoint` answers exactly the
 * question that matters: which element would receive the pointer event.
 */
async function isPointerReachableCell(
  page: Page,
  cellX: number,
  cellY: number,
): Promise<boolean> {
  const point = await page.evaluate(
    ([x, y]) => window.__AOE2_TEST__!.worldToScreen(x, y),
    [cellX, cellY],
  );
  if (!point) return false;
  return page.evaluate(
    ([x, y]) => {
      const target = document.elementFromPoint(x, y);
      return target instanceof HTMLCanvasElement;
    },
    [point.x, point.y],
  );
}
