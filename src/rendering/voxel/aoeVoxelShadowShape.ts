// The SHAPE of a cast ground shadow, derived from the caster's own geometry.
//
// A shadow used to be one box's swept footprint, so every caster — a tree, a
// villager, a Town Center — threw the same rectangle-derived hexagon. This
// module replaces that with the caster's silhouette: its parts are read as a
// vertical PROFILE (`shadowCasterBands`), and the union of the bands' swept
// footprints is tiled with triangles (`silhouetteTriangles`).
//
// Deriving the profile from the parts is the point. Nothing here names a
// recipe, a unit type or a building: change a recipe's boxes and the shadow
// changes with them on the next frame, with no shadow-side edit. That is the
// standing requirement — a shadow that has to be maintained alongside the
// shape it belongs to drifts from it the first time someone forgets.
//
// The tiling is a strip decomposition in SHADOW SPACE: the frame whose `w`
// axis runs along the sun's ground projection and whose `u` axis crosses it.
// In that frame a band's swept shadow is exactly `w in [LO_i(u), HI_i(u)]`
// with both bounds piecewise linear, so the union over bands is the lower
// envelope of the `LO_i` under the upper envelope of the `HI_i`. Slicing `u`
// at every envelope breakpoint leaves trapezoids, and two triangles tile each
// one. Triangles NEVER OVERLAP, which is what keeps the translucent shadow
// lane to one blend per pixel without needing a depth level per piece.
import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';

/** Bands per caster. Four resolves a trunk under a crown, walls under a roof
 *  and legs/torso/head, at four trapezoid strips' worth of instances. */
export const MAX_SHADOW_BANDS = 4;
/** Height slices the profile is read at before equal ones are merged. */
const PROFILE_SLICES = 12;
/** Footprint edges closer than this read as the same footprint, so a plain
 *  box collapses to ONE band and costs no more than the old single caster. */
const BAND_MERGE_TOLERANCE = 0.02;
/** A base taller than this is a body, not a step: its top is inside the mass
 *  above it rather than exposed to the sky. */
const PAD_MAX_HEIGHT = 0.45;
/** ...and it must be this much wider in plan than what stands on it, or there
 *  is no exposed rim for a shadow to land on. */
const PAD_MIN_AREA_RATIO = 1.15;

// `water` is deliberately absent: a water-surfaced part is a wake, a splash or
// a reflective sheet, and letting one into the profile would flatten a ship's
// shadow across the surface it floats on.
const CASTING_SURFACES: ReadonlySet<VoxelPart['surface']> = new Set(['matte', 'metal']);

/** One height band of a caster: the footprint its mass occupies between
 *  `lift` and `lift + height` above the ground plane. */
export interface ShadowCasterBand {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly lift: number;
  readonly height: number;
}

export interface ShadowPoint {
  readonly x: number;
  readonly z: number;
}

export type ShadowTriangle = readonly [ShadowPoint, ShadowPoint, ShadowPoint];

interface Aabb {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

/** World-space bounds of a part, however it is rotated. */
export function partBounds(part: VoxelPart): Aabb {
  const m = matrixForPart(part);
  let x0 = Number.POSITIVE_INFINITY; let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY; let y1 = Number.NEGATIVE_INFINITY;
  let z0 = Number.POSITIVE_INFINITY; let z1 = Number.NEGATIVE_INFINITY;
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

function sameFootprint(a: ShadowCasterBand, b: ShadowCasterBand): boolean {
  return Math.abs(a.x0 - b.x0) <= BAND_MERGE_TOLERANCE
    && Math.abs(a.x1 - b.x1) <= BAND_MERGE_TOLERANCE
    && Math.abs(a.z0 - b.z0) <= BAND_MERGE_TOLERANCE
    && Math.abs(a.z1 - b.z1) <= BAND_MERGE_TOLERANCE;
}

function mergeBands(a: ShadowCasterBand, b: ShadowCasterBand): ShadowCasterBand {
  const lift = Math.min(a.lift, b.lift);
  return {
    x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1),
    z0: Math.min(a.z0, b.z0), z1: Math.max(a.z1, b.z1),
    lift,
    height: Math.max(a.lift + a.height, b.lift + b.height) - lift,
  };
}

/** Extra swept volume a merge invents, as the tie-break for which adjacent
 *  pair to give up when a caster has more detail than the band budget. */
function mergeCost(a: ShadowCasterBand, b: ShadowCasterBand): number {
  const area = (band: ShadowCasterBand): number => (band.x1 - band.x0) * (band.z1 - band.z0);
  const merged = mergeBands(a, b);
  return area(merged) * merged.height - (area(a) * a.height + area(b) * b.height);
}

/**
 * The caster's vertical profile: the footprint its mass occupies at each
 * height, as at most `MAX_SHADOW_BANDS` bands from the ground up.
 *
 * Mass BELOW the ground plane is clipped away rather than swept: a felled
 * carcass is rotated about its root so its box dips under the ground (a
 * boar's by 0.317), and sweeping that depth added a quarter tile of shadow to
 * every dead animal on the map.
 */
export function shadowCasterBands(
  parts: readonly VoxelPart[],
  ground: number,
  maxBands = MAX_SHADOW_BANDS,
): ShadowCasterBand[] {
  const boxes = parts
    .filter((part) => CASTING_SURFACES.has(part.surface))
    .map(partBounds)
    .filter((box) => box.y1 > ground && box.x1 > box.x0 && box.z1 > box.z0);
  if (boxes.length === 0) return [];
  const top = Math.max(...boxes.map((box) => box.y1));
  if (!(top > ground)) return [];
  const sliceHeight = (top - ground) / PROFILE_SLICES;
  let bands: ShadowCasterBand[] = [];
  for (let index = 0; index < PROFILE_SLICES; index += 1) {
    const y0 = ground + sliceHeight * index;
    const y1 = index === PROFILE_SLICES - 1 ? top : y0 + sliceHeight;
    let x0 = Number.POSITIVE_INFINITY; let x1 = Number.NEGATIVE_INFINITY;
    let z0 = Number.POSITIVE_INFINITY; let z1 = Number.NEGATIVE_INFINITY;
    for (const box of boxes) {
      if (box.y1 <= y0 || Math.max(box.y0, ground) >= y1) continue;
      x0 = Math.min(x0, box.x0); x1 = Math.max(x1, box.x1);
      z0 = Math.min(z0, box.z0); z1 = Math.max(z1, box.z1);
    }
    if (!Number.isFinite(x0)) continue;
    const band: ShadowCasterBand = { x0, x1, z0, z1, lift: y0 - ground, height: y1 - y0 };
    const previous = bands.at(-1);
    if (
      previous
      && sameFootprint(previous, band)
      && Math.abs(previous.lift + previous.height - band.lift) < 1e-9
    ) {
      bands[bands.length - 1] = mergeBands(previous, band);
      continue;
    }
    bands.push(band);
  }
  while (bands.length > maxBands) {
    let best = 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let index = 0; index + 1 < bands.length; index += 1) {
      const cost = mergeCost(bands[index]!, bands[index + 1]!);
      if (cost < bestCost) { bestCost = cost; best = index; }
    }
    bands = [
      ...bands.slice(0, best),
      mergeBands(bands[best]!, bands[best + 1]!),
      ...bands.slice(best + 2),
    ];
  }
  return bands;
}

