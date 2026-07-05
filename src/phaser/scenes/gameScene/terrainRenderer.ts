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
//      DROPPED at the v0.1.103 isometric switch because its geometry assumed
//      axis-aligned square edges; a diamond-edge feather returns in a later
//      increment. blendTint / TERRAIN_BASE_TINT are kept for that re-add.
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
  void entities;
  void cellSize;
  const { x: cellX, y: cellY } = entity;

  const top = worldToIso(cellX, cellY);
  const right = worldToIso(cellX + 1, cellY);
  const bottom = worldToIso(cellX + 1, cellY + 1);
  const left = worldToIso(cellX, cellY + 1);
  graphics.fillStyle(terrainCellTint(entity.tint, cellX, cellY), 1);
  graphics.fillPoints([top, right, bottom, left], true);
}
