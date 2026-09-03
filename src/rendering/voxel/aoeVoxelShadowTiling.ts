// Tiling the silhouette a caster's PROFILE throws, in the sun's own frame.
//
// The profile itself — how wide the caster is at each height — is
// `aoeVoxelShadowShape.ts`. This half turns a set of bands into triangles.
//
// In shadow space (the frame whose `w` axis runs along the sun's ground
// projection and whose `u` axis crosses it) a band's swept shadow is exactly
// `w in [LO_i(u), HI_i(u)]` with both bounds piecewise linear. The shadow is
// the UNION of those intervals — NOT the lower envelope of the `LO_i` under
// the upper envelope of the `HI_i`, which is a different region wherever the
// intervals do not all overlap, and fills the daylight between them. A review
// measured that on the watch tower: two solid wedges of invented shadow
// running the length of the tower, 9% of its shadow's area — the same "shadow
// that ignores the caster's shape" defect this module exists to remove,
// wearing a different shape.
//
// Slicing `u` at every breakpoint — every band's chain vertices, and every
// crossing of any two boundaries: LO against LO, HI against HI, and LO against
// HI — leaves the overlap structure constant across each strip, so the union
// can be taken at the strip's midpoint and applied to both its ends. Two
// triangles tile each resulting trapezoid. Triangles of one caster NEVER
// OVERLAP, which is what keeps the translucent shadow lane to one blend per
// pixel without needing a depth level per piece.
import type { ShadowProjection } from './aoeVoxelDaylight';
import type { ShadowCasterBand, ShadowPoint, ShadowTriangle } from './aoeVoxelShadowShape';

/** How far the tiling may stray from the exact silhouette, in world units.
 *  About 3px at the closest camera zoom: below that, extra strips buy
 *  instances rather than shape. */
const SILHOUETTE_TOLERANCE = 0.03;
/** Trapezoid strips per caster, and so at most twice this many instances.
 *  The envelope's breakpoint count is not bounded by the band count — four
 *  bands can cross each other 56 ways — so the tolerance is RELAXED until the
 *  tiling fits instead of trusting that it will — and then STOPS either way,
 *  because it cannot always succeed (see the relax loop).
 *
 *  Sized from measurement, not from taste. At ten strips the budget was
 *  binding on real casters and the relax loop paid for it in SHAPE: a watch
 *  tower lost 24.6% of its shadow area to coarse merging, silently, and a
 *  bombard tower 23.8%. Raising it to 24 takes both to 0.0% for four more
 *  triangles each. A budget that quietly deletes a quarter of the thing it is
 *  budgeting is not a saving. */
export const MAX_SHADOW_STRIPS = 24;
/** Strips for the second layer — the part of a caster's shadow that lands on
 *  its own pad. That patch is small and mostly hidden by the mass throwing
 *  it, so it gets a coarser budget than the ground layer. */
export const MAX_PAD_STRIPS = 8;
/** Shadow instances one caster can ever emit: two layers, two triangles per
 *  strip. Recipes are bounded against this so a silhouette cannot quietly
 *  become the frame's instance budget.
 *
 *  What it actually costs, measured rather than guessed. Boot map, live
 *  renderer metrics: 862 instances before this module, 1,368 after (+59%),
 *  batches unchanged at nine. Per caster the mean is 23 against the 3 a
 *  single box drew. On a DENSE scene the shadow lane is the majority of the
 *  frame's instances, not a quarter — an earlier version of this comment said
 *  "roughly a quarter" and a review measured 64% on 261 casters. The lane is
 *  one batch and one draw call either way; the cost is instance bandwidth. */
