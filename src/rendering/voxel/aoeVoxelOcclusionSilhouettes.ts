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

// The flat colours a hidden unit is drawn in. Two of them, keyed on ownership.
//
// This was a flat WHITE mirror, which had two problems that only showed up on
// the real default map rather than in the showcase fixture: a fully opaque
// white body over a dark roof reads as a GHOST standing in front of the
// building, and it says nothing about whose unit is hidden — which is most of
// what the cue is for, since watching a wall to see whether the shapes behind
// it are yours is the whole reason AoE2 draws one.
//
// Deriving the colour from the unit's own tint does not work: the tints are
// already pale (a villager is 0xf3e2b7 cream for the human owner and 0xf0b8b8
// pink for an enemy), so any lightening lands back at white and the two owners
// stay indistinguishable. These are deliberately flat, saturated, and unlike
// any material colour in the world, so the shape reads as a CUE rather than as
// a unit that happens to be standing in front of a building. They are also
// distinct from the yellow selection outline and the cyan drag rectangle.
export const OCCLUSION_SILHOUETTE_TINT_OWN = 0x6fc8ff;
// Magenta, and it replaced a warm coral (0xff7a6a) for a measured reason. The
// cue exists to answer "are those mine?", so the NOT-yours colour is the half
// that matters most — and coral shares a hue family with every roof in the
// palette. Scored as the smallest RGB distance to any building colour, which
// is what a cue's legibility is actually bounded by, coral managed 76 (against
// thatch) where the friendly blue manages 105 (against steel). Magenta reaches
// 137, better than either, while staying 192 from the blue so the two are never
// confused, and far from both the yellow selection outline and the cyan drag
// rectangle. Scored over BUILDING materials only — a silhouette is never
// painted on water or foliage, and scoring the whole palette misleads: the blue
// sits 67 from `waterGlint`, which no silhouette can ever land on.
// `occlusionSilhouetteContrast.test.ts` pins the property; it red-checks
// against the coral.
export const OCCLUSION_SILHOUETTE_TINT_ENEMY = 0xff4de0;

/** The flat colour a hidden unit is drawn in, by ownership. */
export function occlusionSilhouetteTint(owner: number | null): number {
  // A unit with no owner is gaia wildlife, which is nobody's — it takes the
  // not-yours colour rather than claiming to be the player's.
  return owner === HUMAN_PLAYER_ID
    ? OCCLUSION_SILHOUETTE_TINT_OWN
    : OCCLUSION_SILHOUETTE_TINT_ENEMY;
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

function mirrorSilhouetteParts(parts: readonly VoxelPart[], tint: number): VoxelPart[] {
  return parts
    .filter((part) => part.surface !== 'shadow')
    .map((part) => {
      // Rest-spread forwards every posed field; the engine-side ambient wave is
      // deliberately dropped (the ui lane is force-static anyway).
      const { animation: droppedAnimation, ...posed } = part;
      void droppedAnimation;
      return {
        ...posed,
        key: `ui:occlusion:${part.key}`,
        surface: 'ui' as const,
        tint,
        centerX: part.centerX + SCREEN_LOCKED_DEPTH_OFFSET,
        centerY: part.centerY + SILHOUETTE_LIFT,
        centerZ: part.centerZ + SCREEN_LOCKED_DEPTH_OFFSET,
      };
    });
}

/**
 * A displayed live unit whose MID-BODY screen anchor (visualTop * 0.55 above
 * its recipe root) is painted over by a non-memory building's projected
 * silhouette gets a white ui mirror of its posed parts, pulled toward the
 * camera so it depth-tests in front of the occluder. Inputs are the already
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
