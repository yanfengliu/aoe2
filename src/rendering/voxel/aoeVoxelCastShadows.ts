// Sun-cast ground shadows for buildings, resources and units.
//
// The voxel runtime never enables shadow maps, so a shadow here is geometry
// the recipe emits on the translucent `shadow` surface. Its SHAPE comes from
// `aoeVoxelShadowShape`, which reads the caster's own parts as a vertical
// profile and tiles the silhouette that profile throws with triangles: a tree
// narrows to its trunk near the ground and widens to its crown further along
// the sun ray, and a Town Center's tower streaks past its roof. Nothing here
// knows what it is casting, so a recipe change moves the shadow with it.
// (Until v0.3.193 the caster was ONE box and every shadow was the same
// rectangle-derived hexagon, which is what that reads as on screen.)
//
// This module owns the other half: WHERE the pieces sit in depth.
//
// One caster's triangles never overlap each other — that is the silhouette
// tiling's contract — so they stay coplanar and an entity never darkens its
// own shadow twice. Shadows of DIFFERENT entities do overlap (a forest edge,
// a crowd at a mine). Two pieces at the SAME height then z-fight: the pair
// tears into stripes as the rasteriser picks a winner per pixel, which is the
// artifact this scheme exists to prevent — forcing SHADOW_LEVEL_STEP to 0 and
// re-capturing the boot view brings back shredded shadows, not darker ones.
// Instances draw in array order with depth writes on, so the lane is drawn
// top-down: no two casters whose shadows overlap are ever at the same height,
// and `compareShadowDrawOrder` puts the higher pieces first. A lower piece
// then fails the depth test where a higher one already drew — exactly one
// layer per pixel. A cluster of more than nine mutually overlapping casters is
// lifted ABOVE the nine-level band rather than dropped back onto a taken
// height: a few pixels of float on the densest crowds instead of a torn
// shadow.
//
// The height starts from the caster's anchor CELL (`shadowLevel`), which is a
// good colouring but only a SEED: same-level casters are a multiple of three
// cells apart, beyond a tree's or a unit's reach but not a Town Center's, and
// two casters in one cell seed identically — units share cells routinely, and
// a 12,000-tick AI-vs-AI run of the boot map reached four villagers on one
// tile and 13 same-height overlapping slab pairs in one frame.
// `resolveShadowLevels` is the repair for exactly that: a whole-lane pass, run
// while batching, that steps such a caster up until nothing it overlaps holds
// its height.
//
// The depth separation assumes a 24-bit depth buffer (see SHADOW_LEVEL_STEP).
// Nothing pins the context's depth size, so on a device that hands back 16
// bits one quantum is 0.061 world units, the whole scheme is below the noise
// floor, and overlapping shadows tear there. Unmeasured off this machine.
import type { ProjectedEntityView } from '../../game/simulation/types';
import { SHADOW_PROJECTION, type ShadowProjection } from './aoeVoxelDaylight';
import {
  compareParts,
  makePart,
  matrixForPart,
  VOXEL_COLORS,
  type VoxelPart,
} from './aoeVoxelRecipeTypes';
import {
  shadowCasterBands,
  shadowReceiverPad,
  type ShadowCasterBand,
  type ShadowTriangle,
} from './aoeVoxelShadowShape';
import { MAX_PAD_STRIPS, silhouetteTriangles } from './aoeVoxelShadowTiling';

/** Thickness of a shadow piece; its bottom face rests on the ground. */
export const SHADOW_SLAB_THICKNESS = 0.036;
/** Height between draw levels. The orthographic camera spans 4000 world
 *  units of depth on a 24-bit buffer (about 4200 steps per unit) and a
 *  vertical step only moves depth by half of itself at the 30-degree pitch,
 *  so this is roughly four depth steps: the smallest separation the depth
 *  test can be trusted to resolve. */
