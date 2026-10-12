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
  // The whole search runs in the page, in one round trip. It used to ask for
  // each candidate's preview, screen point and hit element with three
  // evaluate calls apiece, and on CI's SwiftShader runners those round trips
  // were seconds of a 1920px test (work 123). The candidates, their order and
  // the checks are the same.
  const found = await page.evaluate(({ playerOwner, preferred }) => {
    const api = window.__AOE2_TEST__!;
    const townCenter = api.getEconomyState().buildings.find(
      (building) => building.owner === playerOwner && building.buildingType === 'town-center',
    );
    if (!townCenter) return { townCenter: false as const, anchor: null };
    const isValidAnchor = (x: number, y: number): boolean => {
      if (api.getPlacementPreviewAt(x, y)?.isValid !== true) return false;
      // The anchor also has to be REACHABLE BY THE MOUSE. A cell whose screen
      // point sits under a HUD panel gets no pointermove on the canvas, so the
      // preview keeps its previous cell and the caller sees a stale, invalid
      // state that looks exactly like a broken feature. The selection panel
      // grows with the command groups it shows, so which cells are covered
      // changes as the game gains commands — this check is what stops that
      // from silently re-breaking placement tests (it did, when Formation was
      // added in v0.3.25). `document.elementFromPoint` answers exactly the
      // question that matters: which element would receive the pointer event.
      const point = api.worldToScreen(x, y);
      if (!point) return false;
      return document.elementFromPoint(point.x, point.y) instanceof HTMLCanvasElement;
    };
    for (const anchor of preferred) {
      if (isValidAnchor(anchor.x, anchor.y)) return { townCenter: true as const, anchor };
    }
    for (let radius = 1; radius <= 12; radius += 1) {
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (Math.abs(offsetX) !== radius && Math.abs(offsetY) !== radius) continue;
          const x = townCenter.x + offsetX;
          const y = townCenter.y + offsetY;
          if (isValidAnchor(x, y)) return { townCenter: true as const, anchor: { x, y } };
        }
      }
    }
    return { townCenter: true as const, anchor: null };
  }, { playerOwner: owner, preferred: preferredAnchors });

  if (!found.townCenter) {
    throw new Error(`Expected Town Center for player ${owner}.`);
  }
  if (!found.anchor) {
    throw new Error(`Expected a valid ${buildingType} placement near player ${owner}'s Town Center.`);
  }
  return found.anchor;
}

