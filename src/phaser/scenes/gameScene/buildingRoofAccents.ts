import type Phaser from 'phaser';

import type { BuildingRole } from './buildingRole';
import { darken, type IsoPoint } from './isoBuilding';

// Per-role roof accents for the isometric building volume (M7 increment 6). The
// extruded box (isoBuilding.drawIsoBuilding) gives every building depth + a
// role-scaled height; these small features sit on the ROOF centre so a Wonder,
// Monastery, Castle, Barracks, Mill, Town Center still read distinctly at a
// glance — the iso analogue of the flat per-role silhouettes. Accents rise in
// screen-up (−y) from the roof; pure per-frame draw (no random/time).

export interface RoofAccentStyle {
  tint: number;
  outline: number;
  fillAlpha: number;
  outlineAlpha: number;
}

// Accent size reference is CAPPED at this many px. Accents scale by the roof
// diamond's pixel width, which grows linearly with footprint (a 4x4 roof spans
// 256px), so without a cap a Town Center turret / Barracks banner / Monastery
// cross ballooned to 100-150px — taller than the whole building. The cap keeps a
// decorative feature a decorative feature regardless of footprint size.
const ACCENT_MAX_SCALE = 100;

// Centre + capped size reference of a roof diamond ([top, right, bottom, left]).
function roofMetrics(roof: IsoPoint[]): { cx: number; cy: number; width: number } {
  const cx = (roof[0].x + roof[1].x + roof[2].x + roof[3].x) / 4;
  const cy = (roof[0].y + roof[1].y + roof[2].y + roof[3].y) / 4;
  return { cx, cy, width: Math.min(roof[1].x - roof[3].x, ACCENT_MAX_SCALE) };
}

function drawDome(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  const { cx, cy, width } = roofMetrics(roof);
  const r = width * 0.32;
  g.fillStyle(darken(s.tint, 0.1), s.fillAlpha);
  g.beginPath();
  g.arc(cx, cy - r * 0.2, r, Math.PI, 0);
  g.fillPath();
  g.lineStyle(1.5, s.outline, s.outlineAlpha);
  g.beginPath();
  g.arc(cx, cy - r * 0.2, r, Math.PI, 0);
  g.strokePath();
  g.fillStyle(s.outline, s.fillAlpha);
  g.fillCircle(cx, cy - r * 1.2, Math.max(1.5, r * 0.2)); // spire pip
}

function drawCross(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  const { cx, cy, width } = roofMetrics(roof);
  const h = width * 0.5;
  const arm = width * 0.16;
  g.lineStyle(2, s.outline, s.outlineAlpha);
  g.lineBetween(cx, cy - h, cx, cy);
  g.lineBetween(cx - arm, cy - h * 0.72, cx + arm, cy - h * 0.72);
}

function drawMerlons(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  // Crenellation blocks marching along the two BACK roof edges (top->left,
  // top->right) so they rise above the roof silhouette.
  const merlon = darken(s.tint, 0.28);
  g.fillStyle(merlon, s.fillAlpha);
  const backEdges: Array<[IsoPoint, IsoPoint]> = [
    [roof[0], roof[3]],
    [roof[0], roof[1]],
  ];
  const count = 3;
  const blockH = Math.max(3, roofMetrics(roof).width * 0.12);
  for (const [a, b] of backEdges) {
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      g.fillRect(mx - blockH * 0.5, my - blockH, blockH, blockH);
    }
  }
}

function drawBanner(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  const { cx, cy, width } = roofMetrics(roof);
  const poleTop = cy - width * 0.6;
  g.lineStyle(2, s.outline, s.outlineAlpha);
  g.lineBetween(cx, poleTop, cx, cy);
  const flagW = width * 0.34;
  const flagH = width * 0.24;
  g.fillStyle(s.tint, s.fillAlpha);
  g.fillTriangle(cx, poleTop, cx + flagW, poleTop + flagH * 0.5, cx, poleTop + flagH);
  g.lineStyle(1, s.outline, s.outlineAlpha);
  g.strokeTriangle(cx, poleTop, cx + flagW, poleTop + flagH * 0.5, cx, poleTop + flagH);
}

function drawMillBlades(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  const { cx, cy, width } = roofMetrics(roof);
  const arm = width * 0.42;
  g.lineStyle(2.5, darken(s.tint, 0.3), s.outlineAlpha);
  g.lineBetween(cx - arm * 0.7, cy - arm * 0.7, cx + arm * 0.7, cy + arm * 0.7);
  g.lineBetween(cx - arm * 0.7, cy + arm * 0.7, cx + arm * 0.7, cy - arm * 0.7);
  g.fillStyle(s.outline, s.fillAlpha);
  g.fillCircle(cx, cy, Math.max(1.5, arm * 0.16));
}

function drawTurret(g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle): void {
  // Town Center: a small central tower — a modest iso block (lit + shadowed wall
  // faces + a top diamond) rising from the roof centre, NOT a full-height flat
  // billboard rectangle (which read as a giant column in iso).
  const { cx, cy, width } = roofMetrics(roof);
  const bw = width * 0.16; // tower base half-width
  const bh = bw * 0.5; // iso 2:1 half-depth
  const h = width * 0.28; // tower height
  const leftFace = [
    { x: cx - bw, y: cy },
    { x: cx, y: cy + bh },
    { x: cx, y: cy + bh - h },
    { x: cx - bw, y: cy - h },
  ];
  const rightFace = [
    { x: cx, y: cy + bh },
    { x: cx + bw, y: cy },
    { x: cx + bw, y: cy - h },
    { x: cx, y: cy + bh - h },
  ];
  const top = [
    { x: cx, y: cy - bh - h },
    { x: cx + bw, y: cy - h },
    { x: cx, y: cy + bh - h },
    { x: cx - bw, y: cy - h },
  ];
  g.fillStyle(darken(s.tint, 0.16), s.fillAlpha);
  g.fillPoints(leftFace, true);
  g.fillStyle(darken(s.tint, 0.4), s.fillAlpha);
  g.fillPoints(rightFace, true);
  g.fillStyle(darken(s.tint, 0.04), s.fillAlpha);
  g.fillPoints(top, true);
  g.lineStyle(1.5, s.outline, s.outlineAlpha);
  g.strokePoints(top, true, true);
}

const ACCENT_BY_ROLE: Partial<
  Record<BuildingRole, (g: Phaser.GameObjects.Graphics, roof: IsoPoint[], s: RoofAccentStyle) => void>
> = {
  wonder: drawDome,
  monastery: drawCross,
  fortress: drawMerlons,
  tower: drawMerlons,
  wall: drawMerlons,
  military: drawBanner,
  mill: drawMillBlades,
  'town-center': drawTurret,
};

// Draw the role's roof accent onto the iso roof diamond, if it has one (house /
// drop-site / market / blacksmith / farm read from the volume + height alone).
export function drawBuildingRoofAccent(
  g: Phaser.GameObjects.Graphics,
  role: BuildingRole,
  roof: IsoPoint[],
  style: RoofAccentStyle,
): void {
  ACCENT_BY_ROLE[role]?.(g, roof, style);
}
