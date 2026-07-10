import type { BuildingType, ProjectedEntityView } from '../../../game/simulation/types';
import { buildingRole } from './buildingRole';
import {
  hipRoofFaces,
  isoBuildingHeightPx,
  pitchedApexPx,
  roleHasPitchedRoof,
} from './isoBuilding';
import { worldToIso, type IsoPoint } from './isoProjection';

// "Unit behind a building" occlusion detection (v0.1.133). A unit standing
// behind a building is painted over by that building in the single depth-sorted
// entity pass, so it vanishes. To surface it, the scene draws a white
// silhouette of every OCCLUDED unit on a layer above the buildings. This pure,
// Phaser-free module decides WHICH units are occluded — the scene does the
// drawing. Everything is a deterministic function of the projected entities
// (no random/time), matching the rest of the render layer.

// The render depth sort key — the entity draw sort in sceneRenderer sorts by
// this exact function (both call depthKey), so a building B paints ON TOP of a
// unit U iff depthKey(B) > depthKey(U); the predicate can never disagree with
// the paint order because they share this one definition.
export function depthKey(entity: { x: number; y: number }): number {
  return entity.x + entity.y;
}

// The silhouette polygon (in pre-camera iso pixels) enclosing the building
// VOLUME (walls + roof) that drawIsoBuilding actually paints: the footprint
// diamond extruded up by the drawn wall height, capped at the roof's real
// top — a pitched roof's HIP RIDGE (inset toward centre, NOT a full-height
// apex over the back corner), or the flat eave for battlement/dome/flat roles
// and construction stubs. Boundary order (a hexagon): bottom → right →
// rightEave → topPoint → leftEave → left; the ground `top` corner is interior
// and omitted. It intentionally EXCLUDES thin roof accents (turret / dome /
// merlons) that poke above the roofline, so it never OVER-claims occlusion
// above the painted roof — a unit hidden entirely behind a thin central accent
// is the only accepted miss (an under-claim).
export function buildingSilhouettePolygon(building: ProjectedEntityView): IsoPoint[] {
  const w = building.footprintWidth;
  const h = building.footprintHeight;
  const role = buildingRole(building.entityType as BuildingType);
  const isConstruction = building.visualVariant === 'construction';

  const top = worldToIso(building.x, building.y);
  const right = worldToIso(building.x + w, building.y);
  const bottom = worldToIso(building.x + w, building.y + h);
  const left = worldToIso(building.x, building.y + h);

  const wallPx = isoBuildingHeightPx(role) * (isConstruction ? 0.4 : 1);
  const lift = (p: IsoPoint): IsoPoint => ({ x: p.x, y: p.y - wallPx });
  const topEave = lift(top);
  const rightEave = lift(right);
  const bottomEave = lift(bottom);
  const leftEave = lift(left);

  // The topmost PAINTED point. A pitched roof's ridge is inset toward the roof
  // centre (hipRoofFaces, ridgeFraction 0.42) and sits far below a naive apex
  // over the back corner — computing it here from the SAME geometry
  // drawIsoBuilding paints avoids the false-positive band above the ridge.
  let topPoint = topEave;
  if (roleHasPitchedRoof(role) && !isConstruction) {
    const apexPx = pitchedApexPx(rightEave.x - leftEave.x);
    topPoint = hipRoofFaces([topEave, rightEave, bottomEave, leftEave], apexPx).ridgeBack;
  }

  return [bottom, right, rightEave, topPoint, leftEave, left];
}

// Standard ray-cast point-in-polygon (works for any simple polygon, so it stays
// correct if a future roof accent makes the silhouette non-convex).
export function pointInPolygon(px: number, py: number, poly: readonly IsoPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

interface Aabb {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function polygonAabb(poly: readonly IsoPoint[]): Aabb {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function inAabb(px: number, py: number, aabb: Aabb): boolean {
  return px >= aabb.minX && px <= aabb.maxX && py >= aabb.minY && py <= aabb.maxY;
}

// A unit is occluded iff some building that paints ON TOP of it (larger depth
// key) covers the unit's screen CENTRE — the unit's ground point, which is its
// lowest (largest-y) pixel. The depth gate guarantees an occluding building
// sorts AFTER the unit, so the unit always projects into the building's UPPER
// silhouette; sampling a point higher than the centre (head) would only exit
// that silhouette, never add coverage, so the centre is the correct single
// sample. Memory (ghost) buildings draw a flat translucent diamond, not a
// volume, so they never occlude. O(units × buildings) with an AABB pre-reject;
// sub-millisecond at RTS scale.
export function computeOccludedUnits(
  entities: readonly ProjectedEntityView[],
): ProjectedEntityView[] {
  const occluders = entities
    .filter((e) => e.kind === 'building' && !e.isMemory)
    .map((b) => {
      const polygon = buildingSilhouettePolygon(b);
      return { depth: depthKey(b), polygon, aabb: polygonAabb(polygon) };
    });
  if (occluders.length === 0) return [];

  const occluded: ProjectedEntityView[] = [];
  for (const unit of entities) {
    if (unit.kind !== 'unit' || unit.isMemory) continue;
    const centre = worldToIso(unit.x + 0.5, unit.y + 0.5);
    const unitDepth = depthKey(unit);
    for (const occ of occluders) {
      if (occ.depth <= unitDepth) continue;
      if (
        inAabb(centre.x, centre.y, occ.aabb)
        && pointInPolygon(centre.x, centre.y, occ.polygon)
      ) {
        occluded.push(unit);
        break;
      }
    }
  }
  return occluded;
}
