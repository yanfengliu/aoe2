// The SHAPE half of sun-cast ground shadows: what silhouette a caster throws
// on the ground, and that it is the caster's own shape rather than a
// rectangle. The DEPTH half is `aoeVoxelShadowLayering.test.ts`.
import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import { createBuildingParts } from '../../src/rendering/voxel/aoeVoxelBuildingRecipes';
import {
  castShadowParts,
  SHADOW_LEVEL_STEP,
  SHADOW_LEVELS,
  SHADOW_SLAB_THICKNESS,
} from '../../src/rendering/voxel/aoeVoxelCastShadows';
import {
  AOE_DAYLIGHT,
  SHADOW_PROJECTION,
  shadowProjectionFor,
} from '../../src/rendering/voxel/aoeVoxelDaylight';
import { voxelPartWorldCorners } from '../../src/rendering/voxel/aoeVoxelGeometry';
import { matrixForPart, type VoxelPart } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';
import { createResourceParts } from '../../src/rendering/voxel/aoeVoxelResourceRecipes';
import {
  shadowCasterBands,
  type ShadowCasterBand,
} from '../../src/rendering/voxel/aoeVoxelShadowShape';
import { createUnitParts } from '../../src/rendering/voxel/aoeVoxelUnitRecipes';

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    generation: 0,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 4,
    y: 6,
    elevation: 0,
    tint: 0x3568c0,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

function house(overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return entity({
    kind: 'building',
    layer: 'building',
    entityType: 'house',
    visualVariant: 'complete',
    // The footprint the GAME builds (`src/game/content/buildingFootprints.ts`),
    // not `entity()`'s 1x1 default. A review found the coverage assertions
    // below passing on the 1x1 and failing six times on the 2x2 — the gate's
    // bound was a size that is never placed.
    footprintWidth: 2,
    footprintHeight: 2,
    ...overrides,
  });
}

function tree(x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return entity({ kind: 'resource', layer: 'resource', entityType: 'tree', x, y, ...overrides });
}



function shadows(parts: readonly VoxelPart[]): VoxelPart[] {
  return parts.filter((part) => part.surface === 'shadow');
}

function solids(parts: readonly VoxelPart[]): VoxelPart[] {
  return parts.filter((part) => part.surface !== 'shadow');
}


/** Whether the wedge's ground TRIANGLE contains the point. The wedge's local
 *  footprint is the half of the unit square below its diagonal, so the local
 *  coordinates must also sum to at most one. */
function coversGround(part: VoxelPart, px: number, pz: number): boolean {
  const m = matrixForPart(part);
  const ax = m[0]!; const az = m[2]!;
  const bx = m[8]!; const bz = m[10]!;
  const det = ax * bz - bx * az;
  const dx = px - m[12]!; const dz = pz - m[14]!;
  const a = (dx * bz - bx * dz) / det + 0.5;
  const c = (ax * dz - az * dx) / det + 0.5;
  const eps = 1e-9;
  return a > eps && c > eps && a + c < 1 - eps;
}

function coverage(parts: readonly VoxelPart[], px: number, pz: number): number {
  return shadows(parts).filter((part) => coversGround(part, px, pz)).length;
}

/** The exact swept shadow of a caster's bands, with each band grown
 *  (`margin` > 0) or shrunk (`margin` < 0) so edge samples are not disputed.
 *  Marching the sun ray is the independent check: it never touches the
 *  silhouette tiling's own envelope maths. */
