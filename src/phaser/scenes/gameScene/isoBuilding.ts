import type Phaser from 'phaser';

import type { BuildingRole } from './buildingRole';
import { ISO_TILE_HEIGHT } from './isoProjection';

// Wall height per role, in iso-tile-height units (× ISO_TILE_HEIGHT px). Bigger,
// grander structures rise taller; flat plots (farm) stay near the ground. Shared
// by buildingRenderer (to extrude the volume) and worldLayers (to sit the HP bar
// above the volume rather than at the flat footprint top).
export const ISO_HEIGHT_CELLS_BY_ROLE: Record<BuildingRole, number> = {
  'town-center': 1.7,
  fortress: 2.4,
  wonder: 2.8,
  house: 1.05,
  mill: 1.2,
  farm: 0.06,
  'drop-site': 0.85,
  military: 1.35,
  blacksmith: 1.2,
  market: 0.85,
  monastery: 1.7,
  tower: 2.1,
  wall: 0.5,
};

// Extruded wall height in px for a building role.
export function isoBuildingHeightPx(role: BuildingRole): number {
  return ISO_HEIGHT_CELLS_BY_ROLE[role] * ISO_TILE_HEIGHT;
}

// Darken a packed-rgb tint toward black by `factor` (0 = unchanged, 1 = black).
// Shared building-render colour util (was in the now-removed buildingSilhouettes
// module). Pure channel math, mirrors unitRenderer.darken.
export function darken(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * (1 - factor));
  const g = Math.round(((tint >> 8) & 0xff) * (1 - factor));
  const b = Math.round((tint & 0xff) * (1 - factor));
  return (r << 16) | (g << 8) | b;
}

function lighten(tint: number, factor: number): number {
  const r0 = (tint >> 16) & 0xff;
  const g0 = (tint >> 8) & 0xff;
  const b0 = tint & 0xff;
  const r = Math.round(r0 + (0xff - r0) * factor);
  const g = Math.round(g0 + (0xff - g0) * factor);
  const b = Math.round(b0 + (0xff - b0) * factor);
  return (r << 16) | (g << 8) | b;
}

// Isometric 3/4-view building volume (M7 overhaul increment 6). A building's
// footprint projects to a ground DIAMOND (its four cell corners run through
// worldToIso); extruding that diamond straight up by a wall height gives a solid
// box with two camera-facing wall faces (the lower-left and lower-right diamond
// edges) plus a roof (the lifted diamond). Pure geometry here + a painter; the
// caller (buildingRenderer) supplies the projected corners, the height, and the
// role's roof/accent styling. Everything is a deterministic function of inputs
// (no random/time), matching the rest of the render layer.

export interface IsoPoint {
  x: number;
  y: number;
}

export interface FootprintDiamond {
  top: IsoPoint; // worldToIso(x, y)
  right: IsoPoint; // worldToIso(x + w, y)
  bottom: IsoPoint; // worldToIso(x + w, y + h)
  left: IsoPoint; // worldToIso(x, y + h)
}

export interface IsoBuildingPolys {
  ground: IsoPoint[];
  roof: IsoPoint[];
  leftFace: IsoPoint[];
  rightFace: IsoPoint[];
}

function lift(point: IsoPoint, heightPx: number): IsoPoint {
  return { x: point.x, y: point.y - heightPx };
}

// Linear interpolation between two iso points (used to place facade openings
// along a wall's base edge).
function lerp(a: IsoPoint, b: IsoPoint, t: number): IsoPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

// The four polygons of an extruded building box. `ground` is the footprint
// diamond; `roof` is it lifted by heightPx; the two visible wall faces are the
// lower-left (left->bottom) and lower-right (bottom->right) edges extruded up.
export function isoBuildingPolys(corners: FootprintDiamond, heightPx: number): IsoBuildingPolys {
  const topRoof = lift(corners.top, heightPx);
  const rightRoof = lift(corners.right, heightPx);
  const bottomRoof = lift(corners.bottom, heightPx);
  const leftRoof = lift(corners.left, heightPx);

  return {
    ground: [corners.top, corners.right, corners.bottom, corners.left],
    roof: [topRoof, rightRoof, bottomRoof, leftRoof],
    leftFace: [corners.left, corners.bottom, bottomRoof, leftRoof],
    rightFace: [corners.bottom, corners.right, rightRoof, bottomRoof],
  };
}

