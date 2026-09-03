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
import type { ShadowProjection } from './aoeVoxelDaylight';
import { matrixForPart, type VoxelPart } from './aoeVoxelRecipeTypes';

/** Bands per caster. Four resolves a trunk under a crown, walls under a roof
 *  and legs/torso/head, at four trapezoid strips' worth of instances. */
export const MAX_SHADOW_BANDS = 4;
/** Height slices the profile is read at before equal ones are merged. */
const PROFILE_SLICES = 12;
/** Footprint edges closer than this read as the same footprint, so a plain
 *  box collapses to ONE band and costs no more than the old single caster. */
const BAND_MERGE_TOLERANCE = 0.02;
/** How far the tiling may stray from the exact silhouette, in world units.
 *  About 3px at the closest camera zoom: below that, extra strips buy
 *  instances rather than shape. */
const SILHOUETTE_TOLERANCE = 0.03;
/** A base taller than this is a body, not a step: its top is inside the mass
 *  above it rather than exposed to the sky. */
const PAD_MAX_HEIGHT = 0.45;
/** ...and it must be this much wider in plan than what stands on it, or there
 *  is no exposed rim for a shadow to land on. */
const PAD_MIN_AREA_RATIO = 1.15;
/** Trapezoid strips per caster, and so at most twice this many instances.
 *  The envelope's breakpoint count is not bounded by the band count — four
 *  bands can cross each other 56 ways — so the tolerance is RELAXED until the
 *  tiling fits instead of trusting that it will. Ten strips is 20 triangles
 *  against the 3 slabs a single caster box drew; the whole shadow lane is
 *  roughly a quarter of the frame's instances at that rate. */
export const MAX_SHADOW_STRIPS = 10;
/** Strips for the second layer — the part of a caster's shadow that lands on
 *  its own pad. That patch is small and mostly hidden by the mass throwing
 *  it, so it gets a coarser budget than the ground layer. */
export const MAX_PAD_STRIPS = 4;
/** Shadow instances one caster can ever emit: two layers, two triangles per
 *  strip. Recipes are bounded against this so a silhouette cannot quietly
 *  become the frame's instance budget. */
export const MAX_SHADOW_PIECES = (MAX_SHADOW_STRIPS + MAX_PAD_STRIPS) * 2;

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
 * The caster's own base, when it is a PAD a shadow can land on: a flat slab,
 * wider in plan than the mass standing on it, whose top is therefore exposed
 * to the sky.
 *
 * Almost every building here sits on a plinth wider than its walls, and under
 * a sun 52 degrees up the whole building's shadow lands ON that plinth — so a
 * ground-only shadow leaves the largest objects in the game looking unplanted:
 * measured on the Town Center, 0.82 tiles of shadow reached past a 3.44 tile
 * plinth and the rest fell where nothing was drawing it.
 *
 * The FLATNESS test is what separates a plinth from a heap. A gold mine's
 * lowest band is also its widest, but the rock that makes it wide keeps going
 * up through the band, so there is no surface up there to catch anything — a
 * patch drawn at that height would hang inside the rock. The test is
 * therefore on the widest contributing part, not on the band: its top must be
 * the pad's top.
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
  const area = (band: ShadowCasterBand): number => (band.x1 - band.x0) * (band.z1 - band.z0);
  if (area(base) < area(next) * PAD_MIN_AREA_RATIO) return null;
  const top = ground + base.lift + base.height;
  let widest: Aabb | null = null;
  for (const part of parts) {
    if (!CASTING_SURFACES.has(part.surface)) continue;
    const box = partBounds(part);
    if (box.y1 <= ground + base.lift || Math.max(box.y0, ground) >= top) continue;
    const size = (box.x1 - box.x0) * (box.z1 - box.z0);
    if (!widest || size > (widest.x1 - widest.x0) * (widest.z1 - widest.z0)) widest = box;
  }
  if (!widest || widest.y1 > top + 1e-6) return null;
  return base;
}