export const SHADOW_LEVEL_STEP = 0.002;
/** Anchor-cell classes per axis; levels = classes squared. */
export const SHADOW_LEVEL_CLASSES = 3;
export const SHADOW_LEVELS = SHADOW_LEVEL_CLASSES * SHADOW_LEVEL_CLASSES;

/** A ground footprint to cast from when a recipe has no solid parts. */
export interface FallbackFootprint {
  readonly centerX: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
}

/** 0..8 from the caster's anchor CELL — a SEED, not a guarantee. Two casters
 *  that share a level are a multiple of three cells apart on each axis, which
 *  is beyond the reach of a tree's or a unit's shadow but NOT of a large
 *  building's: a Town Center's ground span is 4.53 tiles, so one at (10,10)
 *  and a House at (13,13) share level 4 and overlap. `resolveShadowLevels`
 *  repairs those, and every same-cell pair. The seed earns its place by being
 *  a good colouring where the graph is dense — a woodline is a nine-clique of
 *  overlapping tree shadows (a tree's reaches 2.4 tiles, so it touches every
 *  tree within two cells) and the cell rule colours it with zero repairs,
 *  where greedy colouring from level 0 exhausted all nine levels. */
export function shadowLevel(anchorX: number, anchorZ: number): number {
  const classes = SHADOW_LEVEL_CLASSES;
  const wrap = (value: number): number => (
    ((Math.floor(value) % classes) + classes) % classes
  );
  return wrap(anchorX) + classes * wrap(anchorZ);
}