/**
 * The caster's own base, when it is a PAD a shadow can land on: the TOP FACE
 * of one flat part, wider in plan than the mass standing on it.
 *
 * Almost every building here sits on a plinth wider than its walls, and under
 * a sun 52 degrees up the whole building's shadow lands ON that plinth — so a
 * ground-only shadow leaves the largest objects in the game looking unplanted:
 * measured on the Town Center, 0.82 tiles of shadow reached past a 3.44 tile
 * plinth and the rest fell where nothing was drawing it.
 *
 * The pad is that PART, not the band it sits in, and that distinction is the
 * whole of this function. A band is a twelfth of the caster's total height, so
 * its top is wherever the slicing happened to fall — for the Town Center,
 * 0.273 against a plinth whose real top face is at 0.180. Returning the band
 * drew every pad layer floating ABOVE the surface it is meant to lie on, by
 * up to 0.147 world units (about 14 pixels at the closest zoom, measured on
 * the War Galley), on every pad caster in the game. Its FOOTPRINT is the
 * part's too, not the band's union: the band's union AABB spans gaps between
 * separate blocks, and clipping to it hung 23-32% of the Town Center's and
 * Market's pad layer over open air.
 *
 * The FLATNESS test is what separates a plinth from a heap. A gold mine's
 * lowest band is also its widest, but the rock that makes it wide keeps going
 * up through the band, so there is no surface up there to catch anything — a
 * patch drawn at that height would hang inside the rock.
 */
export function shadowReceiverPad(
  parts: readonly VoxelPart[],
  ground: number,
  bands: readonly ShadowCasterBand[],
): ShadowCasterBand | null {
  const base = bands[0];
  const next = bands[1];
  if (!base || !next) return null;
  if (base.height > PAD_MAX_HEIGHT) return null;
  const bandTop = ground + base.lift + base.height;
  let widest: Aabb | null = null;
  for (const part of parts) {
    if (!CASTING_SURFACES.has(part.surface)) continue;
    const box = partBounds(part);
    if (box.y1 <= ground + base.lift || Math.max(box.y0, ground) >= bandTop) continue;
    const size = (box.x1 - box.x0) * (box.z1 - box.z0);
    if (!widest || size > (widest.x1 - widest.x0) * (widest.z1 - widest.z0)) widest = box;
  }
  // Nothing flat down there, or the widest thing keeps going up through the
  // band: no exposed top face, so nothing to catch a shadow.
  if (!widest || widest.y1 > bandTop + 1e-6) return null;
  const top = widest.y1 - ground;
  if (!(top > 0)) return null;
  const area = (box: { x0: number; x1: number; z0: number; z1: number }): number => (
    (box.x1 - box.x0) * (box.z1 - box.z0)
  );
  // Wider than what stands on it, or there is no exposed rim to draw on.
  if (area(widest) < area(next) * PAD_MIN_AREA_RATIO) return null;
  return { x0: widest.x0, x1: widest.x1, z0: widest.z0, z1: widest.z1, lift: 0, height: top };
}
