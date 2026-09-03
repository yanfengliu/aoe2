// Sun-cast ground shadows for buildings, resources and units (v0.3.193).
//
// The voxel runtime never enables shadow maps, so a shadow here is geometry
// the recipe emits on the translucent `shadow` surface. Each entity casts
// from ONE box — its mass, not its accents — and that box's shadow under
// parallel sunlight is the footprint swept along the sun's ground
// projection: a hexagon, drawn as an exact partition into the footprint
// rectangle plus one parallelogram per leading edge. Pieces of one entity
// never overlap, so an entity never darkens its own shadow twice.
//
// Shadows of DIFFERENT entities do overlap (a forest edge, a crowd at a
// mine). Two slabs at the SAME height then z-fight: the pair tears into
// stripes as the rasteriser picks a winner per pixel, which is the artifact
// this scheme exists to prevent — forcing SHADOW_LEVEL_STEP to 0 and
// re-capturing the boot view brings back shredded shadows, not darker ones.
// Instances draw in array order with depth writes on, so the lane is drawn
// top-down: no two casters whose shadows overlap are ever at the same height,
// and `compareShadowDrawOrder` puts the higher slabs first. A lower slab then
// fails the depth test where a higher one already drew — exactly one layer per
// pixel. A cluster of more than nine mutually overlapping casters is lifted
// ABOVE the nine-level band rather than dropped back onto a taken height: a
// few pixels of float on the densest crowds instead of a torn shadow.
//
// The height starts from the caster's anchor CELL (`shadowLevel`), which is a
// good colouring but only a SEED: same-level casters are a multiple of three
// cells apart, beyond a tree's or a unit's reach but not a Town Center's, and
// two casters in one cell seed identically — units share cells routinely, and
// a 12,000-tick AI-vs-AI run of the boot map reached four villagers on one
// tile and 13 same-height overlapping slab pairs in one frame. `resolveShadowLevels` is the repair
// for exactly that: a whole-lane pass, run while batching, that steps such a
// caster up until nothing it overlaps holds its height.
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

/** Thickness of a shadow slab; its bottom face rests on the ground. */
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
/** A part whose footprint is under this fraction of the entity's largest
 *  part's does not cast: flag poles, beams, spear shafts and a Town Center's
 *  tower would otherwise stretch the whole footprint's shadow. */
export const CASTER_FOOTPRINT_FRACTION = 0.25;

// `water` is deliberately absent: a water-surfaced part is a wake, a splash or
// a reflective sheet, and letting one join the caster box would flatten a
// ship's shadow across the surface it floats on. No entity recipe emits one
// today — only the terrain water detail, which never reaches a caster box.
const CASTING_SURFACES: ReadonlySet<VoxelPart['surface']> = new Set(['matte', 'metal']);

