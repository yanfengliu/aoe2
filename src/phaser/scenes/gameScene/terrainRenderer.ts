import Phaser from 'phaser';

import type { ProjectedEntityView, TerrainKind } from '../../../game/simulation/types';

// Terrain cell rendering. Extracted from GameScene so the terrain branch of
// the render loop stays a single call and the texture logic is unit-testable
// without a Phaser stage.
//
// M7 graphics (north star: an AoE2-HD-quality look from ORIGINAL/procedural
// art only — no copyrighted assets):
//   1. v0.1.30 — the seed bakes one flat tint per terrain kind
//      (scenarioSeedOps.seedTerrain), so every grass cell was the identical
//      colour and the map read as a grid of solid blocks. We apply a subtle,
//      deterministic per-cell brightness jitter at draw time so adjacent
//      same-kind cells differ slightly and the terrain reads as a textured
//      surface.
//   2. v0.1.43 — adjacent cells of DIFFERENT kinds (grass↔forest↔water↔hill)
//      met at a hard rectangular seam — the classic tile-grid tell. We now
//      feather that seam: for each of a cell's 4 von-Neumann edges whose
//      neighbour is a different kind, we stipple a band of small specks (tinted
//      with the BLEND of the two kinds' base tints) on the inner side of the
//      edge. The neighbour cell feathers back symmetrically, so the two stipple
//      bands interlock across the boundary and it reads as a soft, dithered
//      transition instead of a straight line.
// Both are purely presentational — the sim/bridge tint + cell geometry are
// untouched, and every primitive is a deterministic pure function of the cell
// kind, its neighbour kinds, and the cell coordinates (no Math.random / time).

// Maximum per-cell brightness jitter, as a fraction of each channel. Small on
// purpose: large enough to break the flat block, gentle enough to read as
// dappled light/shade rather than static.
const JITTER = 0.07;