interface GroundBox {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A piece's footprint on the ground: the hull of the wedge's THREE ground
 *  corners. Using the enclosing parallelogram's four instead inflates every
 *  caster's box by the corner the triangle does not have, which lifts casters
 *  that never overlapped — a 6x6 woodline measured 0.084 world units of lift
 *  that way against 0.038 from the triangles, and lift is a shadow floating
 *  off its caster on screen. */
function groundBox(part: VoxelPart): GroundBox {
  const m = matrixForPart(part);
  const xs: number[] = [];
  const zs: number[] = [];
  for (const [lx, lz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5]] as const) {
    xs.push(m[0]! * lx + m[8]! * lz + m[12]!);
    zs.push(m[2]! * lx + m[10]! * lz + m[14]!);
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

function overlaps(a: GroundBox, b: GroundBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}

/**
 * Lift any caster whose emitted level a caster it overlaps already holds, and
 * return the lane in draw order (highest first).
 *
 * The cell rule above does the colouring; this pass only fixes what a rule
 * keyed on the CELL cannot see — two casters in the SAME cell, which seed
 * identically and would draw coplanar pieces that z-fight into stripes. Units
 * share cells routinely: an AI-vs-AI run on the boot map put four villagers
 * on one tile at tick 4,500 and produced 16 same-level overlapping slab
 * pairs. Such a caster steps up by whole levels until it is clear. Every step
 * is upward, so the pass never has to know which level a piece was emitted on
 * and never sinks one under the terrain it rests on.
 *
 * The search is UNBOUNDED and that is deliberate. It terminates because
 * `taken` holds at most one height per placed caster and each step raises the
 * height past one of them. A capped search has to fall back on a height that
 * is taken by construction — the search only begins when the emitted height
 * is — and a nine-step cap did exactly that: an independent review measured
 * 38 coincident overlapping slab pairs on a 6x6 woodline with 12 villagers
 * gathering in it, which is an ordinary scene. The price of no cap is that a
 * clique of K mutually overlapping casters needs K heights and the tallest
 * rises above the nine-level band: 0.058 world units on that woodline, 0.072
 * on a 200-population blob packed at a third of a tile, which is three to
 * five pixels of screen offset at the closest camera zoom. Nothing bounds it
 * but how tightly the simulation can pack casters, and a shadow floating a
 * few pixels is a far smaller defect than a torn one.
 *
 * Pieces are grouped by the part key's owner prefix — `makePart` builds every
 * key as `<identity>:<suffix>` with the suffix as the last segment — because
 * one caster's own pieces never overlap and must stay coplanar.
 */
export function resolveShadowLevels(parts: readonly VoxelPart[]): VoxelPart[] {
  if (parts.length === 0) return [];
  const groups = new Map<string, { parts: VoxelPart[]; box: GroundBox }>();
  for (const part of parts) {
    const owner = part.key.slice(0, part.key.lastIndexOf(':'));
    const box = groundBox(part);
    const group = groups.get(owner);
    if (!group) {
      groups.set(owner, { parts: [part], box });
      continue;
    }
    group.parts.push(part);
    group.box = {
      x0: Math.min(group.box.x0, box.x0), x1: Math.max(group.box.x1, box.x1),
      z0: Math.min(group.box.z0, box.z0), z1: Math.max(group.box.z1, box.z1),
    };
  }
  // Two heights count as separated only when a whole level lies between them.
  // Tested as a DISTANCE rather than by bucketing the height, because bucket
  // equality is height equality only while every caster shares one ground
  // plane; the day terrain elevation lands, two heights 0.0005 apart would
  // fall in different buckets and be declared separated.
  const clearOf = (height: number, taken: readonly number[]): boolean => taken.every(
    (other) => Math.abs(height - other) >= SHADOW_LEVEL_STEP - 1e-9,
  );
  const placed: { box: GroundBox; height: number }[] = [];
  const lifted: VoxelPart[] = [];
  for (const owner of [...groups.keys()].sort()) {
    const group = groups.get(owner)!;
    const taken: number[] = [];
    for (const other of placed) {
      if (overlaps(group.box, other.box)) taken.push(other.height);
    }
    // Step UP until nothing this caster overlaps holds the height. The search
    // is unbounded and terminates: only finitely many casters are placed, so
    // some height above all of them is free. It never steps DOWN, which would
    // sink the piece under the terrain it rests on. A capped search would have
    // to fall back on a height that is taken BY CONSTRUCTION — the cap was
    // nine, and an independent review measured 34 coincident overlapping slab
    // pairs across 7 casters on a 6x6 woodline with 12 villagers gathering in
    // it, which is an ordinary scene.
    const emitted = Math.min(...group.parts.map((part) => part.centerY));
    let height = emitted;
    while (!clearOf(height, taken)) height += SHADOW_LEVEL_STEP;
    placed.push({ box: group.box, height });
    // Shift the caster's pieces TOGETHER. A caster that stands on its own pad
    // draws a second layer at the pad's height, and flattening the two onto
    // one height would drop that layer under the pad it is meant to fall on.
    // Only the group's own base height enters the collision search, which is
    // enough: a raised layer is clipped to its caster's pad, and the pad is
    // opaque, so nothing else is ever visible in the same pixels.
    const shift = height - emitted;
    for (const part of group.parts) {
      lifted.push(shift === 0 ? part : { ...part, centerY: part.centerY + shift });
    }
  }
  return lifted.sort(compareShadowDrawOrder);
}

/** Draw order for the shadow lane: higher pieces first, then by key. */
export function compareShadowDrawOrder(a: VoxelPart, b: VoxelPart): number {
  return b.centerY - a.centerY || compareParts(a, b);
}

/**
 * One silhouette triangle as a `shadow` part.
 *
 * The wedge geometry's local footprint is the triangle (0,0) (1,0) (0,1), so
 * setting the instance's ground axes to `Q-P` and `R-P` and its centre to
 * `(Q+R)/2` places the corners exactly on `P`, `Q` and `R`.
 */
export function shadowTrianglePart(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  centerY: number,
  triangle: ShadowTriangle,
): VoxelPart | null {
  const [p, q, r] = triangle;
  const axisX = { x: q.x - p.x, z: q.z - p.z };
  const axisZ = { x: r.x - p.x, z: r.z - p.z };
  const width = Math.hypot(axisX.x, axisX.z);
  const depth = Math.hypot(axisZ.x, axisZ.z);
  // A zero-length edge is a degenerate triangle with no area to shade, and
  // `makePart` refuses a non-positive extent rather than emitting one.
  if (!(width > 1e-9) || !(depth > 1e-9)) return null;
  return {
    ...makePart(
      entity,
      identity,
      suffix,
      'shadow',
      VOXEL_COLORS.shadow,
      (q.x + r.x) / 2,
      centerY,
      (q.z + r.z) / 2,
      width,
      SHADOW_SLAB_THICKNESS,
      depth,
    ),
    groundAxes: { x: axisX, z: axisZ },
  };
}

/**
 * The silhouette pieces a set of bands throws, at the caster's own level.
 *
 * Two layers where the caster stands on its own pad: the ground layer, and
 * the part of the shadow that lands on the pad's top face, drawn at the pad's
 * height and clipped to the pad. The ground layer under the pad is opaque-
 * occluded by the pad itself, so the two never blend one pixel twice.
 */
export function casterShadowParts(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  ground: number,
  bands: readonly ShadowCasterBand[],
  pad: ShadowCasterBand | null = null,
  projection: ShadowProjection = SHADOW_PROJECTION,
): VoxelPart[] {
  // The level comes from the entity's own cell, not the silhouette's corner:
  // a crown that overhangs its cell by a hair must not land two neighbouring
  // trees on one level. `resolveShadowLevels` then lifts whatever the cell
  // rule could not separate.
  const centerY = ground + SHADOW_SLAB_THICKNESS / 2
    + shadowLevel(entity.x, entity.y) * SHADOW_LEVEL_STEP;
  const parts: VoxelPart[] = [];
  const push = (triangle: ShadowTriangle, height: number): void => {
    // The first piece keeps the bare suffix: it is the successor of the old
    // contact slab, and the part every "root stays planted" proof looks up.
    const pieceSuffix = parts.length === 0 ? suffix : `${suffix}-${String(parts.length)}`;
    const part = shadowTrianglePart(entity, identity, pieceSuffix, height, triangle);
    if (part) parts.push(part);
  };
  for (const triangle of silhouetteTriangles(bands, projection)) push(triangle, centerY);
  if (!pad) return parts;
  const top = pad.lift + pad.height;
  const above = bands.slice(1).map((band) => ({ ...band, lift: Math.max(0, band.lift - top) }));
  if (above.length === 0) return parts;
  for (const triangle of silhouetteTriangles(above, projection, {
    clip: pad,
    maxStrips: MAX_PAD_STRIPS,
  })) {
    push(triangle, centerY + top);
  }
  return parts;
}

/**
 * The cast shadow of an entity, from the shape of its solid `parts`.
 *
 * Memory (fogged) entities cast nothing, as their contact slab never did.
 * A recipe with no solid part — the unit-layer fallback for an entity type
 * no recipe knows — keeps a flat footprint on `fallback` so it still touches
 * the ground. Only the UNIT layer passes one, deliberately: `buildingRole`
 * and `createResourceParts` are exhaustive over their type unions, so a
 * building or resource with no solid part means a projection that broke its
 * own type contract, while the unit layer is contracted to accept exactly
 * that.
 */
export function castShadowParts(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  ground: number,
  parts: readonly VoxelPart[],
  fallback?: FallbackFootprint,
): VoxelPart[] {
  if (entity.isMemory) return [];
  let bands = shadowCasterBands(parts, ground);
  if (bands.length === 0) {
    if (!fallback) return [];
    bands = [{
      x0: fallback.centerX - fallback.width / 2,
      x1: fallback.centerX + fallback.width / 2,
      z0: fallback.centerZ - fallback.depth / 2,
      z1: fallback.centerZ + fallback.depth / 2,
      lift: 0,
      height: 0,
    }];
  }
  return casterShadowParts(
    entity, identity, suffix, ground, bands, shadowReceiverPad(parts, ground, bands),
  );
}
