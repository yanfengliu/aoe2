import type Phaser from 'phaser';

// Darken a packed-rgb tint toward black by `factor` (0 = unchanged, 1 = black).
// Shared building-render colour util (was in the now-removed buildingSilhouettes
// module). Pure channel math, mirrors unitRenderer.darken.
export function darken(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * (1 - factor));
  const g = Math.round(((tint >> 8) & 0xff) * (1 - factor));
  const b = Math.round((tint & 0xff) * (1 - factor));
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

export interface IsoBuildingStyle {
  tint: number;
  outline: number;
  fillAlpha: number;
  outlineAlpha: number;
  // Optional roof colour override (else a lightened tint). Lets a role paint a
  // tiled/coloured roof while the walls stay the owner tint.
  roofTint?: number;
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

  // Facade: a dark doorway on the front-lit wall for tall-enough buildings, so
  // they read as structures with an entrance (skipped for flat/low footprints
  // like farms and walls). The door is a parallelogram on the left face — its
  // base a slice of the ground `left→bottom` edge, extruded up.
  if (heightPx > 22) {
    const lerp = (a: IsoPoint, b: IsoPoint, t: number): IsoPoint => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
    const baseA = lerp(corners.left, corners.bottom, 0.4);
    const baseB = lerp(corners.left, corners.bottom, 0.6);
    const doorH = heightPx * 0.55;
    g.fillStyle(darken(tint, 0.62), fillAlpha);
    g.fillPoints(
      [baseA, baseB, { x: baseB.x, y: baseB.y - doorH }, { x: baseA.x, y: baseA.y - doorH }],
      true,
    );
  }

  // Roof cap — the raw owner tint (the brightest, most colour-legible surface,
  // catching the light) unless the role overrides it.
  g.fillStyle(style.roofTint ?? tint, fillAlpha);
  g.fillPoints(polys.roof, true);

  // Outline the visible silhouette edges for a crisp read.
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokePoints(polys.leftFace, true, true);
  g.strokePoints(polys.rightFace, true, true);
  g.strokePoints(polys.roof, true, true);

  return polys.roof;
}