// Deterministic 2D integer hash → [0, 1). Pure mixing of the cell coordinates
// means a given cell always gets the same tint (no per-frame shimmer) without
// storing a noise map. No Math.random / time input by design.
function cellNoise(cellX: number, cellY: number): number {
  let h = (cellX * 374761393 + cellY * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// Deterministic hash with a third salt channel, used to dither the transition
// specks (per cell, per edge, per slot) without a stored noise map.
function cellNoise3(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function clampChannel(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

// Per-kind base tints — mirrors scenarioSeedOps.seedTerrain so the transition
// colour is derived from the SAME palette the simulation seeds (a neighbour's
// blend colour is hue-stable, independent of that neighbour's own jitter).
export const TERRAIN_BASE_TINT: Record<TerrainKind, number> = {
  grass: 0x587f4e,
  forest: 0x2f5e34,
  water: 0x295a75,
  hill: 0x8c7d5a,
};

// Apply a subtle, deterministic per-cell brightness jitter to a base terrain
// tint. The same multiplier hits all three channels, so hue is preserved and
// only luminance varies — the cell looks lit/shaded, not recoloured.
export function terrainCellTint(baseTint: number, cellX: number, cellY: number): number {
  const mult = 1 + (cellNoise(cellX, cellY) * 2 - 1) * JITTER;
  const r = clampChannel(((baseTint >> 16) & 0xff) * mult);
  const g = clampChannel(((baseTint >> 8) & 0xff) * mult);
  const b = clampChannel((baseTint & 0xff) * mult);
  return (r << 16) | (g << 8) | b;
}

// Per-channel average of two tints — the colour of a transition between two
// terrain kinds. Pure; commutative.
export function blendTint(a: number, b: number): number {
  const r = (((a >> 16) & 0xff) + ((b >> 16) & 0xff)) >> 1;
  const g = (((a >> 8) & 0xff) + ((b >> 8) & 0xff)) >> 1;
  const bch = ((a & 0xff) + (b & 0xff)) >> 1;
  return (r << 16) | (g << 8) | bch;
}

// Key a terrain cell by its grid coordinates. MAP_WIDTH is 60; a stride well
// past any realistic map width keeps the packing collision-free.
const GRID_STRIDE = 1 << 16;
function packXY(x: number, y: number): number {
  return y * GRID_STRIDE + x;
}

// Build a coordinate → kind map from the terrain entities so a cell can read its
// neighbours' kinds. Memoized on the `entities` array reference so all N terrain
// cells in a SINGLE render pass share ONE O(n) build instead of rebuilding the
// grid per cell — the scene passes the same `displayedEntities` array to every
// drawTerrainCell call in a frame, turning an O(n²) per-frame cost into O(n). The
// memo does NOT persist across frames: the live path assigns `displayedEntities =
// interpolateProjectedEntities(...)`, whose `.map()` returns a fresh array each
// render, so the cache misses and rebuilds once per render pass (O(n)/frame —
// same order as the existing per-frame interpolate + terrain fills, negligible at
// this map scale). A stale grid is therefore impossible: a fresh key each render
// always rebuilds from the current entities. Old arrays GC with the WeakMap.
const kindGridCache = new WeakMap<object, Map<number, TerrainKind>>();
function terrainKindGrid(entities: readonly ProjectedEntityView[]): Map<number, TerrainKind> {
  const cached = kindGridCache.get(entities);
  if (cached) return cached;
  const grid = new Map<number, TerrainKind>();
  for (const entity of entities) {
    if (entity.layer === 'terrain') {
      grid.set(packXY(entity.x, entity.y), entity.entityType as TerrainKind);
    }
  }
  kindGridCache.set(entities, grid);
  return grid;
}

// The four von-Neumann edges, as (dx, dy) neighbour offsets. The index is
// salted into the speck hash so each edge's stipple is independent.
const EDGES: ReadonlyArray<readonly [number, number]> = [
  [0, -1], // north
  [1, 0], //  east
  [0, 1], //  south
  [-1, 0], // west
];

// How deep (as a fraction of the cell) the feather band reaches in from an
// edge, and how many speck slots run along the edge. Kept shallow + sparse so
// the seam softens without smearing the cell's own colour.
const BAND_DEPTH = 0.34;
const SLOTS_ALONG_EDGE = 5;
const SPECK_ALPHA = 0.55;
// A slot emits a speck only when its hash clears this threshold — a dithered
// (not solid) band, so the boundary interlocks rather than forming a hard
// inner line.
const SPECK_THRESHOLD = 0.38;

// Draw the feather specks for one differing edge of a cell. Every speck stays
// strictly inside the cell rect (on the inner side of the edge). Pure: speck
// presence + jitter derive only from (cellX, cellY, edgeIndex, slot).
function drawEdgeFeather(
  graphics: Phaser.GameObjects.Graphics,
  blend: number,
  cellX: number,
  cellY: number,
  cellSize: number,
  edgeIndex: number,
): void {
  const [dx, dy] = EDGES[edgeIndex];
  const ox = cellX * cellSize;
  const oy = cellY * cellSize;
  const band = cellSize * BAND_DEPTH;
  const slot = cellSize / SLOTS_ALONG_EDGE;
  const speck = slot * 0.62;

  graphics.fillStyle(blend, SPECK_ALPHA);
  for (let i = 0; i < SLOTS_ALONG_EDGE; i += 1) {
    const present = cellNoise3(cellX * 7 + edgeIndex, cellY * 7 + edgeIndex, i + 1);
    if (present < SPECK_THRESHOLD) continue;
    // Position along the shared edge (the axis parallel to the edge).
    const along = i * slot + (cellNoise3(cellX, cellY, i * 4 + edgeIndex) * (slot - speck));
    // Depth in from the edge (the axis perpendicular to the edge), within the
    // band. Deeper specks are rarer-looking because of the threshold above.
    const depth = cellNoise3(cellY, cellX, i * 9 + edgeIndex) * (band - speck);

    let sx: number;
    let sy: number;
    if (dy === -1) {
      // north edge: top of cell, specks hang DOWN into the cell.
      sx = ox + along;
      sy = oy + depth;
    } else if (dy === 1) {
      // south edge: bottom of cell, specks sit UP from the bottom.
      sx = ox + along;
      sy = oy + cellSize - speck - depth;
    } else if (dx === 1) {
      // east edge: right of cell, specks sit LEFT from the right.
      sx = ox + cellSize - speck - depth;
      sy = oy + along;
    } else {
      // west edge: left of cell, specks reach RIGHT into the cell.
      sx = ox + depth;
      sy = oy + along;
    }
    graphics.fillRect(sx, sy, speck, speck);
  }
}

// Draw a single terrain cell: the jittered base fill, then a feathered
// transition along each edge whose neighbour is a different kind. The +1 on the
// base rect overdraws by a pixel to hide hairline seams between same-kind cells
// (matches the prior inline terrain draw in GameScene).
export function drawTerrainCell(
  graphics: Phaser.GameObjects.Graphics,
  entities: readonly ProjectedEntityView[],
  entity: ProjectedEntityView,
  cellSize: number,
): void {
  const { x: cellX, y: cellY } = entity;
  const ownKind = entity.entityType as TerrainKind;
  const ownBase = TERRAIN_BASE_TINT[ownKind] ?? entity.tint;

  // Base fill (v0.1.30): jittered tint + 1px overdraw.
  graphics.fillStyle(terrainCellTint(entity.tint, cellX, cellY), 1);
  graphics.fillRect(cellX * cellSize, cellY * cellSize, cellSize + 1, cellSize + 1);

  // Feather each edge whose neighbour is a different kind (v0.1.43).
  const grid = terrainKindGrid(entities);
  for (let edgeIndex = 0; edgeIndex < EDGES.length; edgeIndex += 1) {
    const [dx, dy] = EDGES[edgeIndex];
    const neighbourKind = grid.get(packXY(cellX + dx, cellY + dy));
    // Missing neighbour (map edge) or same kind → no transition.
    if (neighbourKind === undefined || neighbourKind === ownKind) continue;
    const blend = blendTint(ownBase, TERRAIN_BASE_TINT[neighbourKind]);
    drawEdgeFeather(graphics, blend, cellX, cellY, cellSize, edgeIndex);
  }
}
