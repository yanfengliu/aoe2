import Phaser from 'phaser';

import type { ProjectedEntityView, TerrainKind } from '../../../game/simulation/types';
import { worldToIso } from './isoProjection';

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
//   2. v0.1.43 — a square-edge kind-to-kind feather (stipple bands along a
//      cell's 4 von-Neumann edges) softened the hard tile seams. It was
//      dropped at the v0.1.103 isometric switch (its geometry assumed
//      axis-aligned square edges) and re-added at v0.1.111 as a DIAMOND-edge
//      feather: for each of the 4 diamond edges whose neighbour cell is a
//      different kind, a dithered band of small blend-tinted specks is
//      stippled just inside the edge (see drawEdgeFeather).
// The jitter is purely presentational — the sim/bridge tint + cell geometry are
// untouched, and every primitive is a deterministic pure function of the cell
// kind and its coordinates (no Math.random / time).

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

// Third-salt hash, used to dither the diamond-edge feather specks (per cell, per
// edge, per slot) without a stored noise map. No Math.random / time by design.
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


// Draw a single terrain cell as an isometric diamond (rhombus): the four cell
// corners projected into iso screen space, filled with the jittered base tint.
// `entities` is retained in the signature for the diamond-edge feather re-add
// (it needs neighbour kinds); `cellSize` is unused now that geometry comes from
// worldToIso rather than cell*cellSize.
export function drawTerrainCell(
  graphics: Phaser.GameObjects.Graphics,
  entities: readonly ProjectedEntityView[],
  entity: ProjectedEntityView,
  cellSize: number,
): void {
  void cellSize;
  const { x: cellX, y: cellY } = entity;

  const top = worldToIso(cellX, cellY);
  const right = worldToIso(cellX + 1, cellY);
  const bottom = worldToIso(cellX + 1, cellY + 1);
  const left = worldToIso(cellX, cellY + 1);
  graphics.fillStyle(terrainCellTint(entity.tint, cellX, cellY), 1);
  graphics.fillPoints([top, right, bottom, left], true);

  // Diamond-edge feather: for each of the 4 diamond edges whose neighbour cell is
  // a DIFFERENT kind, stipple a dithered band of small blend-tinted specks just
  // inside the edge, so the hard kind-to-kind boundary reads as a soft dithered
  // transition (the iso analogue of the v0.1.43 square feather). Neighbour cell
  // feathers back symmetrically, so the two bands interlock across the boundary.
  const grid = terrainKindGrid(entities);
  const kind = entity.entityType as TerrainKind;
  const corners = [top, right, bottom, left];
  const centre = worldToIso(cellX + 0.5, cellY + 0.5);
  for (const edge of DIAMOND_EDGES) {
    const neighbourKind = grid.get(packXY(cellX + edge.dx, cellY + edge.dy));
    if (!neighbourKind || neighbourKind === kind) continue;
    const blend = blendTint(TERRAIN_BASE_TINT[kind], TERRAIN_BASE_TINT[neighbourKind]);
    drawEdgeFeather(graphics, corners[edge.a], corners[edge.b], centre, blend, cellX, cellY, edge.i);
  }
}

// Key a cell by grid coordinates for the neighbour-kind lookup (MAP_WIDTH is 60;
// a wide stride keeps the packing collision-free).
const GRID_STRIDE = 1 << 16;
function packXY(x: number, y: number): number {
  return y * GRID_STRIDE + x;
}

// Neighbour-kind grid, memoized on the `entities` array reference so all terrain
// cells in ONE render pass share a single O(n) build (the scene passes the same
// array to every drawTerrainCell call in a frame). A fresh array each frame
// (interpolateProjectedEntities .map) means the cache rebuilds once per frame.
const kindGridCache = new WeakMap<object, Map<number, TerrainKind>>();
function terrainKindGrid(entities: readonly ProjectedEntityView[]): Map<number, TerrainKind> {
  const cached = kindGridCache.get(entities);
  if (cached) return cached;
  const grid = new Map<number, TerrainKind>();
  for (const e of entities) {
    if (e.layer === 'terrain') grid.set(packXY(e.x, e.y), e.entityType as TerrainKind);
  }
  kindGridCache.set(entities, grid);
  return grid;
}

// The 4 diamond edges: which von-Neumann neighbour each borders (dx,dy) and the
// two corner indices (into [top,right,bottom,left]) that span it. top→right
// borders N, right→bottom E, bottom→left S, left→top W.
const DIAMOND_EDGES = [
  { i: 0, dx: 0, dy: -1, a: 0, b: 1 },
  { i: 1, dx: 1, dy: 0, a: 1, b: 2 },
  { i: 2, dx: 0, dy: 1, a: 2, b: 3 },
  { i: 3, dx: -1, dy: 0, a: 3, b: 0 },
] as const;

const FEATHER_SLOTS = 4;
const FEATHER_BAND = 0.26; // fraction of the way from the edge toward the centre
const FEATHER_ALPHA = 0.5;
const FEATHER_THRESHOLD = 0.42; // a slot emits a speck only above this (dithered)

// Stipple the feather specks along one differing edge (A→B), each nudged inward
// toward the diamond centre so they stay inside the tile. Deterministic per
// (cell, edge, slot).
function drawEdgeFeather(
  graphics: Phaser.GameObjects.Graphics,
  a: { x: number; y: number },
  b: { x: number; y: number },
  centre: { x: number; y: number },
  blend: number,
  cellX: number,
  cellY: number,
  edgeIndex: number,
): void {
  graphics.fillStyle(blend, FEATHER_ALPHA);
  for (let i = 0; i < FEATHER_SLOTS; i += 1) {
    if (cellNoise3(cellX * 7 + edgeIndex, cellY * 7 + edgeIndex, i + 1) < FEATHER_THRESHOLD) continue;
    const t = (i + 0.5) / FEATHER_SLOTS;
    const ex = a.x + (b.x - a.x) * t;
    const ey = a.y + (b.y - a.y) * t;
    graphics.fillCircle(ex + (centre.x - ex) * FEATHER_BAND, ey + (centre.y - ey) * FEATHER_BAND, 1.6);
  }
}
