import type Phaser from 'phaser';

import type { BuildingRole } from './buildingRole';

// Per-role COMPLETED-building silhouettes for M7 building-visuals slice 1.
// Each draw fn paints an original procedural shape entirely within the
// building's footprint RECT (x, y, w, h in pixels) — the selection ring,
// footprint outline, and HP-bar geometry all assume the building occupies
// exactly that rect, so crossing it would break those overlays. Body fill =
// owner `tint`; details = a darkened tint. Pure per-frame draw, no random/time.
//
// Construction + memory (ghost) states are role-AGNOSTIC and handled in
// buildingRenderer.ts; only the completed look varies by role here. Deferred
// (M7): per-building (vs per-role) silhouettes, rubble/damage states, per-civ
// architecture, a construction progress fill.

export interface SilhouetteContext {
  g: Phaser.GameObjects.Graphics;
  // Footprint rect in pixels.
  x: number;
  y: number;
  w: number;
  h: number;
  tint: number;
  outline: number;
  fillAlpha: number;
  outlineAlpha: number;
}

// Darken a tint toward black by `factor` (0 = unchanged, 1 = black). Pure
// channel math (mirrors unitRenderer.darken).
export function darken(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * (1 - factor));
  const gC = Math.round(((tint >> 8) & 0xff) * (1 - factor));
  const b = Math.round((tint & 0xff) * (1 - factor));
  return (r << 16) | (gC << 8) | b;
}

// Mid-tone between two channels-packed colours (for soft accents).
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

