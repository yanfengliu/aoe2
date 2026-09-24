// The Natural style's ground textures (spec §14.5; the de-look plan's step 2): one tileable layer per surface,
// baked on the CPU from value noise, plus a large-scale macro field. Original and procedural, as every asset in
// this game is: no image file.
//
// WHY BAKED, NOT PER-PIXEL NOISE. The same noise evaluated in the fragment shader costs a few hundred operations
// a pixel, and CI's browser suite draws on SwiftShader, a CPU rasteriser, where that is every frame of every spec.
// Baked once per page, a surface costs the shader one mipmapped texture lookup, and the mipmaps keep fine grain
// from shimmering when the camera zooms out. The layers are the same bytes on every machine and rasteriser.
//
// Each layer spans DE_GROUND_DETAIL_SPAN world tiles and wraps at its edges. RGB is sRGB-encoded albedo; alpha is
// the surface's "height" (tufts and pebbles high, water low), which the shader uses to make the line between two
// surfaces follow the texture rather than a smooth curve.

import { hash01 } from './aoeVoxelRecipeTypes';

/** Texels along each side of a layer. */
export const DE_GROUND_DETAIL_SIZE = 256;
/** World tiles one layer spans before it repeats: 64 texels a tile, about one texel a pixel at the default zoom. */
export const DE_GROUND_DETAIL_SPAN = 4;
/** Texels along each side of the macro field. */
export const DE_GROUND_MACRO_SIZE = 128;
/** World tiles the macro field spans, at four texels a tile. */
export const DE_GROUND_MACRO_SPAN = 32;

/** Layer order in the texture array; the shader indexes the same numbers. */
export const DE_GROUND_LAYERS = ['grass', 'forest', 'hill', 'water', 'sand', 'dirt'] as const;
export type DeGroundLayer = (typeof DE_GROUND_LAYERS)[number];

type Rgb = readonly [number, number, number];

/** `value` wrapped into [0, period), for values at most one period outside it: a modulo is several times
 *  slower, and the bake calls this tens of millions of times. */
function wrap(value: number, period: number): number {
  if (value < 0) return value + period;
  return value >= period ? value - period : value;
}

/** A tileable value-noise octave: `period` lattice cells across the layer, smoothstep between them. */
class TileNoise {
  private readonly period: number;
  private readonly lattice: Float32Array;

  constructor(period: number, seed: number) {
    this.period = period;
    this.lattice = new Float32Array(period * period);
    for (let y = 0; y < period; y += 1) {
      for (let x = 0; x < period; x += 1) this.lattice[y * period + x] = hash01(x, y, seed);
    }
  }

  /** s, t across the layer, from 0 to 1; the noise wraps at 1. */
  at(s: number, t: number): number {
    const { period, lattice } = this;
    const px = s * period;
    const py = t * period;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    let fx = px - x0;
    let fy = py - y0;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    const xa = wrap(x0, period);
    const ya = wrap(y0, period);
    const xb = wrap(xa + 1, period);
    const yb = wrap(ya + 1, period);
    const a = lattice[ya * period + xa]!;
    const b = lattice[ya * period + xb]!;
    const c = lattice[yb * period + xa]!;
    const d = lattice[yb * period + xb]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
}

/** Octaves from `period` upward, each twice the frequency at half the amplitude; from 0 to 1. */
class TileFbm {
  private readonly octaves: TileNoise[] = [];
  private readonly weights: number[] = [];
  private readonly total: number;

  constructor(period: number, octaves: number, seed: number) {
    let amplitude = 1;
    let total = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      this.octaves.push(new TileNoise(period * 2 ** octave, seed + octave * 101));
      this.weights.push(amplitude);
      total += amplitude;
      amplitude *= 0.5;
    }
    this.total = total;
  }

  at(s: number, t: number): number {
    let sum = 0;
    for (let octave = 0; octave < this.octaves.length; octave += 1) {
      sum += this.octaves[octave]!.at(s, t) * this.weights[octave]!;
    }
    return sum / this.total;
  }
}