interface Chain {
  /** Breakpoint `u` values, ascending. */
  readonly us: readonly number[];
  /** `w` at each breakpoint. */
  readonly ws: readonly number[];
}

interface BandProfile {
  readonly uMin: number;
  readonly uMax: number;
  readonly low: Chain;
  readonly high: Chain;
}

/** Lower (`sign` -1) or upper (`sign` +1) hull of points, as a function of
 *  `u`. A vertical run keeps only its extreme point: the chain is a function
 *  of `u`, and the vertical edge between them is the region's own end cap. */
function hullChain(points: readonly ShadowPoint[], sign: number): Chain {
  const sorted = [...points].sort((a, b) => a.x - b.x || (a.z - b.z) * sign);
  const us: number[] = [];
  const ws: number[] = [];
  for (const point of sorted) {
    if (us.length > 0 && Math.abs(us[us.length - 1]! - point.x) < 1e-12) {
      if ((point.z - ws[ws.length - 1]!) * sign <= 0) continue;
      us.pop(); ws.pop();
    }
    while (us.length >= 2) {
      // A lower chain (`sign` -1) keeps left turns and a upper chain keeps
      // right turns; anything else is a vertex the chain passes over.
      const cross = (us[us.length - 1]! - us[us.length - 2]!) * (point.z - ws[ws.length - 2]!)
        - (ws[ws.length - 1]! - ws[ws.length - 2]!) * (point.x - us[us.length - 2]!);
      if (cross * sign < -1e-12) break;
      us.pop(); ws.pop();
    }
    us.push(point.x); ws.push(point.z);
  }
  return { us, ws };
}

function evaluateChain(chain: Chain, u: number): number {
  const { us, ws } = chain;
  if (us.length === 1) return ws[0]!;
  for (let index = 0; index + 1 < us.length; index += 1) {
    const u0 = us[index]!;
    const u1 = us[index + 1]!;
    if (u <= u1 || index + 2 === us.length) {
      const span = u1 - u0;
      if (Math.abs(span) < 1e-12) return ws[index]!;
      return ws[index]! + ((ws[index + 1]! - ws[index]!) * (u - u0)) / span;
    }
  }
  return ws.at(-1)!;
}

interface Strip {
  readonly u0: number;
  readonly u1: number;
  readonly lo0: number;
  readonly lo1: number;
  readonly hi0: number;
  readonly hi1: number;
}

/** Where two chains swap which one is lower, so the envelope keeps its corner
 *  instead of the strip cutting across it. */
function segmentCrossings(a: Chain, b: Chain, into: number[]): void {
  for (let i = 0; i + 1 < a.us.length; i += 1) {
    for (let j = 0; j + 1 < b.us.length; j += 1) {
      const lo = Math.max(a.us[i]!, b.us[j]!);
      const hi = Math.min(a.us[i + 1]!, b.us[j + 1]!);
      if (!(hi > lo)) continue;
      const gapLo = evaluateChain(a, lo) - evaluateChain(b, lo);
      const gapHi = evaluateChain(a, hi) - evaluateChain(b, hi);
      const slope = gapHi - gapLo;
      if (Math.abs(slope) < 1e-12) continue;
      const t = -gapLo / slope;
      if (t > 1e-9 && t < 1 - 1e-9) into.push(lo + t * (hi - lo));
    }
  }
}

/**
 * Triangles tiling the union of the bands' swept shadows on the ground plane.
 *
 * The triangles never overlap each other, so the translucent shadow material
 * blends each covered pixel exactly once without a depth level per piece.
 */
export interface SilhouetteOptions {
  /** How far the tiling may stray from the exact silhouette, in world units. */
  readonly tolerance?: number;
  /** Keep only the part of the silhouette over this footprint — the caster's
   *  own pad, when the shadow is being drawn onto it rather than the ground. */
  readonly clip?: ShadowCasterBand;
  /** Strip budget; the tolerance is relaxed until the tiling fits it. */
  readonly maxStrips?: number;
}