export interface CasterBox {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

/** A ground footprint to cast from when a recipe has no solid parts. */
export interface FallbackFootprint {
  readonly centerX: number;
  readonly centerZ: number;
  readonly width: number;
  readonly depth: number;
}

function partAabb(part: VoxelPart): CasterBox {
  const m = matrixForPart(part);
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  for (const lx of [-0.5, 0.5]) {
    for (const ly of [-0.5, 0.5]) {
      for (const lz of [-0.5, 0.5]) {
        const x = m[0]! * lx + m[4]! * ly + m[8]! * lz + m[12]!;
        const y = m[1]! * lx + m[5]! * ly + m[9]! * lz + m[13]!;
        const z = m[2]! * lx + m[6]! * ly + m[10]! * lz + m[14]!;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
    }
  }
  return { x0, x1, y0, y1, z0, z1 };
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

/** A slab's footprint on the ground. Its horizontal axes may be sheared, so
 *  this is the axis-aligned hull of the four corners rather than width/depth. */
function groundBox(part: VoxelPart): GroundBox {
  const m = matrixForPart(part);
  const xs: number[] = [];
  const zs: number[] = [];
  for (const lx of [-0.5, 0.5]) {
    for (const lz of [-0.5, 0.5]) {
      xs.push(m[0]! * lx + m[8]! * lz + m[12]!);
      zs.push(m[2]! * lx + m[10]! * lz + m[14]!);
    }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) };
}

function overlaps(a: GroundBox, b: GroundBox): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}

/** The one box an entity casts from, or null when it has no solid part. */
export function shadowCasterBox(parts: readonly VoxelPart[]): CasterBox | null {
  const boxes = parts
    .filter((part) => CASTING_SURFACES.has(part.surface))
    .map(partAabb);
  if (boxes.length === 0) return null;
  const areas = boxes.map((box) => (box.x1 - box.x0) * (box.z1 - box.z0));
  const threshold = Math.max(...areas) * CASTER_FOOTPRINT_FRACTION;
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY;
  let z1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  // The lowest solid part sets the base even when it is thin (a trunk), so
  // a crown's shadow still begins under the tree rather than floating off.
  const y0 = Math.min(...boxes.map((box) => box.y0));
  boxes.forEach((box, index) => {
    if (areas[index]! < threshold) return;
    x0 = Math.min(x0, box.x0); x1 = Math.max(x1, box.x1);
    z0 = Math.min(z0, box.z0); z1 = Math.max(z1, box.z1);
    y1 = Math.max(y1, box.y1);
  });
  return { x0, x1, z0, z1, y0, y1: Math.max(y0, y1) };
}

/**
 * Lift any caster whose emitted level a caster it overlaps already holds, and
 * return the lane in draw order (highest first).
 *
 * The cell rule above does the colouring; this pass only fixes what a rule
 * keyed on the CELL cannot see — two casters in the SAME cell, which seed
 * identically and would draw coplanar slabs that z-fight into stripes. Units
 * share cells routinely: an AI-vs-AI run on the boot map put four villagers
 * on one tile at tick 4,500 and produced 16 same-level overlapping slab
 * pairs. Such a caster steps up by whole levels until it is clear. Every step
 * is upward, so the pass never has to know which level a slab was emitted on
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
 * Slabs are grouped by the part key's owner prefix — `makePart` builds every
 * key as `<identity>:<suffix>` with the suffix as the last segment — because
 * one caster's own slabs never overlap and must stay coplanar.
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
    // sink the slab under the terrain it rests on. A capped search would have
    // to fall back on a height that is taken BY CONSTRUCTION — the cap was
    // nine, and an independent review measured 34 coincident overlapping slab
    // pairs across 7 casters on a 6x6 woodline with 12 villagers gathering in
    // it, which is an ordinary scene.
    let height = group.parts[0]!.centerY;
    while (!clearOf(height, taken)) height += SHADOW_LEVEL_STEP;
    placed.push({ box: group.box, height });
    for (const part of group.parts) {
      lifted.push(height === part.centerY ? part : { ...part, centerY: height });
    }
  }
  return lifted.sort(compareShadowDrawOrder);
}

/** Draw order for the shadow lane: higher slabs first, then by key. */
export function compareShadowDrawOrder(a: VoxelPart, b: VoxelPart): number {
  return b.centerY - a.centerY || compareParts(a, b);
}

/**
 * The shadow slabs one caster box throws on the ground plane at `ground`.
 *
 * With `v` the projection per unit of height and `H` the box height, the
 * shadow is `R + [0, H] * v` where `R` is the footprint (lifted by `y0 * v`
 * when the box floats). That region is exactly the footprint plus the sweep
 * of its two leading edges — the edges whose outward normal points along
 * `v` — so those three pieces tile it with no overlap.
 */
export function casterShadowParts(
  entity: ProjectedEntityView,
  identity: string,
  suffix: string,
  ground: number,
  box: CasterBox,
  projection: ShadowProjection = SHADOW_PROJECTION,
): VoxelPart[] {
  // Mass BELOW the ground plane casts nothing: a felled carcass is rotated
  // about its root, so its box dips under the ground (a boar's by 0.317), and
  // sweeping that depth added a quarter tile of shadow to every dead animal.
  const casterBottom = Math.max(box.y0, ground);
  const lift = casterBottom - ground;
  const height = Math.max(0, box.y1 - casterBottom);
  const x0 = box.x0 + projection.x * lift;
  const z0 = box.z0 + projection.z * lift;
  const width = box.x1 - box.x0;
  const depth = box.z1 - box.z0;
  if (!(width > 0) || !(depth > 0)) return [];
  const sweepX = projection.x * height;
  const sweepZ = projection.z * height;
  const sweep = Math.hypot(sweepX, sweepZ);
  // The level comes from the entity's own cell, not the caster's corner: a
  // crown that overhangs its cell by a hair must not land two neighbouring
  // trees on one level. `resolveShadowLevels` then lifts whatever the cell
  // rule could not separate.
  const centerY = ground + SHADOW_SLAB_THICKNESS / 2
    + shadowLevel(entity.x, entity.y) * SHADOW_LEVEL_STEP;
  const slab = (
    pieceSuffix: string,
    centerX: number,
    centerZ: number,
    axisX: { readonly x: number; readonly z: number },
    axisZ: { readonly x: number; readonly z: number },
  ): VoxelPart => ({
    ...makePart(
      entity,
      identity,
      pieceSuffix,
      'shadow',
      VOXEL_COLORS.shadow,
      centerX,
      centerY,
      centerZ,
      Math.hypot(axisX.x, axisX.z),
      SHADOW_SLAB_THICKNESS,
      Math.hypot(axisZ.x, axisZ.z),
    ),
    groundAxes: { x: axisX, z: axisZ },
  });
  // The footprint slab keeps the bare suffix: it is the successor of the old
  // contact slab, and the part every "root stays planted" proof looks up.
  const parts = [slab(
    suffix,
    x0 + width / 2,
    z0 + depth / 2,
    { x: width, z: 0 },
    { x: 0, z: depth },
  )];
  if (sweep <= 1e-6) return parts;
  if (Math.abs(sweepX) > 1e-9) {
    // The x-facing leading edge, swept along the projection.
    const edgeX = sweepX > 0 ? x0 + width : x0;
    parts.push(slab(
      `${suffix}-sweep-x`,
      edgeX + sweepX / 2,
      z0 + depth / 2 + sweepZ / 2,
      { x: sweepX, z: sweepZ },
      { x: 0, z: depth },
    ));
  }
  if (Math.abs(sweepZ) > 1e-9) {
    // The z-facing leading edge, swept along the projection.
    const edgeZ = sweepZ > 0 ? z0 + depth : z0;
    parts.push(slab(
      `${suffix}-sweep-z`,
      x0 + width / 2 + sweepX / 2,
      edgeZ + sweepZ / 2,
      { x: width, z: 0 },
      { x: sweepX, z: sweepZ },
    ));
  }
  return parts;
}

/**
 * The cast shadow of an entity, from the mass of its solid `parts`.
 *
 * Memory (fogged) entities cast nothing, as their contact slab never did.
 * A recipe with no solid part — the unit-layer fallback for an entity type
 * no recipe knows — keeps a flat slab on `fallback` so it still touches the
 * ground. Only the UNIT layer passes one, deliberately: `buildingRole` and
 * `createResourceParts` are exhaustive over their type unions, so a building
 * or resource with no solid part means a projection that broke its own type
 * contract, while the unit layer is contracted to accept exactly that.
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
  const box = shadowCasterBox(parts) ?? (fallback ? {
    x0: fallback.centerX - fallback.width / 2,
    x1: fallback.centerX + fallback.width / 2,
    z0: fallback.centerZ - fallback.depth / 2,
    z1: fallback.centerZ + fallback.depth / 2,
    y0: ground,
    y1: ground,
  } : null);
  if (!box) return [];
  return casterShadowParts(entity, identity, suffix, ground, box);
}
