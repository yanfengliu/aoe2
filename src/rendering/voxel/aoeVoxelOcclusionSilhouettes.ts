import {
  pointInConvexPolygon,
  projectVoxelPointToIso,
  voxelPartIsoPolygon,
  type VoxelIsoPoint,
} from './aoeVoxelGeometry';
import {
  SCREEN_LOCKED_DEPTH_LIFT,
  SCREEN_LOCKED_DEPTH_OFFSET,
  type VoxelOverlayEntity,
} from './aoeVoxelOverlayParts';
import { HUMAN_PLAYER_ID } from '../../game/simulation/prototypeScenario';
import type { VoxelPart } from './aoeVoxelRecipeTypes';

export interface OccludedUnitState {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly entityType: string;
}

export interface OcclusionSilhouetteResult {
  readonly occluded: readonly OccludedUnitState[];
  readonly parts: readonly VoxelPart[];
}

// The colours a hidden unit is drawn in — AoE2's PLAYER colours, one per slot.
//
// Two earlier attempts got the shape of this wrong. A flat WHITE mirror said
// nothing about whose unit was hidden, which is most of what the cue is for.
// The replacement said something, but not the truth: a sky-blue for you and a
// MAGENTA for everyone else, chosen by maximising RGB distance from the
// building palette. Maximising distance from the walls maximises distance from
// the player colours too, and the player colours are the message. The magenta
// was measured 137 from its nearest building material and still failed at the
// only job it had — a red player's unit behind a house read as a pink figure,
// and in a game where colour means whose a thing is, a cue naming the wrong
// player is worse than no cue (owner, playing the boot map, 2026-09-06).
//
// So the colours below are AoE2's own player order — blue, red, green, yellow,
// cyan, purple, grey, orange — lightened until they clear every building
// material (`occlusionSilhouetteContrast.test.ts` holds that floor at 90; the
// blue reaches 104 against `window`, the red 105 against `gold`). Deriving them
// from the unit's own tint still does not work: those tints are pale material
// shades (a villager is 0xf3e2b7 cream for the human and 0xf0b8b8 pink for an
// enemy), so both owners lighten to the same near-white.
//
// They are authored here rather than taken from `ownerTint`, and the reason is
// measured. `ownerTint` rotates hue while PRESERVING LUMINANCE, which is right
// for a material shade and wrong for a saturated cue: rotating this red toward
// yellow lands on 0xa47200, a dark olive that sits 70 from `roofTile` and reads
// as neither yellow nor legible; the grey slot lands on 0x828282, 33 from
// `stoneDark`, which is invisible on a stone wall. Every colour here instead
// keeps AoE2's hue (each within 10 degrees of its slot's canonical angle) and
// carries its own brightness.
//
// Two slots cannot clear the 90 floor and the reason is the palette itself, not
// the choice: this world's stone and plaster ARE greys, so no grey clears them
// (slot 7 reaches 61 against `plasterLight`, its best available), and a sunlit
// roof IS orange, so slot 8 clears the AUTHORED palette at 102 but lands within
// 6 of a roof's lit top face. AoE2 has both collisions too. The gate names them.
const OCCLUSION_SILHOUETTE_PLAYER_TINTS: readonly number[] = [
  0x5b9cff, // 1 blue
  0xff4d4d, // 2 red
  0x4ce05a, // 3 green
  0xffff5c, // 4 yellow
  0x4ce0e0, // 5 cyan
  0xa96bff, // 6 purple
  0xdfe8f2, // 7 grey
  0xff5e0a, // 8 orange
];

export const OCCLUSION_SILHOUETTE_TINT_OWN = OCCLUSION_SILHOUETTE_PLAYER_TINTS[0]!;
export const OCCLUSION_SILHOUETTE_TINT_ENEMY = OCCLUSION_SILHOUETTE_PLAYER_TINTS[1]!;

/**
 * The colour a hidden unit is drawn in, by ownership.
 *
 * Every player slot gets its own, so the cue names a green, yellow, cyan,
 * purple, grey or orange player the way AoE2 does. Before this, every owner but
 * the human took ONE "not yours" colour, which in a skirmish said only
 * "someone else's" — and an ally's unit read as an enemy's.
 *
 * Slots past AoE2's eight wrap rather than collapsing into one colour, exactly
 * as `ownerTint` does, so a scenario with more starts than AoE2 allows is still
 * readable.
 */
