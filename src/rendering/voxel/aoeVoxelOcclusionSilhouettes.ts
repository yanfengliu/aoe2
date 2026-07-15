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

export const OCCLUSION_SILHOUETTE_TINT = 0xffffff;
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

function mirrorSilhouetteParts(parts: readonly VoxelPart[]): VoxelPart[] {
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
        tint: OCCLUSION_SILHOUETTE_TINT,
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
    parts.push(...mirrorSilhouetteParts(candidate.parts));
  }
  return { occluded, parts };
}
