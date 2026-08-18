// Per-cell terrain colour: patch-scale variation fields, the shallow-water
// band, and cross-kind seam softening. Pure position functions — the same
// cell always resolves the same colour, so nothing shimmers and saves and
// replays are untouched. Requested 2026-08-17: grass patches and water cells
// vary in colour, and the meeting line between kinds is not a clear cut.
import type { TerrainKind } from '../../game/simulation/types';
import { hash01, requireTint, shade } from './aoeVoxelRecipeTypes';

export interface TerrainCellSample {
  readonly kind: TerrainKind;
  readonly tint: number;
}

export type TerrainCellAt = (x: number, z: number) => TerrainCellSample | undefined;

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinear value noise over an integer lattice — smooth at patch scale. */
export function valueNoise01(x: number, z: number, scale: number, salt: number): number {
  const px = x / scale;
  const pz = z / scale;
  const x0 = Math.floor(px);
  const z0 = Math.floor(pz);
  const fx = smooth(px - x0);
  const fz = smooth(pz - z0);
  const a = hash01(x0, z0, salt);
  const b = hash01(x0 + 1, z0, salt);
  const c = hash01(x0, z0 + 1, salt);
  const d = hash01(x0 + 1, z0 + 1, salt);
  return a * (1 - fx) * (1 - fz) + b * fx * (1 - fz) + c * (1 - fx) * fz + d * fx * fz;
}

/** Two octaves: broad patches with smaller irregularity riding on top. */
function patchField(x: number, z: number, saltA: number, saltB: number): number {
  return 0.62 * valueNoise01(x, z, 7.3, saltA) + 0.38 * valueNoise01(x, z, 3.1, saltB);
}

function luma(tint: number): number {
  return ((tint >>> 16) & 0xff) * 0.35 + ((tint >>> 8) & 0xff) * 0.5 + (tint & 0xff) * 0.15;
}

/** Rescale `target` to the brightness of `base`, keeping its hue. Fog
 *  projection darkens hidden/explored cell tints before they reach the
 *  renderer; accents must inherit that darkness or hidden ground would glow
 *  (caught by the near-black palette assertion in the overlays suite). */
function matchLuma(target: number, base: number): number {
  const targetLuma = luma(target);
  if (targetLuma <= 0) return target;
  const scale = Math.min(4, luma(base) / targetLuma);
  const channel = (shift: number) => (
    Math.max(0, Math.min(255, Math.round(((target >>> shift) & 0xff) * scale)))
  );
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

function mixTint(a: number, b: number, t: number): number {
  const channel = (shift: number) => {
    const from = (a >>> shift) & 0xff;
    const to = (b >>> shift) & 0xff;
    return Math.max(0, Math.min(255, Math.round(from + (to - from) * t)));
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

// Patch accent poles per kind: the field slides each cell between them.
const GRASS_COOL = 0x486e3c;
const GRASS_WARM = 0x7d9a4b;
const WATER_DEEP = 0x2b5a6d;
const WATER_LIGHT = 0x4f97a8;
const FOREST_COOL = 0x2f5a38;
const SHALLOW_WATER = 0x66aab0;
const WET_SAND = 0x9b8a5e;

function patchColour(baseTint: number, kind: TerrainKind, x: number, z: number): number {
  // Accents are luma-matched to the base tint: the patch field shifts HUE,
  // while the shade term carries the brightness variation. This keeps the
  // fields fog-safe — a near-black hidden cell stays near-black.
  if (kind === 'grass') {
    const p = patchField(x, z, 401, 409);
    const accent = matchLuma(mixTint(GRASS_COOL, GRASS_WARM, p), baseTint);
    return shade(mixTint(baseTint, accent, 0.42), 0.94 + 0.12 * p);
  }
  if (kind === 'water') {
    const p = patchField(x, z, 419, 421);
    const accent = matchLuma(mixTint(WATER_DEEP, WATER_LIGHT, p), baseTint);
    return shade(mixTint(baseTint, accent, 0.45), 0.92 + 0.14 * p);
  }
  if (kind === 'forest') {
    const p = patchField(x, z, 431, 433);
    return shade(mixTint(baseTint, matchLuma(FOREST_COOL, baseTint), 0.12), 0.92 + 0.1 * p);
  }
  const p = patchField(x, z, 439, 443);
  return shade(baseTint, 0.93 + 0.12 * p);
}

/** 0 = open water, 1 = touching land, 0.5 = one cell removed (both rings
 *  include diagonals so the shallow band wraps corners without notches). */
function shoreCloseness(x: number, z: number, cellAt: TerrainCellAt): number {
  for (let ring = 1; ring <= 2; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dz = -ring; dz <= ring; dz += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
        const neighbour = cellAt(x + dx, z + dz);
        if (neighbour !== undefined && neighbour.kind !== 'water') {
          return ring === 1 ? 1 : 0.5;
        }
      }
    }
  }
  return 0;
}

const EDGE_NEIGHBOURS = [
  { dx: 0, dz: -1 },
  { dx: 1, dz: 0 },
  { dx: 0, dz: 1 },
  { dx: -1, dz: 0 },
] as const;

/** The full colour pipeline for one terrain cell. */
export function terrainCellColor(
  baseTint: number,
  kind: TerrainKind,
  x: number,
  z: number,
  cellAt: TerrainCellAt,
): number {
  requireTint(baseTint);
  let colour = patchColour(baseTint, kind, x, z);
  if (kind === 'water') {
    const closeness = shoreCloseness(x, z, cellAt);
    if (closeness > 0) {
      colour = shade(
        mixTint(colour, matchLuma(SHALLOW_WATER, colour), 0.32 * closeness),
        1 + 0.11 * closeness,
      );
    }
  } else {
    // Land: pull boundary cells toward what they border so the meeting line
    // is a gradient, not a cut. A water neighbour warms the cell toward a wet
    // sandy edge; a different land kind blends toward that neighbour's colour.
    let landBlendSum = 0;
    let landBlendCount = 0;
    let touchesWater = false;
    for (const step of EDGE_NEIGHBOURS) {
      const neighbour = cellAt(x + step.dx, z + step.dz);
      if (neighbour === undefined || neighbour.kind === kind) continue;
      if (neighbour.kind === 'water') {
        touchesWater = true;
      } else {
        landBlendSum = landBlendCount === 0
          ? neighbour.tint
          : mixTint(landBlendSum, neighbour.tint, 1 / (landBlendCount + 1));
        landBlendCount += 1;
      }
    }
    if (landBlendCount > 0) {
      colour = mixTint(colour, landBlendSum, landBlendCount > 1 ? 0.24 : 0.16);
    }
    if (touchesWater) {
      colour = shade(mixTint(colour, matchLuma(WET_SAND, colour), 0.24), 1.02);
    }
  }
  // Gentle per-cell grain on top of the patch fields — quiet enough that
  // patches read as patches instead of confetti. Full channel precision:
  // the palette carries one entry per distinct cell colour, which stays in
  // the low thousands even on a 64x64 map.
  const bucket = Math.floor(hash01(x, z, 31) * 5) - 2;
  return shade(colour, 1 + bucket * 0.008);
}