function inBandShadow(
  bands: readonly ShadowCasterBand[],
  px: number,
  pz: number,
  margin: number,
): boolean {
  const v = SHADOW_PROJECTION;
  const steps = 400;
  for (const band of bands) {
    const lo = band.lift - margin;
    const hi = band.lift + band.height + margin;
    for (let i = 0; i <= steps; i += 1) {
      const t = lo + (hi - lo) * (i / steps);
      if (t < 0) continue;
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

/** Width of the drawn shadow ACROSS the sun ray, at `along` of the way along
 *  it. Measured in the sun's own frame, because that is the only frame where
 *  a swept box has a constant width and a shape-matched shadow does not. */
function crossWidth(
  parts: readonly VoxelPart[],
  bands: readonly ShadowCasterBand[],
  along: number,
): number {
  const reach = Math.hypot(SHADOW_PROJECTION.x, SHADOW_PROJECTION.z);
  const forward = { x: SHADOW_PROJECTION.x / reach, z: SHADOW_PROJECTION.z / reach };
  const across = { x: -forward.z, z: forward.x };
  const corners = bands.flatMap((band) => [band.x0, band.x1].flatMap(
    (x) => [band.z0, band.z1].flatMap((z) => [
      { u: x * across.x + z * across.z, w: x * forward.x + z * forward.z + band.lift * reach },
      {
        u: x * across.x + z * across.z,
        w: x * forward.x + z * forward.z + (band.lift + band.height) * reach,
      },
    ]),
  ));
  const w = Math.min(...corners.map((corner) => corner.w))
    + along * (Math.max(...corners.map((corner) => corner.w))
      - Math.min(...corners.map((corner) => corner.w)));
  const uLo = Math.min(...corners.map((corner) => corner.u)) - 0.5;
  const uHi = Math.max(...corners.map((corner) => corner.u)) + 0.5;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (let u = uLo; u <= uHi; u += 0.004) {
    const px = u * across.x + w * forward.x;
    const pz = u * across.z + w * forward.z;
    if (coverage(parts, px, pz) > 0) { lo = Math.min(lo, u); hi = Math.max(hi, u); }
  }
  return hi > lo ? hi - lo : 0;
}

/** The highest solid top face under `(px, pz)` — read from the parts
 *  themselves, so an assertion about where a shadow LANDS shares no expression
 *  with the code that decides where to draw it. The first version of the pad
 *  test asserted `plinth.lift + plinth.height`, the identical expression
 *  production used, and so proved only that the code agreed with itself while
 *  every pad layer floated up to 0.147 world units above its surface. */
function solidSurfaceUnder(
  parts: readonly VoxelPart[],
  px: number,
  pz: number,
  /** Ignore anything above the layer: the roof is over the plinth in plan, and
   *  the surface a shadow lands ON is the highest one it is not under. */
  ceiling: number,
): number | null {
  let top: number | null = null;
  for (const part of solids(parts)) {
    const corners = voxelPartWorldCorners(part);
    const xs = corners.map((corner) => corner.x);
    const zs = corners.map((corner) => corner.z);
    // A corner lands ON the part's own edge, so the containment test needs the
    // float slack: the house's pad corner reads 5.780000000000001 against a
    // plinth edge of 5.78.
    if (px < Math.min(...xs) - 1e-6 || px > Math.max(...xs) + 1e-6) continue;
    if (pz < Math.min(...zs) - 1e-6 || pz > Math.max(...zs) + 1e-6) continue;
    const y = Math.max(...corners.map((corner) => corner.y));
    if (y > ceiling + 1e-6) continue;
    if (top === null || y > top) top = y;
  }
  return top;
}

function bandsFootprint(bands: readonly ShadowCasterBand[]) {
  return {
    x0: Math.min(...bands.map((band) => band.x0)),
    x1: Math.max(...bands.map((band) => band.x1)),
    z0: Math.min(...bands.map((band) => band.z0)),
    z1: Math.max(...bands.map((band) => band.z1)),
  };
}

/** The THREE ground corners of a shadow wedge. `voxelPartWorldCorners` gives
 *  the enclosing box, whose fourth ground corner is outside the triangle, so
 *  a reach measured from it overstates by the full sweep. */
function triangleCorners(part: VoxelPart): { x: number; z: number }[] {
  const m = matrixForPart(part);
  return [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]].map(([lx, lz]) => ({
    x: m[0]! * lx! + m[8]! * lz! + m[12]!,
    z: m[2]! * lx! + m[10]! * lz! + m[14]!,
  }));
}

describe('cast shadow projection', () => {
  it('falls away from the sun the renderer hands to the voxel daylight rig', () => {
    expect(AOE_DAYLIGHT.sunOffset).toEqual({ x: -22, y: 36, z: -18 });
    expect(SHADOW_PROJECTION.x).toBeCloseTo(22 / 36, 10);
    expect(SHADOW_PROJECTION.z).toBeCloseTo(18 / 36, 10);
    expect(shadowProjectionFor({ x: 10, y: 20, z: -5 })).toEqual({ x: -0.5, z: 0.25 });
  });

  it('refuses a sun at or below the ground, naming the offending height', () => {
    expect(() => shadowProjectionFor({ x: 1, y: 0, z: 1 })).toThrow(/sunOffset\.y.*got 0/);
    expect(() => shadowProjectionFor({ x: 1, y: -3, z: 1 })).toThrow(/sunOffset\.y.*got -3/);
  });
});

describe('cast shadow shape', () => {
  it('tiles the swept silhouette of a house without gaps or double cover', () => {
    const parts = createBuildingParts(house(), '60:1', 0);
    const slabs = shadows(parts);
    expect(slabs.length).toBeGreaterThan(2);
    expect(slabs[0]!.key).toBe('60:1:building-shadow');
    const bands = shadowCasterBands(solids(parts), 0);
    expect(bands.length).toBeGreaterThan(1);
    // Two layers: the ground, and the top of the plinth this house stands on.
    const heights = [...new Set(slabs.map((slab) => slab.centerY))].sort((a, b) => a - b);
    expect(heights).toHaveLength(2);
    // The raised layer sits ON a real surface, checked against the parts.
    for (const corner of slabs
      .filter((slab) => slab.centerY === heights[1]!)
      .flatMap(triangleCorners)) {
      const layer = heights[1]! - heights[0]!;
      const surface = solidSurfaceUnder(parts, corner.x, corner.z, layer);
      expect(surface, `nothing under the plinth layer at ${String(corner.x)},${String(corner.z)}`)
        .not.toBeNull();
      expect(layer).toBeCloseTo(surface!, 6);
    }
    for (const slab of slabs) {
      expect(slab.height).toBeCloseTo(SHADOW_SLAB_THICKNESS, 10);
      // As EMITTED, before the lane is resolved: the recipe's own cell level,
      // which is always one of the nine. `resolveShadowLevels` may lift it
      // past the band later, and does in a dense crowd.
      expect(heights[0]!).toBeGreaterThanOrEqual(SHADOW_SLAB_THICKNESS / 2);
      expect(heights[0]!).toBeLessThan(SHADOW_SLAB_THICKNESS / 2 + SHADOW_LEVELS * SHADOW_LEVEL_STEP);
    }
    // The ground layer is the one that must tile the whole silhouette. The
    // plinth layer sits above it and is checked on its own below; the plinth
    // is opaque, so the ground layer under it is never blended.
    const groundLayer = slabs.filter((slab) => slab.centerY === heights[0]!);
    let inside = 0;
    // Offsets keep samples off the recipe's own rational lattice, where a
    // sample can land EXACTLY on the diagonal two triangles share — which no
    // strict inside-test can attribute to either, and which the rasteriser's
    // fill rule settles at draw time.
    for (let px = 3.0137; px <= 8; px += 0.04) {
      for (let pz = 5.0071; pz <= 10; pz += 0.04) {
        const count = coverage(groundLayer, px, pz);
        expect(count, `double shadow at ${String(px)},${String(pz)}`).toBeLessThanOrEqual(1);
        if (inBandShadow(bands, px, pz, -0.05)) {
          expect(count, `hole at ${String(px)},${String(pz)}`).toBe(1);
          inside += 1;
        } else if (!inBandShadow(bands, px, pz, 0.06)) {
          expect(count, `stray shadow at ${String(px)},${String(pz)}`).toBe(0);
        }
      }
    }
    expect(inside).toBeGreaterThan(200);
    // The sweep reaches beyond the footprint toward +x,+z only.
    const ground = bandsFootprint(bands);
    expect(coverage(groundLayer, ground.x1 + 0.3, ground.z1 + 0.25)).toBe(1);
    expect(coverage(groundLayer, ground.x0 - 0.1, ground.z0 - 0.1)).toBe(0);
  });

  it('lands a building’s own shadow on the plinth it stands on', () => {
    // Almost every building here sits on a plinth wider than its walls, and
    // the sun is 52 degrees up, so the WHOLE of a building's shadow falls
    // inside its own plinth. Drawing shadows on the ground alone left the
    // largest objects in the game with none at all — measured on the Town
    // Center: 0.82 tiles of shadow beyond a 3.44 tile plinth.
    const parts = createBuildingParts(entity({
      kind: 'building', layer: 'building', entityType: 'town-center',
      visualVariant: 'complete', footprintWidth: 4, footprintHeight: 4,
    }), '62:1', 0);
    const bands = shadowCasterBands(solids(parts), 0);
    const plinth = bands[0]!;
    const slabs = shadows(parts);
    const heights = [...new Set(slabs.map((slab) => slab.centerY))].sort((a, b) => a - b);
    expect(heights).toHaveLength(2);
    const onPlinth = slabs.filter((slab) => slab.centerY === heights[1]!);
    expect(onPlinth.length).toBeGreaterThan(0);
    // It sits ON a real top face, and every corner of it has one underneath.
    // Measured from the parts, never from the band expression production uses:
    // that assertion passed while the layer floated 0.093 above the plinth.
    for (const corner of onPlinth.flatMap(triangleCorners)) {
      const layer = heights[1]! - heights[0]!;
      const surface = solidSurfaceUnder(parts, corner.x, corner.z, layer);
      expect(surface, `the plinth layer hangs over air at ${String(corner.x)},${String(corner.z)}`)
        .not.toBeNull();
      expect(layer).toBeCloseTo(surface!, 6);
    }
    // ...and it stays within the caster's own base in plan.
    for (const corner of onPlinth.flatMap(triangleCorners)) {
      expect(corner.x).toBeGreaterThanOrEqual(plinth.x0 - 1e-6);
      expect(corner.x).toBeLessThanOrEqual(plinth.x1 + 1e-6);
      expect(corner.z).toBeGreaterThanOrEqual(plinth.z0 - 1e-6);
      expect(corner.z).toBeLessThanOrEqual(plinth.z1 + 1e-6);
    }
    // ...and it covers a real part of the plinth rather than a sliver.
    let covered = 0;
    for (let px = plinth.x0 + 0.0137; px <= plinth.x1; px += 0.05) {
      for (let pz = plinth.z0 + 0.0071; pz <= plinth.z1; pz += 0.05) {
        const hits = coverage(onPlinth, px, pz);
        expect(hits, `double shadow on the plinth at ${String(px)},${String(pz)}`).toBeLessThanOrEqual(1);
        covered += hits;
      }
    }
    expect(covered).toBeGreaterThan(200);
  });

  it('leaves a caster with no exposed pad on one layer', () => {
    // A tree's trunk is the lowest band, and nothing stands exposed on top of
    // it, so a second layer would draw a patch inside the crown that no one
    // can see. The rule is the pad's own geometry: short, and wider in plan
    // than the mass above it.
    const parts = createResourceParts(tree(4, 6), '8:9', 0);
    expect(new Set(shadows(parts).map((slab) => slab.centerY)).size).toBe(1);
    const villager = createUnitParts(entity({ entityType: 'villager' }), '7:9', 0);
    expect(new Set(shadows(villager).map((slab) => slab.centerY)).size).toBe(1);
  });

  it('follows a recipe shape change with no shadow-side edit', () => {
    // The standing requirement: the shadow is DERIVED, never authored beside
    // the shape. Nothing in the shadow code names a part, so raising a body
    // moves the shadow that body throws — and a recipe that grows a taller
    // roof next year gets a longer shadow for free.
    const body = (height: number): VoxelPart[] => [{
      key: 'x:body', surface: 'matte', tint: 0x808080,
      centerX: 5.5, centerY: height / 2, centerZ: 5.5, width: 1, height, depth: 1,
    }];
    const reachOf = (height: number): number => {
      const cast = castShadowParts(entity({ x: 5, y: 5 }), 'x', 's', 0, body(height));
      return Math.max(...cast.flatMap(triangleCorners).map((corner) => corner.x));
    };
    // A box twice as tall throws its far edge twice as far along the sun ray.
    expect(reachOf(2) - 6).toBeCloseTo(2 * SHADOW_PROJECTION.x, 6);
    expect(reachOf(1) - 6).toBeCloseTo(1 * SHADOW_PROJECTION.x, 6);
    // ...and widening the body widens the shadow, on the same derivation.
    const wide = castShadowParts(entity({ x: 5, y: 5 }), 'x', 's', 0, [{
      ...body(1)[0]!, width: 2,
    }]);
    expect(Math.max(...wide.flatMap(triangleCorners).map((c) => c.x))
      - Math.min(...wide.flatMap(triangleCorners).map((c) => c.x))).toBeCloseTo(2 + SHADOW_PROJECTION.x, 6);
  });

  it('lets a Town Center’s tower streak past the roof it stands on', () => {
    // The single-box caster dropped every part under a quarter of the largest
    // footprint, so a tower and a flag pole cast nothing at all and the roof's
    // rectangle was the whole shadow. The profile keeps them: they are a thin
    // band at the top, and a thin band high up throws a long thin streak.
    const parts = createBuildingParts(entity({
      kind: 'building', layer: 'building', entityType: 'town-center',
      visualVariant: 'complete', footprintWidth: 4, footprintHeight: 4,
    }), '61:1', 0);
    const bands = shadowCasterBands(solids(parts), 0);
    const top = bands.at(-1)!;
    const base = bands[0]!;
    expect(top.lift).toBeGreaterThan(1.5);
    expect(top.x1 - top.x0).toBeLessThan(base.x1 - base.x0);
    const corners = shadows(parts).flatMap(triangleCorners);
    const reach = Math.max(...corners.map((corner) => corner.x));
    // The tallest mass sets the reach, so the shadow runs past where the
    // roof alone would have ended.
    expect(reach).toBeCloseTo(
      Math.max(...bands.map((band) => band.x1 + (band.lift + band.height) * SHADOW_PROJECTION.x)),
      6,
    );
    // ...and past where the widest band alone would have ended, which is all
    // the single-box caster ever drew.
    expect(reach).toBeGreaterThan(base.x1 + (base.lift + base.height) * SHADOW_PROJECTION.x + 0.5);
  });

  it('narrows a tree’s shadow at the trunk and widens it at the crown', () => {
    const parts = createResourceParts(tree(4, 6), '8:2', 0);
    const bands = shadowCasterBands(solids(parts), 0);
    expect(bands.length).toBeGreaterThan(1);
    expect(bands[0]!.x1 - bands[0]!.x0).toBeLessThan(bands.at(-1)!.x1 - bands.at(-1)!.x0);
    // The gate on "not a rectangle": measure the shadow ACROSS the sun ray at
    // several distances along it. A single box's swept shadow is a hexagon,
    // whose width across the ray is CONSTANT between its two end caps — so a
    // taper here cannot be produced by any one caster box, only by a caster
    // that genuinely narrows with height. This tree does: 1.12 tiles of crown
    // over a 0.4 tile top.
    const lowest = Math.min(...shadows(parts).map((slab) => slab.centerY));
    const groundLayer = shadows(parts).filter((slab) => slab.centerY === lowest);
    const widths = [0.2, 0.4, 0.6, 0.8].map((along) => crossWidth(groundLayer, bands, along));
    expect(widths[0]!).toBeGreaterThan(1.0);
    expect(widths[1]!).toBeGreaterThan(1.0);
    // Far along the ray only the narrow top of the tree is still casting.
    expect(widths[3]!).toBeLessThan(widths[1]! * 0.8);
    expect(widths[3]!).toBeLessThan(0.95);
  });

  it('gives units a shadow from the rest pose, and a flat one when no recipe exists', () => {
    const villager = createUnitParts(entity({ entityType: 'villager' }), '7:4', 0);
    expect(shadows(villager).length).toBeGreaterThan(2);
    const bands = shadowCasterBands(solids(villager), 0);
    expect(bands.at(-1)!.lift + bands.at(-1)!.height).toBeGreaterThan(0.5);
    const unknown = createUnitParts(entity({ entityType: 'mystery' as UnitType }), '7:5', 0);
    expect(unknown.every((part) => part.surface === 'shadow')).toBe(true);
    expect(unknown[0]!.key).toBe('7:5:unit-shadow');
    // No parts means no height: the fallback is a flat contact patch, so it
    // has no sweep and stays inside the footprint it was handed.
    const flat = unknown.flatMap(triangleCorners);
    expect(Math.max(...flat.map((corner) => corner.x))).toBeCloseTo(4.5 + 0.39, 6);
  });

  it('sweeps only the mass ABOVE the ground, so a carcass does not overshoot', () => {
    // `fellWildlifeParts` rotates the body about its root, so a felled
    // animal's parts dip below the ground plane — a boar's by 0.317. Sweeping
    // that depth added a quarter tile of shadow to every dead animal on the
    // map. Live entities whose lowest part dips under are the same rule: a
    // gold or stone mine's lowest facet sits below zero.
    const cases = [
      { kind: 'boar', alive: false }, { kind: 'deer', alive: false },
      { kind: 'sheep', alive: false }, { kind: 'wolf', alive: false },
      { kind: 'gold-mine', alive: true }, { kind: 'stone-mine', alive: true },
      { kind: 'fish', alive: true },
    ] as const;
    for (const { kind, alive } of cases) {
      const carcass = entity({
        kind: 'resource', layer: 'resource', entityType: kind,
        x: 5, y: 5, ...(alive ? {} : { wildlifeAlive: false }),
      });
      const parts = createResourceParts(carcass, `${kind}:0`, 0);
      const lowest = Math.min(...solids(parts).map((part) => (
        Math.min(...voxelPartWorldCorners(part).map((corner) => corner.y))
      )));
      expect(lowest, `${kind} should have mass below the ground plane`).toBeLessThan(0);
      const bands = shadowCasterBands(solids(parts), 0);
      expect(bands.every((band) => band.lift >= 0)).toBe(true);
      const reach = Math.max(...shadows(parts).flatMap(triangleCorners).map((c) => c.x));
      const widest = Math.max(...bands.map((band) => band.x1));
      const tallest = Math.max(...bands.map((band) => band.lift + band.height));
      // Only the above-ground height is swept.
      expect(reach).toBeLessThanOrEqual(widest + tallest * SHADOW_PROJECTION.x + 1e-9);
    }
  });

  it('casts nothing for memory entities', () => {
    expect(shadows(createBuildingParts(house({ isMemory: true }), '60:m', 0))).toEqual([]);
    expect(shadows(createResourceParts(tree(4, 6, { isMemory: true }), '8:m', 0))).toEqual([]);
    expect(shadows(createUnitParts(entity({ isMemory: true }), '7:m', 0))).toEqual([]);
    expect(castShadowParts(house({ isMemory: true }), 'x', 'shadow', 0, [])).toEqual([]);
  });
});
