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

// Centre + rough width of a roof diamond ([top, right, bottom, left]).
function roofMetrics(roof: IsoPoint[]): { cx: number; cy: number; width: number } {
  const cx = (roof[0].x + roof[1].x + roof[2].x + roof[3].x) / 4;
  const cy = (roof[0].y + roof[1].y + roof[2].y + roof[3].y) / 4;
  return { cx, cy, width: roof[1].x - roof[3].x };
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
  const blockH = Math.max(3, (roof[1].x - roof[3].x) * 0.12);
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
  // Town Center: a small raised block at the roof centre (a central hall/tower).
  const { cx, cy, width } = roofMetrics(roof);
  const w = width * 0.3;
  const h = width * 0.4;
  g.fillStyle(darken(s.tint, 0.18), s.fillAlpha);
  g.fillRect(cx - w * 0.5, cy - h, w, h);
  g.lineStyle(1.5, s.outline, s.outlineAlpha);
  g.strokeRect(cx - w * 0.5, cy - h, w, h);
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