export function occlusionSilhouetteTint(owner: number | null): number {
  // A unit with no owner is gaia, which is nobody's — it takes the not-yours
  // colour rather than claiming to be the player's.
  if (owner === null) return OCCLUSION_SILHOUETTE_TINT_ENEMY;
  if (owner === HUMAN_PLAYER_ID) return OCCLUSION_SILHOUETTE_TINT_OWN;
  const slot = ((owner - 1) % OCCLUSION_SILHOUETTE_PLAYER_TINTS.length
    + OCCLUSION_SILHOUETTE_PLAYER_TINTS.length) % OCCLUSION_SILHOUETTE_PLAYER_TINTS.length;
  return OCCLUSION_SILHOUETTE_PLAYER_TINTS[slot] ?? OCCLUSION_SILHOUETTE_TINT_ENEMY;
}

const MIN_OCCLUDER_HORIZONTAL_EXTENT = 0.15;
// Fraction of the unit's own visual top where the cover test samples. A
// ground-pixel anchor let ankle-high geometry that merely PAINTS at the feet
// (farm soil/markers at 0.51 wu, construction slabs and knee courses) ghost a
// ~1.24 wu body standing in plain sight (review iter-1); sampling mid-body
// means an occluder must actually reach over the unit to fire.
const BODY_ANCHOR_HEIGHT_FRACTION = 0.55;
// Camera-ray displacement shared with the drag marquee (see the exported
// constants' doc in aoeVoxelOverlayParts): keeps the silhouette pixel-aligned
// with the hidden unit while depth-testing in front of the covering building.
const SILHOUETTE_LIFT = SCREEN_LOCKED_DEPTH_LIFT;

interface OccluderRegion {
  readonly maxCornerDepth: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  readonly polygons: readonly (readonly VoxelIsoPoint[])[];
}

function buildOccluderRegions(entities: readonly VoxelOverlayEntity[]): OccluderRegion[] {
  const regions: OccluderRegion[] = [];
  for (const { entity, parts } of entities) {
    if (entity.kind !== 'building' || entity.isMemory) continue;
    const polygons = parts
      .filter((part) => part.surface !== 'shadow' && part.surface !== 'memory'
        // Hairline accents (flag poles, banners, scaffold rails/posts — the
        // TC pole is 0.072 wu ≈ 2.3 px) paint slivers that cannot plausibly
        // hide a body; admitting them cut flickering full-body ghost
        // corridors across open ground (review iter-1). Only parts with real
        // horizontal mass may occlude.
        && Math.min(part.width, part.depth) >= MIN_OCCLUDER_HORIZONTAL_EXTENT)
      .map((part) => voxelPartIsoPolygon(part));
    if (polygons.length === 0) continue;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const polygon of polygons) {
      for (const point of polygon) {
        if (point.x < minX) minX = point.x;
        if (point.x > maxX) maxX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.y > maxY) maxY = point.y;
      }
    }
    // Max footprint-corner depth, not origin depth: on the building's
    // high-(x+y) flank, deeper wall cells genuinely paint over a unit whose
    // depth exceeds the origin's. Containment against the projected regions
    // excludes buildings that are wholly behind the unit.
    regions.push({
      maxCornerDepth: (entity.x + entity.footprintWidth - 1)
        + (entity.y + entity.footprintHeight - 1),
      minX,
      maxX,
      minY,
      maxY,
      polygons,
    });
  }
  return regions;
}

function isCovered(anchor: VoxelIsoPoint, depth: number, regions: readonly OccluderRegion[]): boolean {
  for (const region of regions) {
    if (region.maxCornerDepth <= depth) continue;
    if (
      anchor.x < region.minX || anchor.x > region.maxX
      || anchor.y < region.minY || anchor.y > region.maxY
    ) continue;
    if (region.polygons.some((polygon) => pointInConvexPolygon(anchor, polygon))) return true;
  }
  return false;
}

// The lane a silhouette is drawn on, and the whole reason it reads as a hint
// rather than as a fault.
//
// It used to be `ui`: unlit and fully OPAQUE. That paints a flat, featureless
// slab of colour over the wall — every other object in this world carries three
// differently lit faces per box, so a shape with none reads as a decal stuck to
// the building, and at full coverage a unit behind a house looks like a unit
// standing on its roof. Both are what the owner reported on the boot map.
//
// `memory` is the renderer's see-through lane: the same centered cube, but its
// material is lambert at opacity 0.5 (`aoeVoxelResources`). Two things follow
// and both are the fix. The building shows through, so the cue reads as
// something BEHIND rather than something in front; and the silhouette takes the
// same daylight the real unit takes, so head, torso and arms separate instead
// of merging into one blob. The lane already exists for fog ghosts — things you
// cannot presently see — which is exactly what an occluded unit is, so this
// costs no extra instance batch (the snapshot declares nine and the browser
// occlusion proof holds that ceiling).
//
// The `ui:occlusion:` key prefix stays: it says this is an overlay CUE rather
// than world geometry, which is still true, and it sorts after every
// entity-identity key so the silhouette blends last within the lane.
const SILHOUETTE_SURFACE = 'memory' as const;