/** Jittered dots on a grid of `period` cells a side that wraps: `density` of the cells hold one dot of about
 *  `radius` texels. `at` is 1 inside a dot and 0 outside, with a soft edge one texel wide. */
class DotField {
  private readonly period: number;
  private readonly cell: number;
  /** Per grid cell: the centre's x and y in texels, and the radius, 0 where the cell holds no dot. */
  private readonly dots: Float32Array;

  constructor(period: number, density: number, radius: number, seed: number) {
    this.period = period;
    this.cell = DE_GROUND_DETAIL_SIZE / period;
    this.dots = new Float32Array(period * period * 3);
    for (let gy = 0; gy < period; gy += 1) {
      for (let gx = 0; gx < period; gx += 1) {
        if (hash01(gx, gy, seed) >= density) continue;
        const offset = (gy * period + gx) * 3;
        this.dots[offset] = (0.15 + 0.7 * hash01(gx, gy, seed + 1)) * this.cell;
        this.dots[offset + 1] = (0.15 + 0.7 * hash01(gx, gy, seed + 2)) * this.cell;
        this.dots[offset + 2] = radius * (0.6 + 0.8 * hash01(gx, gy, seed + 3));
      }
    }
  }

  at(u: number, v: number): number {
    const { period, cell, dots } = this;
    const cx = Math.floor(u / cell);
    const cy = Math.floor(v / cell);
    let best = 0;
    for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
      const rowOffset = wrap(gy, period) * period;
      for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
        const offset = (rowOffset + wrap(gx, period)) * 3;
        const radius = dots[offset + 2]!;
        if (radius === 0) continue;
        const ox = u - (gx * cell + dots[offset]!);
        const oy = v - (gy * cell + dots[offset + 1]!);
        const inside = (radius - Math.sqrt(ox * ox + oy * oy)) / 0.9;
        if (inside > best) best = inside >= 1 ? 1 : inside;
      }
    }
    return best;
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** One texel's colour, painted in place: a layer paints a quarter of a million texels, and a fresh array per
 *  step made the bake several times slower than its arithmetic. */
class Paint {
  r = 0;
  g = 0;
  b = 0;

  between(a: Rgb, b: Rgb, t: number): this {
    this.r = a[0] + (b[0] - a[0]) * t;
    this.g = a[1] + (b[1] - a[1]) * t;
    this.b = a[2] + (b[2] - a[2]) * t;
    return this;
  }

  toward(c: Rgb, t: number): this {
    this.r += (c[0] - this.r) * t;
    this.g += (c[1] - this.g) * t;
    this.b += (c[2] - this.b) * t;
    return this;
  }

  scale(factor: number): this {
    this.r *= factor;
    this.g *= factor;
    this.b *= factor;
    return this;
  }
}

/** Paints one texel into `paint` and returns its height; u and v are texel coordinates, s and t the same as
 *  fractions of the layer. */
type LayerPainter = (paint: Paint, u: number, v: number, s: number, t: number) => number;

// Colours are sRGB, chosen around the terrain tints the voxel pipeline uses (terrainTints.ts, and the patch poles
// in aoeVoxelTerrainColor.ts), so the Natural frame keeps the grade step 1 measured.
function grassPainter(): LayerPainter {
  const mottle = new TileFbm(6, 4, 7001);
  const clumps = new TileFbm(16, 3, 7011);
  const tufts = new DotField(48, 0.22, 1.7, 7021);
  const dry = new DotField(40, 0.07, 1.3, 7031);
  const shade = new DotField(36, 0.3, 2.2, 7041);
  // Mottled enough to read as grass, not so much that the four-tile repeat reads as a camouflage print.
  const DARK: Rgb = [78, 112, 62];
  const LIGHT: Rgb = [112, 146, 80];
  const TUFT: Rgb = [132, 156, 78];
  const DRY: Rgb = [170, 164, 102];
  return (paint, u, v, s, t) => {
    const k = clumps.at(s, t);
    const tuft = tufts.at(u, v);
    paint.between(DARK, LIGHT, smoothstep(0.25, 0.75, mottle.at(s, t)))
      .scale((0.89 + 0.2 * k) * (1 - 0.16 * shade.at(u, v)))
      .toward(TUFT, tuft * 0.75)
      .toward(DRY, dry.at(u, v) * 0.8)
      .scale(0.95 + 0.1 * hash01(u, v, 7051));
    return 0.35 + 0.35 * k + 0.3 * tuft;
  };
}