// Facade windows: a row of small dark openings in a high band of a wall face,
// painted for tall-enough buildings so walls read as inhabited structures rather
// than blank slabs. Pure geometry — returns `count` window quads (parallelograms
// that follow the wall plane), the count scaling with the wall-edge length so a
// wide Castle wall gets more windows than a narrow House. Windows sit in the
// [SILL, HEAD] height band, which is ABOVE the door band (0..0.55H), so door and
// windows never overlap. `baseA`→`baseB` is the face's ground edge.
const WINDOW_SILL = 0.55; // window bottom, as a fraction of the wall height
const WINDOW_HEAD = 0.72; // window top, as a fraction of the wall height
const WINDOW_HALF_WIDTH = 0.06; // half-width, as a fraction of the base edge
const WINDOW_SPACING_PX = 40; // roughly one window per this many px of wall edge

export function wallWindowPolys(baseA: IsoPoint, baseB: IsoPoint, heightPx: number): IsoPoint[][] {
  const edgeLen = Math.hypot(baseB.x - baseA.x, baseB.y - baseA.y);
  const count = clamp(Math.round(edgeLen / WINDOW_SPACING_PX), 2, 5);
  const sill = heightPx * WINDOW_SILL;
  const head = heightPx * WINDOW_HEAD;
  const quads: IsoPoint[][] = [];
  for (let i = 0; i < count; i += 1) {
    const centre = (i + 0.5) / count;
    const a0 = lerp(baseA, baseB, centre - WINDOW_HALF_WIDTH);
    const a1 = lerp(baseA, baseB, centre + WINDOW_HALF_WIDTH);
    quads.push([
      { x: a0.x, y: a0.y - sill },
      { x: a1.x, y: a1.y - sill },
      { x: a1.x, y: a1.y - head },
      { x: a0.x, y: a0.y - head },
    ]);
  }
  return quads;
}

const WALL_COURSE_LIFTS = [0.18, 0.32, 0.46] as const;

export function wallCourseSegments(
  baseA: IsoPoint,
  baseB: IsoPoint,
  heightPx: number,
): Array<[IsoPoint, IsoPoint]> {
  return WALL_COURSE_LIFTS.map((liftFraction) => {
    const liftPx = heightPx * liftFraction;
    return [
      { x: baseA.x, y: baseA.y - liftPx },
      { x: baseB.x, y: baseB.y - liftPx },
    ];
  });
}

export function roofTileSegments(roof: readonly IsoPoint[]): Array<[IsoPoint, IsoPoint]> {
  const [top, right, bottom, left] = roof;
  if (!top || !right || !bottom || !left) return [];
  return [
    [lerp(top, left, 0.25), lerp(right, bottom, 0.25)],
    [lerp(top, left, 0.5), lerp(right, bottom, 0.5)],
    [lerp(top, left, 0.75), lerp(right, bottom, 0.75)],
    [lerp(top, right, 0.33), lerp(left, bottom, 0.33)],
    [lerp(top, right, 0.66), lerp(left, bottom, 0.66)],
  ];
}

export interface RoofBevelSegments {
  highlight: Array<[IsoPoint, IsoPoint]>;
  shadow: Array<[IsoPoint, IsoPoint]>;
}

export function roofBevelSegments(roof: readonly IsoPoint[]): RoofBevelSegments {
  const [top, right, bottom, left] = roof;
  if (!top || !right || !bottom || !left) return { highlight: [], shadow: [] };
  const centre = {
    x: (top.x + right.x + bottom.x + left.x) / 4,
    y: (top.y + right.y + bottom.y + left.y) / 4,
  };
  const inset = (point: IsoPoint): IsoPoint => lerp(point, centre, 0.07);
  return {
    highlight: [
      [inset(top), inset(right)],
      [inset(top), inset(left)],
    ],
    shadow: [
      [inset(left), inset(bottom)],
      [inset(right), inset(bottom)],
    ],
  };
}

