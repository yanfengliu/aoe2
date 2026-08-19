// Shore placement (M5 naval). A Dock is the only building that must straddle
// the boundary between the domains: it stands on LAND (so villagers can reach
// it and it occupies land cells like any other building) but must TOUCH water
// (so the ships it trains have somewhere to appear).
//
// Pure: the terrain lookup is passed in, so this is testable without a world
// and reusable by both the placement validator and the HUD preview.

import type { BuildingType, TerrainKind } from './types';

/** Buildings that must be built against water. */
const SHORE_BUILDINGS = new Set<BuildingType>(['dock']);

export function requiresShorePlacement(buildingType: BuildingType): boolean {
  return SHORE_BUILDINGS.has(buildingType);
}

/**
 * Whether a footprint sits entirely on land AND touches at least one water
 * cell, counting diagonals — an AoE2 dock may sit on a corner of a bay.
 *
 * `terrainAt` returns null off-map; off-map is neither land nor water, so a
 * footprint at the map edge is not "coastal" by virtue of the void beyond it.
 */
export function touchesWater(
  x: number,
  y: number,
  width: number,
  height: number,
  terrainAt: (x: number, y: number) => TerrainKind | null,
): boolean {
  // Every cell of the footprint must be land.
  for (let cellY = y; cellY < y + height; cellY += 1) {
    for (let cellX = x; cellX < x + width; cellX += 1) {
      const kind = terrainAt(cellX, cellY);
      if (kind === null || kind === 'water') return false;
    }
  }
  // At least one cell of the surrounding ring must be water.
  for (let ringY = y - 1; ringY <= y + height; ringY += 1) {
    for (let ringX = x - 1; ringX <= x + width; ringX += 1) {
      const insideFootprint = ringX >= x && ringX < x + width
        && ringY >= y && ringY < y + height;
      if (insideFootprint) continue;
      if (terrainAt(ringX, ringY) === 'water') return true;
    }
  }
  return false;
}