function forestPainter(): LayerPainter {
  const mottle = new TileFbm(6, 4, 7101);
  const litter = new TileFbm(20, 3, 7111);
  const needles = new DotField(56, 0.35, 1.3, 7121);
  const DARK: Rgb = [38, 66, 38];
  const LIGHT: Rgb = [58, 88, 48];
  const LEAF: Rgb = [78, 70, 42];
  const NEEDLE: Rgb = [104, 84, 52];
  return (paint, u, v, s, t) => {
    const m = mottle.at(s, t);
    const needle = needles.at(u, v);
    paint.between(DARK, LIGHT, smoothstep(0.2, 0.8, m))
      .toward(LEAF, smoothstep(0.5, 0.7, litter.at(s, t)) * 0.5)
      .toward(NEEDLE, needle * 0.45)
      .scale(0.93 + 0.14 * hash01(u, v, 7131));
    return 0.3 + 0.4 * m + 0.3 * needle;
  };
}

function hillPainter(): LayerPainter {
  const mottle = new TileFbm(6, 4, 7201);
  const dryness = new TileFbm(8, 3, 7211);
  const soil = new DotField(40, 0.12, 1.5, 7221);
  const tufts = new DotField(48, 0.18, 1.6, 7231);
  // A hill is grass on high ground, drier and sun-caught (terrainTints.ts), not a field of straw.
  const DARK: Rgb = [96, 122, 68];
  const LIGHT: Rgb = [130, 148, 86];
  const DRY: Rgb = [146, 140, 92];
  const SOIL: Rgb = [120, 100, 70];
  const TUFT: Rgb = [140, 154, 82];
  return (paint, u, v, s, t) => {
    const m = mottle.at(s, t);
    const tuft = tufts.at(u, v);
    paint.between(DARK, LIGHT, smoothstep(0.25, 0.75, m))
      .toward(DRY, smoothstep(0.55, 0.75, dryness.at(s, t)) * 0.4)
      .toward(SOIL, soil.at(u, v) * 0.7)
      .toward(TUFT, tuft * 0.6)
      .scale(0.95 + 0.1 * hash01(u, v, 7241));
    return 0.3 + 0.4 * m + 0.3 * tuft;
  };
}

function waterPainter(): LayerPainter {
  const swell = new TileFbm(4, 3, 7301);
  const ripple = new TileFbm(24, 2, 7311);
  const DEEP: Rgb = [34, 80, 104];
  const LIGHT: Rgb = [50, 104, 126];
  return (paint, _u, _v, s, t) => {
    paint.between(DEEP, LIGHT, smoothstep(0.3, 0.7, swell.at(s, t))).scale(0.96 + 0.08 * ripple.at(s, t));
    return 0;
  };
}

function sandPainter(): LayerPainter {
  const mottle = new TileFbm(6, 3, 7401);
  const pebbles = new DotField(44, 0.1, 1.2, 7411);
  const WET: Rgb = [150, 132, 92];
  const DRY: Rgb = [182, 164, 120];
  const PEBBLE: Rgb = [128, 116, 96];
  return (paint, u, v, s, t) => {
    const pebble = pebbles.at(u, v);
    paint.between(WET, DRY, smoothstep(0.3, 0.7, mottle.at(s, t)))
      .toward(PEBBLE, pebble * 0.6)
      .scale(0.94 + 0.12 * hash01(u, v, 7421));
    return 0.2 + 0.3 * pebble;
  };
}

