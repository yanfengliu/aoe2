import Phaser from 'phaser';

// Terrain cell rendering. Extracted from GameScene so the terrain branch of
// the render loop stays a single call and the texture logic is unit-testable
// without a Phaser stage.
//
// M7 graphics (north star: an AoE2-HD-quality look from ORIGINAL/procedural
// art only — no copyrighted assets): the seed bakes one flat tint per terrain
// kind (scenarioSeedOps.seedTerrain), so every grass cell was the identical
// colour and the map read as a grid of solid blocks. We apply a subtle,
// deterministic per-cell brightness jitter at draw time so adjacent same-kind
// cells differ slightly and the terrain reads as a textured surface. Purely
// presentational — the sim/bridge tint is untouched.

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

// Draw a single terrain cell with its textured tint. The +1 on the rect size
// overdraws by a pixel to hide seams between cells (matches the prior inline
// terrain draw in GameScene).
export function drawTerrainCell(
  graphics: Phaser.GameObjects.Graphics,
  baseTint: number,
  cellX: number,
  cellY: number,
  cellSize: number,
): void {
  graphics.fillStyle(terrainCellTint(baseTint, cellX, cellY), 1);
  graphics.fillRect(cellX * cellSize, cellY * cellSize, cellSize + 1, cellSize + 1);
}
