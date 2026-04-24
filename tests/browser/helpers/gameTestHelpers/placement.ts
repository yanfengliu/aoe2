import { type Page } from '@playwright/test';

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
    return preview?.isValid === true;
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
