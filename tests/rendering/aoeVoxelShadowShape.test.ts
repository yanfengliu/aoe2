// Shape-matched ground shadows: the silhouette a caster throws is derived
// from the caster's OWN geometry, so a shape change moves its shadow with it.
import { describe, expect, it } from 'vitest';

import { SHADOW_PROJECTION } from '../../src/rendering/voxel/aoeVoxelDaylight';
import type { VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import {
  MAX_SHADOW_BANDS,
  shadowCasterBands,
  type ShadowCasterBand,
} from '../../src/rendering/voxel/aoeVoxelShadowShape';
import { silhouetteTriangles } from '../../src/rendering/voxel/aoeVoxelShadowTiling';

function box(
  key: string,
  centerX: number, centerY: number, centerZ: number,
  width: number, height: number, depth: number,
): VoxelPart {
  return {
    key, surface: 'matte', tint: 0x808080,
    centerX, centerY, centerZ, width, height, depth,
  };
}

/** Ground area of a triangle set, and the count of points covered twice. */
function cover(
  triangles: readonly (readonly { x: number; z: number }[])[],
  px: number,
  pz: number,
): number {
  let hits = 0;
  for (const [a, b, c] of triangles as readonly (readonly { x: number; z: number }[])[]) {
    const s = (b!.x - a!.x) * (pz - a!.z) - (b!.z - a!.z) * (px - a!.x);
    const t = (c!.x - b!.x) * (pz - b!.z) - (c!.z - b!.z) * (px - b!.x);
    const u = (a!.x - c!.x) * (pz - c!.z) - (a!.z - c!.z) * (px - c!.x);
    const eps = 1e-9;
    if ((s > eps && t > eps && u > eps) || (s < -eps && t < -eps && u < -eps)) hits += 1;
  }
  return hits;
}

/** The exact shadow of a set of bands, sampled by marching the sun ray. */
function inTrueShadow(bands: readonly ShadowCasterBand[], px: number, pz: number, margin: number): boolean {
  const v = SHADOW_PROJECTION;
  for (const band of bands) {
    const steps = 200;
    for (let i = 0; i <= steps; i += 1) {
      const t = band.lift + (band.height * i) / steps;
      const x = px - v.x * t;
      const z = pz - v.z * t;
      if (
        x >= band.x0 - margin && x <= band.x1 + margin
        && z >= band.z0 - margin && z <= band.z1 + margin
      ) return true;
    }
  }
  return false;
}

describe('shadow caster bands', () => {
  it('reads the caster’s vertical profile off its own parts', () => {
    // A trunk under a wider crown: two bands, narrow below and wide above.
    const bands = shadowCasterBands([
      box('t:trunk', 5, 0.5, 5, 0.2, 1, 0.2),
      box('t:crown', 5, 1.6, 5, 1.2, 1.2, 1.2),
    ], 0);
    expect(bands.length).toBeGreaterThanOrEqual(2);
    const lowest = bands[0]!;
    const highest = bands.at(-1)!;
    expect(lowest.lift).toBeCloseTo(0, 6);
    expect(lowest.x1 - lowest.x0).toBeLessThan(0.35);
    expect(highest.x1 - highest.x0).toBeGreaterThan(1.0);
    expect(highest.lift + highest.height).toBeCloseTo(2.2, 6);
  });

  it('follows a shape change without any recipe-side shadow edit', () => {
    const narrow = shadowCasterBands([box('a:body', 5, 0.5, 5, 0.4, 1, 0.4)], 0);
    const wide = shadowCasterBands([box('a:body', 5, 0.5, 5, 1.4, 1, 0.4)], 0);
    expect(narrow[0]!.x1 - narrow[0]!.x0).toBeCloseTo(0.4, 6);
    expect(wide[0]!.x1 - wide[0]!.x0).toBeCloseTo(1.4, 6);
    const taller = shadowCasterBands([box('a:body', 5, 1.5, 5, 0.4, 3, 0.4)], 0);
    expect(taller.at(-1)!.lift + taller.at(-1)!.height).toBeCloseTo(3, 6);
  });

  it('never exceeds the band budget, however many parts a recipe emits', () => {
    const parts = Array.from({ length: 40 }, (_, index) => box(
      `m:p${String(index)}`, 5 + index * 0.02, 0.1 + index * 0.12, 5, 0.3 + index * 0.05, 0.2, 0.4,
    ));
    expect(shadowCasterBands(parts, 0).length).toBeLessThanOrEqual(MAX_SHADOW_BANDS);
  });

  it('clamps mass below the ground plane, so a carcass does not overshoot', () => {
    const bands = shadowCasterBands([box('c:body', 5, 0, 5, 1, 1, 1)], 0);
    expect(bands.every((band) => band.lift >= 0)).toBe(true);
    expect(bands.at(-1)!.lift + bands.at(-1)!.height).toBeCloseTo(0.5, 6);
  });

  it('ignores parts that cast nothing — water surfaces and zero-size slivers', () => {
    const wake: VoxelPart = { ...box('s:wake', 5, 0.1, 5, 3, 0.1, 3), surface: 'water' };
    const hull = box('s:hull', 5, 0.4, 5, 0.8, 0.8, 0.8);
    const bands = shadowCasterBands([wake, hull], 0);
    expect(Math.max(...bands.map((band) => band.x1 - band.x0))).toBeCloseTo(0.8, 6);
  });
});

describe('shadow silhouette', () => {
  it('tiles a single box’s swept shadow with non-overlapping triangles', () => {
    const bands = shadowCasterBands([box('b:body', 5, 0.5, 5, 1, 1, 1)], 0);
    const triangles = silhouetteTriangles(bands, SHADOW_PROJECTION);
    expect(triangles.length).toBeGreaterThan(0);
    let inside = 0;
    // The offsets keep samples off the geometry's own rational lattice. Every
    // coordinate here is a multiple of 0.1 and the sun projection is 11/18 by
    // 1/2, so a round sample can land EXACTLY on the diagonal two triangles
    // share — which no strict inside-test can attribute to either, and the
    // rasteriser's own fill rule settles at draw time.
    for (let px = 3.5137; px <= 7.5; px += 0.03) {
      for (let pz = 3.5071; pz <= 7.5; pz += 0.03) {
        const hits = cover(triangles, px, pz);
        expect(hits, `double cover at ${String(px)},${String(pz)}`).toBeLessThanOrEqual(1);
        if (inTrueShadow(bands, px, pz, -0.04)) {
          expect(hits, `hole at ${String(px)},${String(pz)}`).toBe(1);
          inside += 1;
        } else if (!inTrueShadow(bands, px, pz, 0.04)) {
          expect(hits, `stray at ${String(px)},${String(pz)}`).toBe(0);
        }
      }
    }
    expect(inside).toBeGreaterThan(500);
  });

  it('narrows the shadow where the caster narrows, instead of one rectangle', () => {
    // A wide crown over a thin trunk. Near the trunk's own ground cell the
    // shadow must be trunk-narrow; further along the sun ray it must widen to
    // the crown. A single caster box makes both widths the same, which is the
    // defect this replaces.
    const bands = shadowCasterBands([
      box('t:trunk', 5, 1, 5, 0.24, 2, 0.24),
      box('t:crown', 5, 2.7, 5, 1.4, 1.4, 1.4),
    ], 0);
    const triangles = silhouetteTriangles(bands, SHADOW_PROJECTION);
    const widthAcross = (px: number): number => {
      let lo = Number.POSITIVE_INFINITY;
      let hi = Number.NEGATIVE_INFINITY;
      for (let pz = 3.0013; pz <= 9; pz += 0.005) {
        if (cover(triangles, px, pz) > 0) { lo = Math.min(lo, pz); hi = Math.max(hi, pz); }
      }
      return hi - lo;
    };
    // At the trunk's own x the crown shadow has not arrived yet: the crown
    // sits 1.98 up, so its shadow starts 1.98 * 0.611 further along x.
    expect(widthAcross(5)).toBeLessThan(0.6);
    expect(widthAcross(6)).toBeGreaterThan(1.5);
  });

  it('covers every band and never spills past the union of their shadows', () => {
    const bands = shadowCasterBands([
      box('h:wall', 5, 0.6, 5, 2, 1.2, 2),
      box('h:roof', 5, 1.5, 5, 2.4, 0.6, 2.4),
      box('h:chimney', 5.6, 2.1, 5.6, 0.3, 0.6, 0.3),
    ], 0);
    const triangles = silhouetteTriangles(bands, SHADOW_PROJECTION);
    for (let px = 3.0137; px <= 10; px += 0.05) {
      for (let pz = 3.0071; pz <= 10; pz += 0.05) {
        const hits = cover(triangles, px, pz);
        expect(hits).toBeLessThanOrEqual(1);
        if (inTrueShadow(bands, px, pz, -0.06)) expect(hits, `hole at ${String(px)},${String(pz)}`).toBe(1);
        else if (!inTrueShadow(bands, px, pz, 0.12)) expect(hits, `stray at ${String(px)},${String(pz)}`).toBe(0);
      }
    }
  });

  it('returns nothing for a caster with no height and no footprint', () => {
    expect(silhouetteTriangles([], SHADOW_PROJECTION)).toEqual([]);
  });
});