function dirtPainter(): LayerPainter {
  const mottle = new TileFbm(6, 4, 7501);
  const pebbles = new DotField(40, 0.28, 1.6, 7511);
  const DARK: Rgb = [98, 76, 52];
  const LIGHT: Rgb = [132, 104, 70];
  const PEBBLE: Rgb = [150, 136, 116];
  return (paint, u, v, s, t) => {
    const pebble = pebbles.at(u, v);
    paint.between(DARK, LIGHT, smoothstep(0.25, 0.75, mottle.at(s, t)))
      .toward(PEBBLE, pebble * 0.7)
      .scale(0.93 + 0.14 * hash01(u, v, 7521));
    return 0.25 + 0.5 * pebble;
  };
}

const PAINTERS: Record<DeGroundLayer, () => LayerPainter> = {
  grass: grassPainter,
  forest: forestPainter,
  hill: hillPainter,
  water: waterPainter,
  sand: sandPainter,
  dirt: dirtPainter,
};

function byte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Every layer, RGBA8, one after another: the bytes of a DataArrayTexture. */
export function bakeDeGroundDetail(): Uint8Array {
  const size = DE_GROUND_DETAIL_SIZE;
  const layerBytes = size * size * 4;
  const bytes = new Uint8Array(layerBytes * DE_GROUND_LAYERS.length);
  DE_GROUND_LAYERS.forEach((layer, layerIndex) => {
    const paintTexel = PAINTERS[layer]();
    const texel = new Paint();
    let offset = layerIndex * layerBytes;
    for (let v = 0; v < size; v += 1) {
      for (let u = 0; u < size; u += 1) {
        const height = paintTexel(texel, u, v, u / size, v / size);
        bytes[offset] = byte(texel.r);
        bytes[offset + 1] = byte(texel.g);
        bytes[offset + 2] = byte(texel.b);
        bytes[offset + 3] = byte(height * 255);
        offset += 4;
      }
    }
  });
  return bytes;
}

/**
 * The large-scale fields that keep the detail layers from reading as a repeat: R shifts hue (cool to warm grass,
 * dry hill patches, deep and light water), G shifts brightness, and B and A are two independent fields about a
 * tile across that wander the line between two surfaces. Linear bytes, RGBA8, wrapping.
 */
export function bakeDeGroundMacro(): Uint8Array {
  const size = DE_GROUND_MACRO_SIZE;
  const hue = new TileFbm(4, 3, 7601);
  const light = new TileFbm(6, 3, 7611);
  const wanderA = new TileFbm(24, 2, 7621);
  const wanderB = new TileFbm(24, 2, 7631);
  const bytes = new Uint8Array(size * size * 4);
  for (let v = 0; v < size; v += 1) {
    for (let u = 0; u < size; u += 1) {
      const s = u / size;
      const t = v / size;
      const offset = (v * size + u) * 4;
      bytes[offset] = byte(smoothstep(0.2, 0.8, hue.at(s, t)) * 255);
      bytes[offset + 1] = byte(smoothstep(0.2, 0.8, light.at(s, t)) * 255);
      bytes[offset + 2] = byte(wanderA.at(s, t) * 255);
      bytes[offset + 3] = byte(wanderB.at(s, t) * 255);
    }
  }
  return bytes;
}

let bakedDetail: Uint8Array | null = null;
let bakedMacro: Uint8Array | null = null;

/** The detail layers, baked on first use and shared by every ground this page draws. */
export function deGroundDetailBytes(): Uint8Array {
  bakedDetail ??= bakeDeGroundDetail();
  return bakedDetail;
}

/** The macro field, baked on first use and shared by every ground this page draws. */
export function deGroundMacroBytes(): Uint8Array {
  bakedMacro ??= bakeDeGroundMacro();
  return bakedMacro;
}