export interface IsoBuildingStyle {
  tint: number;
  outline: number;
  fillAlpha: number;
  outlineAlpha: number;
  // Optional roof colour override (else a lightened tint). Lets a role paint a
  // tiled/coloured roof while the walls stay the owner tint.
  roofTint?: number;
  materialDetail?: boolean;
}

// Paint the extruded box back-to-front: ground shadow, the two wall faces (the
// left face reads as the lit side, the right as the shadowed side for a fixed
// upper-left light), then the roof cap. Returns the roof polygon so the caller
// can place a per-role finial/accent on top.
export function drawIsoBuilding(
  g: Phaser.GameObjects.Graphics,
  corners: FootprintDiamond,
  heightPx: number,
  style: IsoBuildingStyle,
): IsoPoint[] {
  const polys = isoBuildingPolys(corners, heightPx);
  const { tint, outline, fillAlpha, outlineAlpha } = style;
  const materialDetail = style.materialDetail ?? true;

  // Ground contact shadow (a touch darker than the walls) so the box sits on the
  // terrain rather than floating.
  g.fillStyle(darken(tint, 0.6), fillAlpha * 0.5);
  g.fillPoints(polys.ground, true);

  // Left wall face — lit side.
  g.fillStyle(darken(tint, 0.16), fillAlpha);
  g.fillPoints(polys.leftFace, true);
  // Right wall face — shadowed side.
  g.fillStyle(darken(tint, 0.4), fillAlpha);
  g.fillPoints(polys.rightFace, true);

  // Facade: for tall-enough buildings (skipped for flat/low footprints like
  // farms and walls) a dark doorway on the front-lit wall plus a row of dark
  // windows on BOTH visible wall faces, so they read as inhabited structures
  // rather than blank slabs. The door is a parallelogram on the left face (a
  // slice of the ground `left→bottom` edge extruded up); windows sit in a higher
  // band (see wallWindowPolys) so they never overlap the door.
  if (heightPx > 22 && materialDetail) {
    for (const [faceA, faceB, shade] of [
      [corners.left, corners.bottom, 0.28],
      [corners.bottom, corners.right, 0.52],
    ] as const) {
      g.lineStyle(1, darken(tint, shade), fillAlpha * 0.5);
      for (const [a, b] of wallCourseSegments(faceA, faceB, heightPx)) {
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
    }

    const doorBaseA = lerp(corners.left, corners.bottom, 0.4);
    const doorBaseB = lerp(corners.left, corners.bottom, 0.6);
    const doorH = heightPx * 0.55;
    g.fillStyle(darken(tint, 0.62), fillAlpha);
    g.fillPoints(
      [
        doorBaseA,
        doorBaseB,
        { x: doorBaseB.x, y: doorBaseB.y - doorH },
        { x: doorBaseA.x, y: doorBaseA.y - doorH },
      ],
      true,
    );

    g.fillStyle(darken(tint, 0.68), fillAlpha);
    for (const [faceA, faceB] of [
      [corners.left, corners.bottom],
      [corners.bottom, corners.right],
    ] as const) {
      for (const quad of wallWindowPolys(faceA, faceB, heightPx)) {
        g.fillPoints(quad, true);
      }
    }
  }

  // Roof cap — the raw owner tint (the brightest, most colour-legible surface,
  // catching the light) unless the role overrides it.
  const roofTint = style.roofTint ?? tint;
  g.fillStyle(roofTint, fillAlpha);
  g.fillPoints(polys.roof, true);
  if (heightPx > 22 && materialDetail) {
    g.lineStyle(1, darken(roofTint, 0.18), fillAlpha * 0.45);
    for (const [a, b] of roofTileSegments(polys.roof)) {
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    const roofBevel = roofBevelSegments(polys.roof);
    g.lineStyle(2, lighten(roofTint, 0.24), fillAlpha * 0.42);
    for (const [a, b] of roofBevel.highlight) {
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    g.lineStyle(2, darken(roofTint, 0.34), fillAlpha * 0.5);
    for (const [a, b] of roofBevel.shadow) {
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  // Outline the visible silhouette edges for a crisp read.
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokePoints(polys.leftFace, true, true);
  g.strokePoints(polys.rightFace, true, true);
  g.strokePoints(polys.roof, true, true);

  return polys.roof;
}
