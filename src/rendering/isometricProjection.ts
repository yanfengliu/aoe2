// Isometric projection foundation (isometric-overhaul increment 1). The pure math seam that maps world
// CELL coordinates to screen-space pixels for a 2:1 diamond-tile isometric view,
// and back for click hit-testing. This is the core the isometric render overhaul
// builds on: every renderer places entities through `worldToIso`, and the
// pointer→cell hit-test runs through `isoToWorld`. No browser dependency, no
// state — a rotation+scale of the square grid into a diamond layout.
//
// The standalone camera pans and zooms over the resulting layout.

// A cell occupies a diamond ISO_TILE_WIDTH wide and ISO_TILE_HEIGHT tall. 2:1
// (classic Age-of-Empires-style isometric) so the grid reads as a flat plane
// tilted back at the conventional angle.
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

// Vertical screen pixels per unit of terrain elevation — higher ground is lifted
// upward on screen (used once elevation is projected; flat terrain passes 0).
export const ISO_ELEVATION_STEP = 16;

export interface IsoPoint {
  x: number;
  y: number;
}

// World cell (cellX, cellY, elevation) → iso screen offset in pixels (before the
// camera transform). +cellX travels down-and-right, +cellY down-and-left; both
// add screen-Y so the grid stacks toward the viewer, and elevation lifts up.
export function worldToIso(cellX: number, cellY: number, elevation = 0): IsoPoint {
  return {
    x: (cellX - cellY) * (ISO_TILE_WIDTH / 2),
    y: (cellX + cellY) * (ISO_TILE_HEIGHT / 2) - elevation * ISO_ELEVATION_STEP,
  };
}

// Inverse of `worldToIso` on the GROUND plane (elevation 0) — turns an iso screen
// point back into fractional cell coordinates for pointer→cell hit-testing.
// Callers floor the result to get the containing tile.
export function isoToWorld(isoX: number, isoY: number): { cellX: number; cellY: number } {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;
  const hx = isoX / halfW; // = cellX - cellY
  const hy = isoY / halfH; // = cellX + cellY
  return {
    cellX: (hx + hy) / 2,
    cellY: (hy - hx) / 2,
  };
}