// How many times the film is laid down. The lane's opacity is fixed at 0.5 and
// is shared with fog ghosts, so coverage is the only dial this cue owns: two
// coincident passes leave 1 - 0.5^2 = 75% of the tint on the pixel.
//
// One pass is not enough, and the reason is arithmetic rather than taste. At
// 50% the pixel is half the cue and half whatever is behind it, so where the
// background is the tint's COMPLEMENT the two cancel and the hue is gone — and
// this game pairs exactly that: player one is blue and almost every roof is
// orange. Measured on the showcase fixture at one pass, the friendly cue's head
// over a sunlit roof rendered (171,126,135) — a grey-mauve, from 0.5*(91,156,255)
// + 0.5*(251,96,15) — while its torso over the dark chimney stayed blue, so one
// silhouette carried two colours and neither was reliably the player's. Two
// passes put the same head at (131,141,195), which reads blue. The building
// still shows through: 25% of a roof's own light and shade is plenty to say
// "behind", as the captures for this change show.
const SILHOUETTE_PASSES = 2;

function mirrorSilhouetteParts(parts: readonly VoxelPart[], tint: number): VoxelPart[] {
  const mirrored: VoxelPart[] = [];
  for (const part of parts) {
    if (part.surface === 'shadow') continue;
    // Rest-spread forwards every posed field; the engine-side ambient wave is
    // deliberately dropped (the silhouette lane is force-static anyway).
    const { animation: droppedAnimation, ...posed } = part;
    void droppedAnimation;
    for (let pass = 0; pass < SILHOUETTE_PASSES; pass += 1) {
      mirrored.push({
        ...posed,
        // Pass 0 keeps the bare `ui:occlusion:` prefix every consumer knows;
        // later passes get their own so the batch's unique-key check holds.
        key: pass === 0
          ? `ui:occlusion:${part.key}`
          : `ui:occlusion-pass${String(pass)}:${part.key}`,
        surface: SILHOUETTE_SURFACE,
        tint,
        centerX: part.centerX + SCREEN_LOCKED_DEPTH_OFFSET,
        centerY: part.centerY + SILHOUETTE_LIFT,
        centerZ: part.centerZ + SCREEN_LOCKED_DEPTH_OFFSET,
      });
    }
  }
  return mirrored;
}

/**
 * A displayed live unit whose MID-BODY screen anchor (visualTop * 0.55 above
 * its recipe root) is painted over by a non-memory building's projected
 * silhouette gets a translucent, owner-coloured mirror of its posed parts on
 * the see-through lane, pulled toward the camera so it depth-tests in front of
 * the occluder. Inputs are the already
 * fog-filtered presented entities, so a unit hidden by fog can never receive
 * a cue. See spec §14.5 "units behind buildings" for the authored rule,
 * including the deliberate no-cue classes (low walls, palisades, resources).
 */
export function computeOcclusionSilhouettes(
  entities: readonly VoxelOverlayEntity[],
): OcclusionSilhouetteResult {
  const regions = buildOccluderRegions(entities);
  if (regions.length === 0) return { occluded: [], parts: [] };
  const occluded: OccludedUnitState[] = [];
  const parts: VoxelPart[] = [];
  for (const candidate of entities) {
    const { entity } = candidate;
    if (entity.kind !== 'unit' || entity.isMemory) continue;
    const anchor = projectVoxelPointToIso({
      x: entity.x + 0.5,
      y: candidate.visualTop * BODY_ANCHOR_HEIGHT_FRACTION,
      z: entity.y + 0.5,
    });
    if (!isCovered(anchor, entity.x + entity.y, regions)) continue;
    occluded.push({
      id: entity.id,
      x: entity.x,
      y: entity.y,
      entityType: entity.entityType,
    });
    parts.push(...mirrorSilhouetteParts(
      candidate.parts,
      occlusionSilhouetteTint(entity.owner),
    ));
  }
  return { occluded, parts };
}