export function silhouetteTriangles(
  bands: readonly ShadowCasterBand[],
  projection: ShadowProjection,
  options: SilhouetteOptions = {},
): ShadowTriangle[] {
  const tolerance = options.tolerance ?? SILHOUETTE_TOLERANCE;
  const clip = options.clip;
  const maxStrips = options.maxStrips ?? MAX_SHADOW_STRIPS;
  if (bands.length === 0) return [];
  const reach = Math.hypot(projection.x, projection.z);
  const wx = reach > 1e-9 ? projection.x / reach : 1;
  const wz = reach > 1e-9 ? projection.z / reach : 0;
  const ux = -wz;
  const uz = wx;
  const toWorld = (u: number, w: number): ShadowPoint => ({
    x: u * ux + w * wx,
    z: u * uz + w * wz,
  });
  const profileOf = (band: ShadowCasterBand): BandProfile => {
    const corners: ShadowPoint[] = [];
    for (const x of [band.x0, band.x1]) {
      for (const z of [band.z0, band.z1]) {
        corners.push({ x: x * ux + z * uz, z: x * wx + z * wz });
      }
    }
    const low = hullChain(corners, -1);
    const high = hullChain(corners, 1);
    const baseShift = band.lift * reach;
    const topShift = (band.lift + band.height) * reach;
    return {
      uMin: Math.min(...corners.map((corner) => corner.x)),
      uMax: Math.max(...corners.map((corner) => corner.x)),
      low: { us: low.us, ws: low.ws.map((w) => w + baseShift) },
      high: { us: high.us, ws: high.ws.map((w) => w + topShift) },
    };
  };
  const profiles = bands.map(profileOf);
  const clipped = clip ? profileOf({ ...clip, lift: 0, height: 0 }) : null;
  const breaks: number[] = [];
  for (const profile of profiles) breaks.push(...profile.low.us, ...profile.high.us);
  if (clipped) breaks.push(clipped.low.us[0]!, ...clipped.low.us, ...clipped.high.us);
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      segmentCrossings(profiles[i]!.low, profiles[j]!.low, breaks);
      segmentCrossings(profiles[i]!.high, profiles[j]!.high, breaks);
    }
    if (!clipped) continue;
    // Where the silhouette crosses the receiver's own edge the clipped region
    // ends, so those crossings are breakpoints too.
    segmentCrossings(profiles[i]!.low, clipped.high, breaks);
    segmentCrossings(profiles[i]!.high, clipped.low, breaks);
    segmentCrossings(profiles[i]!.low, clipped.low, breaks);
    segmentCrossings(profiles[i]!.high, clipped.high, breaks);
  }
  const knots = [...new Set(breaks.map((value) => Math.round(value * 1e9) / 1e9))]
    .sort((a, b) => a - b);
  const strips: Strip[] = [];
  for (let index = 0; index + 1 < knots.length; index += 1) {
    const u0 = knots[index]!;
    const u1 = knots[index + 1]!;
    if (u1 - u0 < 1e-9) continue;
    const mid = (u0 + u1) / 2;
    let lo0 = Number.POSITIVE_INFINITY; let lo1 = Number.POSITIVE_INFINITY;
    let hi0 = Number.NEGATIVE_INFINITY; let hi1 = Number.NEGATIVE_INFINITY;
    let loBest = Number.POSITIVE_INFINITY;
    let hiBest = Number.NEGATIVE_INFINITY;
    for (const profile of profiles) {
      if (mid <= profile.uMin || mid >= profile.uMax) continue;
      const low = evaluateChain(profile.low, mid);
      if (low < loBest) {
        loBest = low;
        lo0 = evaluateChain(profile.low, u0);
        lo1 = evaluateChain(profile.low, u1);
      }
      const high = evaluateChain(profile.high, mid);
      if (high > hiBest) {
        hiBest = high;
        hi0 = evaluateChain(profile.high, u0);
        hi1 = evaluateChain(profile.high, u1);
      }
    }
    if (!Number.isFinite(loBest) || !Number.isFinite(hiBest)) continue;
    if (clipped) {
      if (mid <= clipped.uMin || mid >= clipped.uMax) continue;
      lo0 = Math.max(lo0, evaluateChain(clipped.low, u0));
      lo1 = Math.max(lo1, evaluateChain(clipped.low, u1));
      hi0 = Math.min(hi0, evaluateChain(clipped.high, u0));
      hi1 = Math.min(hi1, evaluateChain(clipped.high, u1));
      // A strip the receiver does not reach under contributes nothing. The
      // two ends are tested together because a crossing breakpoint was added
      // wherever the two boundaries meet, so within a strip the sign holds.
      if (hi0 - lo0 <= 1e-9 && hi1 - lo1 <= 1e-9) continue;
      lo0 = Math.min(lo0, hi0);
      lo1 = Math.min(lo1, hi1);
    }
    strips.push({ u0, u1, lo0, lo1, hi0, hi1 });
  }
  // Relax the tolerance until the tiling fits the strip budget. Doubling
  // terminates: at a tolerance past the silhouette's own width every strip
  // merges into one, so the loop cannot run more than a few dozen times.
  let fitted = mergeStrips(strips, tolerance);
  for (let relaxed = tolerance; fitted.length > maxStrips; relaxed *= 2) {
    fitted = mergeStrips(strips, relaxed * 2);
  }
  const triangles: ShadowTriangle[] = [];
  for (const strip of fitted) {
    const a = toWorld(strip.u0, strip.lo0);
    const b = toWorld(strip.u1, strip.lo1);
    const c = toWorld(strip.u1, strip.hi1);
    const d = toWorld(strip.u0, strip.hi0);
    const startFlat = strip.hi0 - strip.lo0 < 1e-9;
    const endFlat = strip.hi1 - strip.lo1 < 1e-9;
    if (startFlat && endFlat) continue;
    if (!endFlat) triangles.push([a, b, c]);
    if (!startFlat) triangles.push([a, c, d]);
  }
  return triangles;
}