export const MAX_SHADOW_PIECES = (MAX_SHADOW_STRIPS + MAX_PAD_STRIPS) * 2;

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
  /** Which bands this piece is the union of. Two strips may only be folded
   *  together when they are the same piece of the silhouette; a run that
   *  changes membership is a different piece and merging across it would
   *  bridge two shadows that do not touch. */
  readonly members: string;
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
  // ...and LO against HI, for every ordered pair. This is where one band's
  // swept interval starts or stops touching another's, so it is where the
  // union splits into two pieces or closes back into one. Without it the
  // strip loop can straddle the moment a gap opens and fill it.
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = 0; j < profiles.length; j += 1) {
      if (i === j) continue;
      segmentCrossings(profiles[i]!.low, profiles[j]!.high, breaks);
    }
  }
  const knots = [...new Set(breaks.map((value) => Math.round(value * 1e9) / 1e9))]
    .sort((a, b) => a - b);
  const strips: Strip[] = [];
  for (let index = 0; index + 1 < knots.length; index += 1) {
    const u0 = knots[index]!;
    const u1 = knots[index + 1]!;
    if (u1 - u0 < 1e-9) continue;
    const mid = (u0 + u1) / 2;
    // The union of the active bands' swept intervals — NOT the min of their
    // lower bounds under the max of their upper ones. Those differ exactly
    // when the intervals do not all overlap, and then the envelope fills the
    // daylight between them: measured on the watch-tower, two solid wedges of
    // invented shadow running the length of the tower, 9% of its shadow's
    // area, which is the same "shadow that ignores the caster's shape" defect
    // this module exists to remove, wearing a different shape.
    const active: {
      lo0: number; lo1: number; hi0: number; hi1: number;
      loMid: number; hiMid: number; members: number[];
    }[] = [];
    for (let index = 0; index < profiles.length; index += 1) {
      const profile = profiles[index]!;
      if (mid <= profile.uMin || mid >= profile.uMax) continue;
      active.push({
        lo0: evaluateChain(profile.low, u0), lo1: evaluateChain(profile.low, u1),
        hi0: evaluateChain(profile.high, u0), hi1: evaluateChain(profile.high, u1),
        loMid: evaluateChain(profile.low, mid), hiMid: evaluateChain(profile.high, mid),
        members: [index],
      });
    }
    if (active.length === 0) continue;
    active.sort((a, b) => a.loMid - b.loMid);
    const pieces: typeof active = [];
    for (const band of active) {
      const open = pieces.at(-1);
      // Ordering and overlap are constant across a strip, because every
      // crossing of any two boundaries is a breakpoint, so testing at the
      // midpoint decides the whole strip.
      if (open && band.loMid <= open.hiMid + 1e-9) {
        open.hiMid = Math.max(open.hiMid, band.hiMid);
        open.lo0 = Math.min(open.lo0, band.lo0); open.lo1 = Math.min(open.lo1, band.lo1);
        open.hi0 = Math.max(open.hi0, band.hi0); open.hi1 = Math.max(open.hi1, band.hi1);
        open.members.push(...band.members);
        continue;
      }
      pieces.push({ ...band, members: [...band.members] });
    }
    for (const piece of pieces) {
      let { lo0, lo1, hi0, hi1 } = piece;
      if (clipped) {
        if (mid <= clipped.uMin || mid >= clipped.uMax) continue;
        lo0 = Math.max(lo0, evaluateChain(clipped.low, u0));
        lo1 = Math.max(lo1, evaluateChain(clipped.low, u1));
        hi0 = Math.min(hi0, evaluateChain(clipped.high, u0));
        hi1 = Math.min(hi1, evaluateChain(clipped.high, u1));
        // A piece the receiver does not reach under contributes nothing.
        if (hi0 - lo0 <= 1e-9 && hi1 - lo1 <= 1e-9) continue;
        // Clamp rather than invert. A clipped end can only close, never
        // cross, because every crossing of the two boundaries is a
        // breakpoint; this guards the floating-point edge of that.
        lo0 = Math.min(lo0, hi0);
        lo1 = Math.min(lo1, hi1);
      }
      strips.push({
        u0, u1, lo0, lo1, hi0, hi1,
        members: [...piece.members].sort((a, b) => a - b).join(','),
      });
    }
  }
  // Relax the tolerance toward the strip budget, and STOP either way.
  //
  // The budget is a target, not a guarantee, and the loop that pretended
  // otherwise hung the renderer. `mergeStrips` will not fold across a
  // discontinuity in the silhouette's own boundary — nor should it, since that
  // would bridge two pieces that do not touch — and no tolerance changes that,
  // so a caster with more irreducible runs than the budget made the original
  // `for (…; fitted.length > maxStrips; relaxed *= 2)` spin forever. It was
  // one recipe edit away: measured, the shipped content peaks at 3 irreducible
  // runs in a pad layer against a budget of 4, and fuzzing plausible
  // plinth-plus-blocks casters hit the hang about once in 300.
  //
  // So: a fixed number of doublings, then take what we have. A few extra
  // instances is a cost; a frozen frame is not a tradeoff.
  const MAX_RELAX_STEPS = 24;
  let fitted = mergeStrips(strips, tolerance);
  let relaxed = Math.max(tolerance, 1e-6);
  for (let step = 0; step < MAX_RELAX_STEPS && fitted.length > maxStrips; step += 1) {
    relaxed *= 2;
    fitted = mergeStrips(strips, relaxed);
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
    const contiguous = strip.members === run.members
      && Math.abs(strip.u0 - run.u1) < 1e-9
      && Math.abs(strip.lo0 - run.lo1) < 1e-7
      && Math.abs(strip.hi0 - run.hi1) < 1e-7;
    if (!contiguous) { flush(); run = strip; continue; }
    const candidate: Strip = {
      u0: run.u0, u1: strip.u1, lo0: run.lo0, lo1: strip.lo1, hi0: run.hi0, hi1: strip.hi1,
      members: run.members,
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