// A filled+stroked rounded body rect with a small inset, used by most roles as
// the wall mass. Returns the inner body rect so callers can place a roof/details
// relative to it. The body never reaches the rect edge (keeps strokes inside).
function bodyRect(
  ctx: SilhouetteContext,
  insetX: number,
  insetTop: number,
  insetBottom: number,
  radius: number,
): { bx: number; by: number; bw: number; bh: number } {
  const { g, x, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const bx = x + insetX;
  const by = y + insetTop;
  const bw = Math.max(4, w - insetX * 2);
  const bh = Math.max(4, h - insetTop - insetBottom);
  g.fillStyle(tint, fillAlpha);
  g.fillRoundedRect(bx, by, bw, bh, radius);
  g.lineStyle(2, outline, outlineAlpha);
  g.strokeRoundedRect(bx, by, bw, bh, radius);
  return { bx, by, bw, bh };
}

// A pitched (gable) roof triangle sitting on top of a body. Drawn from the body
// top up to a peak, clamped to the rect top.
function gableRoof(ctx: SilhouetteContext, body: ReturnType<typeof bodyRect>): void {
  const { g, y, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const roof = darken(tint, 0.42);
  const baseY = body.by + 1;
  const peakY = Math.max(y + 1, body.by - Math.min(body.bh * 0.7, body.bw * 0.45));
  const leftX = body.bx;
  const rightX = body.bx + body.bw;
  const centerX = body.bx + body.bw * 0.5;
  g.fillStyle(roof, fillAlpha);
  g.fillTriangle(leftX, baseY, centerX, peakY, rightX, baseY);
  g.lineStyle(2, outline, outlineAlpha);
  g.strokeTriangle(leftX, baseY, centerX, peakY, rightX, baseY);
}

// A small door notch centred on the body bottom (civilian/economy read).
function centeredDoor(ctx: SilhouetteContext, body: ReturnType<typeof bodyRect>): void {
  const { g, tint, fillAlpha } = ctx;
  const dw = Math.max(3, body.bw * 0.2);
  const dh = Math.max(4, body.bh * 0.4);
  g.fillStyle(darken(tint, 0.55), fillAlpha);
  g.fillRoundedRect(body.bx + (body.bw - dw) * 0.5, body.by + body.bh - dh, dw, dh, 1.5);
}

// Battlement merlon notches along the top edge of a body rect (defensive read).
// Draws `count` small dark blocks rising above the body top, clamped to the rect.
function merlons(
  ctx: SilhouetteContext,
  body: ReturnType<typeof bodyRect>,
  count: number,
): void {
  const { g, y, tint, fillAlpha } = ctx;
  const merlonColor = darken(tint, 0.3);
  const slot = body.bw / (count * 2 - 1);
  const mh = Math.min(slot, body.by - y - 1, body.bh * 0.3);
  if (mh <= 0.5) {
    return;
  }
  g.fillStyle(merlonColor, fillAlpha);
  for (let i = 0; i < count; i += 1) {
    const mx = body.bx + i * slot * 2;
    g.fillRect(mx, body.by - mh, slot, mh + 1);
  }
}

function drawTownCenter(ctx: SilhouetteContext): void {
  // Landmark hall: a wide central body with a gable roof, flanked by two corner
  // posts/turrets so it reads as the biggest, most-structured building.
  const { g, x, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const postW = Math.max(4, w * 0.16);
  const postH = Math.max(6, h * 0.62);
  const postTop = y + h - postH - Math.max(2, h * 0.06);
  g.fillStyle(darken(tint, 0.22), fillAlpha);
  g.fillRoundedRect(x + w * 0.04, postTop, postW, postH, 2);
  g.fillRoundedRect(x + w - w * 0.04 - postW, postTop, postW, postH, 2);
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokeRoundedRect(x + w * 0.04, postTop, postW, postH, 2);
  g.strokeRoundedRect(x + w - w * 0.04 - postW, postTop, postW, postH, 2);
  const body = bodyRect(ctx, w * 0.2, h * 0.34, h * 0.12, 3);
  gableRoof(ctx, body);
  centeredDoor(ctx, body);
}

function drawFortress(ctx: SilhouetteContext): void {
  // Castle: a tall solid keep with a crenellated (merlon) top, no roof — reads
  // as a stone fortress rather than a house.
  const body = bodyRect(ctx, ctx.w * 0.16, ctx.h * 0.24, ctx.h * 0.08, 2);
  merlons(ctx, body, 4);
  centeredDoor(ctx, body);
}

function drawWonder(ctx: SilhouetteContext): void {
  // Grand monument: a body topped with a large semicircle DOME + a spire pip.
  const { g, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const body = bodyRect(ctx, ctx.w * 0.2, ctx.h * 0.46, ctx.h * 0.1, 3);
  const domeCx = body.bx + body.bw * 0.5;
  const domeR = Math.min(body.bw * 0.5, body.by - ctx.y - 3);
  if (domeR > 1) {
    g.fillStyle(darken(tint, 0.18), fillAlpha);
    g.beginPath();
    g.arc(domeCx, body.by, domeR, Math.PI, 0);
    g.fillPath();
    g.lineStyle(2, outline, outlineAlpha);
    g.beginPath();
    g.arc(domeCx, body.by, domeR, Math.PI, 0);
    g.strokePath();
    // spire pip on top of the dome.
    g.fillStyle(outline, fillAlpha);
    g.fillCircle(domeCx, body.by - domeR, Math.max(1.5, domeR * 0.16));
  }
}

function drawHouse(ctx: SilhouetteContext): void {
  // Simple home: small body + pitched roof + door.
  const body = bodyRect(ctx, ctx.w * 0.18, ctx.h * 0.4, ctx.h * 0.12, 2);
  gableRoof(ctx, body);
  centeredDoor(ctx, body);
}

function drawMill(ctx: SilhouetteContext): void {
  // Windmill: a body + a four-blade cross over a hub (the unmistakable mill
  // read). Blades stay within the rect.
  const { g, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const body = bodyRect(ctx, ctx.w * 0.26, ctx.h * 0.36, ctx.h * 0.1, 2);
  const hubX = body.bx + body.bw * 0.5;
  const hubY = body.by;
  const arm = Math.min(body.bw * 0.6, hubY - ctx.y - 2, ctx.h * 0.34);
  if (arm > 1) {
    g.lineStyle(2.5, darken(tint, 0.3), outlineAlpha);
    // an X of four blades.
    g.lineBetween(hubX - arm * 0.7, hubY - arm * 0.7, hubX + arm * 0.7, hubY + arm * 0.7);
    g.lineBetween(hubX - arm * 0.7, hubY + arm * 0.7, hubX + arm * 0.7, hubY - arm * 0.7);
    g.fillStyle(outline, fillAlpha);
    g.fillCircle(hubX, hubY, Math.max(1.5, arm * 0.16));
  }
}

function drawFarm(ctx: SilhouetteContext): void {
  // Tilled field: a flat plot (no roof) with furrow rows — reads as cropland.
  const { g, x, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const inset = Math.max(2, w * 0.12);
  const px = x + inset;
  const py = y + inset;
  const pw = Math.max(4, w - inset * 2);
  const ph = Math.max(4, h - inset * 2);
  g.fillStyle(mix(tint, 0x000000, 0.1), fillAlpha);
  g.fillRect(px, py, pw, ph);
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokeRect(px, py, pw, ph);
  // furrow rows.
  const rows = 3;
  g.lineStyle(1.5, darken(tint, 0.32), outlineAlpha);
  for (let i = 1; i <= rows; i += 1) {
    const ry = py + (ph * i) / (rows + 1);
    g.lineBetween(px + 1, ry, px + pw - 1, ry);
  }
}

function drawDropSite(ctx: SilhouetteContext): void {
  // Open resource camp (lumber/mining): a low body, a lean-to slanted roof, and
  // a stockpile mound beside it.
  const { g, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const body = bodyRect(ctx, w * 0.16, h * 0.42, h * 0.12, 2);
  // lean-to roof: a slanted quad approximated by a triangle from body top.
  const roof = darken(tint, 0.4);
  g.fillStyle(roof, fillAlpha);
  const ry = Math.max(y + 1, body.by - body.bh * 0.5);
  g.fillTriangle(body.bx, body.by + 1, body.bx + body.bw, body.by + 1, body.bx + body.bw, ry);
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokeTriangle(body.bx, body.by + 1, body.bx + body.bw, body.by + 1, body.bx + body.bw, ry);
  // stockpile mound: a dark half-ellipse at the body base, inside the rect.
  const moundW = Math.min(body.bw * 0.5, w * 0.4);
  const moundH = Math.max(3, h * 0.16);
  g.fillStyle(darken(tint, 0.5), fillAlpha);
  g.fillEllipse(body.bx + moundW * 0.6, body.by + body.bh - moundH * 0.2, moundW, moundH);
}

function drawMilitary(ctx: SilhouetteContext): void {
  // Training hall: a sturdy body + a low flat roof band + a banner pole with a
  // flag (the universal "produces military here" read across barracks / stable /
  // archery-range / siege-workshop).
  const { g, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const body = bodyRect(ctx, w * 0.14, h * 0.32, h * 0.1, 2);
  // flat roof band.
  g.fillStyle(darken(tint, 0.36), fillAlpha);
  const bandH = Math.max(3, body.bh * 0.22);
  g.fillRect(body.bx, body.by, body.bw, bandH);
  g.lineStyle(1.5, outline, outlineAlpha);
  g.strokeRect(body.bx, body.by, body.bw, bandH);
  // banner pole + flag near the top-left, kept inside the rect.
  const poleX = body.bx + body.bw * 0.5;
  const poleTop = Math.max(y + 1, body.by - body.bh * 0.55);
  g.lineStyle(2, outline, outlineAlpha);
  g.lineBetween(poleX, poleTop, poleX, body.by);
  const flagW = Math.min(body.bw * 0.3, w * 0.22);
  const flagH = Math.max(3, (body.by - poleTop) * 0.6);
  g.fillStyle(mix(tint, 0xffffff, 0.25), fillAlpha);
  g.fillTriangle(poleX, poleTop, poleX + flagW, poleTop + flagH * 0.5, poleX, poleTop + flagH);
}

function drawBlacksmith(ctx: SilhouetteContext): void {
  // Forge: a body + a chimney stub (top-right) + an anvil glyph on top.
  const { g, y, w, h, tint, outline, fillAlpha } = ctx;
  const body = bodyRect(ctx, w * 0.16, h * 0.36, h * 0.1, 2);
  // chimney.
  const chimW = Math.max(3, body.bw * 0.16);
  const chimH = Math.max(4, body.by - y - 2);
  g.fillStyle(darken(tint, 0.45), fillAlpha);
  g.fillRect(body.bx + body.bw - chimW - 2, body.by - chimH, chimW, chimH + 1);
  // anvil: a small dark T/anvil shape near the body top-left.
  const ax = body.bx + body.bw * 0.36;
  const ay = body.by - Math.max(2, body.bh * 0.18);
  const aw = Math.min(body.bw * 0.4, w * 0.3);
  g.fillStyle(outline, fillAlpha);
  g.fillRect(ax - aw * 0.5, ay - 2, aw, Math.max(2, h * 0.07));
  g.fillRect(ax - aw * 0.16, ay, aw * 0.32, Math.max(2, h * 0.1));
}

function drawMarket(ctx: SilhouetteContext): void {
  // Open-air stall: a low body + a striped awning band on top + two posts —
  // reads as a trade stall, distinct from a closed production hall.
  const { g, y, w, h, tint, outline, fillAlpha, outlineAlpha } = ctx;
  const body = bodyRect(ctx, w * 0.14, h * 0.46, h * 0.1, 2);
  // awning: a band above the body split into stripes.
  const awnY = Math.max(y + 1, body.by - body.bh * 0.5);
  const awnH = body.by - awnY;
  if (awnH > 1) {
    const stripes = 4;
    const sw = body.bw / stripes;
    for (let i = 0; i < stripes; i += 1) {
      g.fillStyle(i % 2 === 0 ? mix(tint, 0xffffff, 0.3) : darken(tint, 0.3), fillAlpha);
      g.fillRect(body.bx + i * sw, awnY, sw + 0.5, awnH);
    }
    g.lineStyle(1.5, outline, outlineAlpha);
    g.strokeRect(body.bx, awnY, body.bw, awnH);
  }
}

function drawMonastery(ctx: SilhouetteContext): void {
  // Chapel: a body + a steep roof + a cross finial on top (the faith read).
  const { g, y, outline, outlineAlpha } = ctx;
  const body = bodyRect(ctx, ctx.w * 0.24, ctx.h * 0.42, ctx.h * 0.1, 2);
  gableRoof(ctx, body);
  // cross finial above the roof peak, inside the rect.
  const cx = body.bx + body.bw * 0.5;
  const peakY = Math.max(y + 1, body.by - Math.min(body.bh * 0.7, body.bw * 0.45));
  const crossTop = Math.max(y + 1, peakY - ctx.h * 0.14);
  g.lineStyle(2, outline, outlineAlpha);
  g.lineBetween(cx, crossTop, cx, peakY);
  const arm = Math.min(ctx.w * 0.12, (peakY - crossTop) * 0.6);
  g.lineBetween(cx - arm, crossTop + (peakY - crossTop) * 0.35, cx + arm, crossTop + (peakY - crossTop) * 0.35);
}

function drawTower(ctx: SilhouetteContext): void {
  // Tall narrow watch tower: a slim body filling most of the (1x1) cell + a
  // crenellated cap. Distinct from a wall by its height and slimness.
  const body = bodyRect(ctx, ctx.w * 0.28, ctx.h * 0.2, ctx.h * 0.06, 1.5);
  merlons(ctx, body, 2);
}

function drawWall(ctx: SilhouetteContext): void {
  // Low battlement segment: a short body with merlon notches, no roof. Lower
  // than a tower so a wall line reads as a barrier, not a row of towers.
  const body = bodyRect(ctx, ctx.w * 0.06, ctx.h * 0.42, ctx.h * 0.08, 1.5);
  merlons(ctx, body, 3);
}

const SILHOUETTE_BY_ROLE: Record<BuildingRole, (ctx: SilhouetteContext) => void> = {
  'town-center': drawTownCenter,
  fortress: drawFortress,
  wonder: drawWonder,
  house: drawHouse,
  mill: drawMill,
  farm: drawFarm,
  'drop-site': drawDropSite,
  military: drawMilitary,
  blacksmith: drawBlacksmith,
  market: drawMarket,
  monastery: drawMonastery,
  tower: drawTower,
  wall: drawWall,
};

// Draw the completed-building silhouette for `role` inside the footprint rect.
export function drawBuildingSilhouette(role: BuildingRole, ctx: SilhouetteContext): void {
  SILHOUETTE_BY_ROLE[role](ctx);
}