/** Fold adjacent strips whose bounds stay within `tolerance` of one straight
 *  run into a single trapezoid: a plain box's shadow costs two triangles
 *  rather than one pair per envelope breakpoint it happens to have. */
function mergeStrips(strips: readonly Strip[], tolerance: number): Strip[] {
  const merged: Strip[] = [];
  let run: Strip | null = null;
  let knots: { u: number; lo: number; hi: number }[] = [];
  const flush = (): void => {
    if (run) merged.push(run);
    run = null;
    knots = [];
  };
  for (const strip of strips) {
    if (!run) {
      run = strip;
      knots = [];
      continue;
    }
    const contiguous = Math.abs(strip.u0 - run.u1) < 1e-9
      && Math.abs(strip.lo0 - run.lo1) < 1e-7
      && Math.abs(strip.hi0 - run.hi1) < 1e-7;
    if (!contiguous) { flush(); run = strip; continue; }
    const candidate: Strip = {
      u0: run.u0, u1: strip.u1, lo0: run.lo0, lo1: strip.lo1, hi0: run.hi0, hi1: strip.hi1,
    };
    const span = candidate.u1 - candidate.u0;
    const at = (u: number, w0: number, w1: number): number => (
      w0 + ((w1 - w0) * (u - candidate.u0)) / span
    );
    const probe = [...knots, { u: run.u1, lo: run.lo1, hi: run.hi1 }];
    const fits = span > 1e-12 && probe.every((knot) => (
      Math.abs(at(knot.u, candidate.lo0, candidate.lo1) - knot.lo) <= tolerance
      && Math.abs(at(knot.u, candidate.hi0, candidate.hi1) - knot.hi) <= tolerance
    ));
    if (!fits) { flush(); run = strip; continue; }
    knots = probe;
    run = candidate;
  }
  flush();
  return merged;
}
