import type { ProjectedEntityView } from '../../../game/simulation/types';
import { worldToIso } from './isoProjection';

// Bake a freshly-drawn terrain Graphics into a RenderTexture so per-frame the
// terrain costs ONE textured-quad draw instead of the ~24k iso-diamond fills a
// live Graphics re-walks to the GPU every frame (the dominant per-frame render
// cost — a Graphics re-submits its whole command list each frame even when it
// wasn't redrawn; see docs/learning/lessons.md). The RT is sized to the
// terrain's iso bounding box (computed from the cell-grid corners, since
// worldToIso is affine so the extent lives at the corners) and positioned in
// world space so the camera pans/zooms it exactly like the source Graphics.
//
// Trade-off: the bake is a fixed-resolution texture, so it upscales (nearest,
// pixelArt) when the camera zooms past the bake resolution — bake at ≥ max-zoom
// res if full-zoom crispness matters and the size fits the GPU texture limit.
export function bakeTerrainTexture(
  terrainTexture: Phaser.GameObjects.RenderTexture,
  terrainLayer: Phaser.GameObjects.Graphics,
  terrainCells: readonly ProjectedEntityView[],
  cellSize: number,
): void {
  if (terrainCells.length === 0) {
    return;
  }
  let minCX = Infinity;
  let maxCX = -Infinity;
  let minCY = Infinity;
  let maxCY = -Infinity;
  for (const c of terrainCells) {
    if (c.x < minCX) minCX = c.x;
    if (c.x > maxCX) maxCX = c.x;
    if (c.y < minCY) minCY = c.y;
    if (c.y > maxCY) maxCY = c.y;
  }
  const corners = [
    worldToIso(minCX, minCY),
    worldToIso(maxCX + 1, minCY),
    worldToIso(minCX, maxCY + 1),
    worldToIso(maxCX + 1, maxCY + 1),
  ];
  const minX = Math.floor(Math.min(...corners.map((p) => p.x))) - cellSize;
  const minY = Math.floor(Math.min(...corners.map((p) => p.y))) - cellSize;
  const maxX = Math.ceil(Math.max(...corners.map((p) => p.x))) + cellSize;
  const maxY = Math.ceil(Math.max(...corners.map((p) => p.y))) + cellSize;
  terrainTexture.setPosition(minX, minY);
  terrainTexture.resize(maxX - minX, maxY - minY);
  terrainTexture.clear();
  // Draw the (hidden) source Graphics into the RT, offsetting by the bbox origin
  // so world-iso (px,py) lands at texture-local (px-minX, py-minY) and the RT at
  // world (minX,minY) re-projects it to the same world position.
  terrainLayer.setVisible(true);
  terrainTexture.draw(terrainLayer, -minX, -minY);
  terrainLayer.setVisible(false);
}
