import Phaser from 'phaser';

import type { ProjectedEntityView, UnitType } from '../../../game/simulation/types';

// M7 graphics (north star: an AoE2-HD-quality look from ORIGINAL/procedural
// art only — no copyrighted assets): units used to render as a single flat
// tinted CIRCLE (`entityLayer.fillCircle`), so a villager, a knight, and a
// mangonel were indistinguishable except by owner colour. This renderer draws
// a READABLE PER-ROLE procedural silhouette (Phaser fill primitives) oriented
// toward the unit's movement FACING, keeping the existing owner-colour tint.
//
// Extracted from GameScene.renderState (mirrors terrainRenderer / buildingRenderer
// / worldLayers) so the pinned legacy GameScene file stays net-zero on LOC and
// the shape + facing logic is unit-testable without a Phaser stage.
//
// Deferred to a later slice (noted in roadmap M7): a walk/idle ANIMATION cycle,
// sprite assets, and per-UNIT (vs per-role) silhouettes. Facing here is derived
// purely render-side (no sim/bridge change) from the per-tick projected-position
// delta the scene already tracks for interpolation.

// 7 roles cover all 34 UnitTypes. Grouped by role because 34 distinct
// silhouettes would be unreadable at this zoom; role is the AoE2-meaningful
// glance distinction (villager vs foot-melee vs foot-ranged vs mounted vs
// mounted-ranged vs machine vs monk).
export type UnitRole =
  | 'villager'
  | 'infantry'
  | 'archer'
  | 'cavalry'
  | 'cavalry-archer'
  | 'siege'
  | 'monk';

// Exhaustive, render-OWNED mapping. The `satisfies Record<UnitType, UnitRole>`
// makes a newly-added UnitType a compile error here (same guard style as
// unitTypeMap.ts). Membership matches the sim's combat classes where they
// agree, but stays independent on purpose — `skirmisher` is foot-ranged yet is
// NOT in the sim's ARCHER_LINE_UNITS, and the visual must not couple to combat
// semantics.
const UNIT_ROLES = {
  villager: 'villager',
  // Infantry (foot melee).
  militia: 'infantry',
  'man-at-arms': 'infantry',
  'long-swordsman': 'infantry',
  'two-handed-swordsman': 'infantry',
  champion: 'infantry',
  spearman: 'infantry',
  pikeman: 'infantry',
  halberdier: 'infantry',
  // Archer (foot ranged).
  archer: 'archer',
  crossbowman: 'archer',
  arbalest: 'archer',
  skirmisher: 'archer',
  longbowman: 'archer',
  'elite-longbowman': 'archer',
  // Cavalry (mounted melee).
  scout: 'cavalry',
  'light-cavalry': 'cavalry',
  hussar: 'cavalry',
  camel: 'cavalry',
  'heavy-camel': 'cavalry',
  knight: 'cavalry',
  cavalier: 'cavalry',
  paladin: 'cavalry',
  // Cavalry archer (mounted ranged).
  'cavalry-archer': 'cavalry-archer',
  'heavy-cavalry-archer': 'cavalry-archer',
  // Siege (machines).
  mangonel: 'siege',
  onager: 'siege',
  scorpion: 'siege',
  'heavy-scorpion': 'siege',
  'battering-ram': 'siege',
  'siege-ram': 'siege',
  'bombard-cannon': 'siege',
  trebuchet: 'siege',
  // Monk.
  monk: 'monk',
} as const satisfies Record<UnitType, UnitRole>;

export function unitRole(unitType: UnitType): UnitRole {
  return UNIT_ROLES[unitType];
}

// Minimum per-tick displacement (in cells) before we treat a unit as MOVING
// and orient it toward the delta. Below this it is idle/jitter and gets the
// default rest orientation — we do NOT fabricate a heading from noise.
const FACING_MOVE_EPSILON = 0.02;

// Heading (radians, screen space: +x right, +y down) from the previous to the
// current projected position. Returns null when there is no previous sample or
// the movement is below the idle threshold, so the caller can fall back to a
// consistent resting orientation. Pure.
export function unitFacingRadians(
  previous: { x: number; y: number } | undefined,
  current: { x: number; y: number },
  alpha: number,
): number | null {
  if (!previous || alpha <= 0) {
    return null;
  }
  // `current` is the INTERPOLATED position (= previous + alpha·(rawCurrent −
  // previous)), so hypot(dx,dy) = alpha·|raw per-tick displacement|. Gate on the
  // RAW per-tick displacement — |Δ| < epsilon ⟺ hypot < epsilon·alpha — so the
  // idle classification is alpha-INDEPENDENT. (Gating the interpolated magnitude
  // directly would read a moving unit "idle" for the small-alpha early frames of
  // every tick, flickering its facing to the rest pose; 3-CLI review.) The angle
  // atan2(dy,dx) is itself alpha-invariant (a positive scalar doesn't rotate it).
  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  if (Math.hypot(dx, dy) < FACING_MOVE_EPSILON * alpha) {
    return null;
  }
  return Math.atan2(dy, dx);
}

// Resting orientation for idle units: facing down-and-right (the conventional
// AoE2 three-quarter rest pose). Used whenever unitFacingRadians returns null.
const DEFAULT_FACING_RADIANS = Math.PI / 2.5;

export interface UnitRendererDeps {
  graphics: Phaser.GameObjects.Graphics;
  cellSize: number;
}

export interface UnitRenderer {
  // Draw the unit's role silhouette centred on its cell, oriented toward
  // `facingRadians` (radians, screen space; pass DEFAULT via null at the call
  // site by resolving it first). `fillAlpha` is threaded for parity with the
  // memory-entity path (units are never fog-memory today, so it is 1).
  drawUnit(
    entity: ProjectedEntityView,
    px: number,
    py: number,
    facingRadians: number | null,
    fillAlpha: number,
  ): void;
}

// Darken a tint toward black by `factor` (0 = unchanged, 1 = black) for the
// outline, so the body reads against same-hue terrain. Pure channel math.
function darken(tint: number, factor: number): number {
  const r = Math.round(((tint >> 16) & 0xff) * (1 - factor));
  const g = Math.round(((tint >> 8) & 0xff) * (1 - factor));
  const b = Math.round((tint & 0xff) * (1 - factor));
  return (r << 16) | (g << 8) | b;
}

// v0.1.102 (M7 graphics): a subtle ground shadow under every unit. Black,
// translucent — reads as the unit standing ON the terrain instead of a flat
// silhouette painted over it.
export const UNIT_SHADOW_COLOR = 0x000000;
export const UNIT_SHADOW_ALPHA = 0.2;

// The ground-shadow ellipse for a unit centred at (cx, cy) with the given
// bounding radius: a flattened ellipse nudged just below centre. Every
// bounding-box corner stays within the bounding radius so the health-bar /
// selection-ring geometry (which assumes that circle) is unchanged. Pure.
export function unitShadowEllipse(
  cx: number,
  cy: number,
  boundingRadius: number,
): { x: number; y: number; width: number; height: number } {
  const width = boundingRadius * 1.5; // 0.75 × the bounding diameter
  return {
    x: cx,
    y: cy + boundingRadius * 0.15, // nudged below centre → reads as ground
    width,
    height: width * 0.34, // flattened
  };
}

export function createUnitRenderer(deps: UnitRendererDeps): UnitRenderer {
  const { graphics, cellSize } = deps;

  function drawUnit(
    entity: ProjectedEntityView,
    px: number,
    py: number,
    facingRadians: number | null,
    fillAlpha: number,
  ): void {
    const cx = px + cellSize * 0.5;
    const cy = py + cellSize * 0.5;
    // The bounding radius the rest of the render pipeline assumes for a unit
    // (health bar top, selection ring). Every primitive stays inside it.
    const r = cellSize * entity.size * 0.5;
    const angle = facingRadians ?? DEFAULT_FACING_RADIANS;
    // Forward (facing) + perpendicular unit vectors in screen space.
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    const tint = entity.tint;
    const outline = darken(tint, 0.55);
    const outlineAlpha = Math.min(1, fillAlpha);

    // Ground shadow FIRST so the body silhouette draws on top of it.
    const shadow = unitShadowEllipse(cx, cy, r);
    graphics.fillStyle(UNIT_SHADOW_COLOR, UNIT_SHADOW_ALPHA * fillAlpha);
    graphics.fillEllipse(shadow.x, shadow.y, shadow.width, shadow.height);

    const role = unitRole(entity.entityType as UnitType);
    switch (role) {
      case 'villager':
        drawVillager(cx, cy, r, fx, fy, tint, outline, fillAlpha, outlineAlpha);
        break;
      case 'infantry':
        drawInfantry(cx, cy, r, fx, fy, tint, outline, fillAlpha, outlineAlpha);
        break;
      case 'archer':
        drawArcher(cx, cy, r, fx, fy, tint, outline, fillAlpha, outlineAlpha);
        break;
      case 'cavalry':
        drawCavalry(cx, cy, r, fx, fy, angle, tint, outline, fillAlpha, outlineAlpha, false);
        break;
      case 'cavalry-archer':
        drawCavalry(cx, cy, r, fx, fy, angle, tint, outline, fillAlpha, outlineAlpha, true);
        break;
      case 'siege':
        drawSiege(cx, cy, r, fx, fy, tint, outline, fillAlpha, outlineAlpha);
        break;
      case 'monk':
        drawMonk(cx, cy, r, tint, outline, fillAlpha, outlineAlpha);
        break;
    }
  }

  // ---- per-role shape helpers. Each keeps every point within radius r of
  // (cx, cy). Body = tint; details = darkened outline. ----

  function drawVillager(
    cx: number, cy: number, r: number, fx: number, fy: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
  ): void {
    // Small rounded body + a short tool tick on the facing side (civilian).
    const body = r * 0.62;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillCircle(cx, cy, body);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    graphics.strokeCircle(cx, cy, body);
    // tool: a stub line from the body edge outward (not a weapon — short).
    graphics.lineStyle(2, outline, outlineAlpha);
    graphics.lineBetween(
      cx + fx * body * 0.5, cy + fy * body * 0.5,
      cx + fx * r * 0.92, cy + fy * r * 0.92,
    );
  }

  function drawInfantry(
    cx: number, cy: number, r: number, fx: number, fy: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
  ): void {
    // A shield-ish rounded square body + a blade line pointing forward.
    const half = r * 0.6;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillRoundedRect(cx - half, cy - half, half * 2, half * 2, half * 0.5);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    graphics.strokeCircle(cx, cy, r * 0.05); // tiny center pip for the shield boss read
    // blade: a line from center forward to the rim.
    graphics.lineStyle(2.5, outline, outlineAlpha);
    graphics.lineBetween(cx, cy, cx + fx * r * 0.96, cy + fy * r * 0.96);
  }

  function drawArcher(
    cx: number, cy: number, r: number, fx: number, fy: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
  ): void {
    // A slim body + a bow ARC on the facing side (foot ranged).
    const body = r * 0.55;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillCircle(cx, cy, body);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    graphics.strokeCircle(cx, cy, body);
    // bow: an arc centred on the facing side, drawn as a stroked partial circle.
    const bowCx = cx + fx * r * 0.5;
    const bowCy = cy + fy * r * 0.5;
    const base = Math.atan2(fy, fx);
    graphics.lineStyle(2, outline, outlineAlpha);
    graphics.beginPath();
    graphics.arc(bowCx, bowCy, r * 0.45, base - Math.PI / 2, base + Math.PI / 2);
    graphics.strokePath();
  }

  function drawCavalry(
    cx: number, cy: number, r: number, fx: number, fy: number, angle: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
    mountedArcher: boolean,
  ): void {
    // An elongated mount body (ellipse along the facing axis) + a rider bump.
    // The ellipse is drawn axis-aligned then we accept the read at the default
    // three-quarter angle; we keep length<=2r so it stays inside the circle.
    const len = r * 1.7;
    const wid = r * 1.0;
    // Approximate orientation by choosing width/height from the facing so a
    // mostly-horizontal heading reads wide and a mostly-vertical reads tall.
    const horiz = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle));
    const ew = horiz ? len : wid;
    const eh = horiz ? wid : len;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillEllipse(cx, cy, Math.min(ew, r * 2), Math.min(eh, r * 2));
    // rider: a small bump slightly behind center, drawn as a filled circle.
    graphics.fillStyle(darken(tint, 0.18), fillAlpha);
    graphics.fillCircle(cx - fx * r * 0.25, cy - fy * r * 0.25, r * 0.42);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    // forward tick: lance (melee) or bow arc (mounted archer).
    if (mountedArcher) {
      const base = Math.atan2(fy, fx);
      graphics.lineStyle(2, outline, outlineAlpha);
      graphics.beginPath();
      graphics.arc(cx + fx * r * 0.55, cy + fy * r * 0.55, r * 0.4, base - Math.PI / 2, base + Math.PI / 2);
      graphics.strokePath();
    } else {
      graphics.lineStyle(2, outline, outlineAlpha);
      graphics.lineBetween(cx, cy, cx + fx * r * 0.95, cy + fy * r * 0.95);
    }
  }

  function drawSiege(
    cx: number, cy: number, r: number, fx: number, fy: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
  ): void {
    // A boxy chassis (rect) + a wheel pair + an arm/barrel pointing forward
    // (machine; the biggest, most rectilinear silhouette).
    const half = r * 0.62;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillRect(cx - half, cy - half * 0.72, half * 2, half * 1.44);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    // wheels: two dark circles at the bottom corners.
    graphics.fillStyle(outline, fillAlpha);
    graphics.fillCircle(cx - half * 0.6, cy + half * 0.72, r * 0.22);
    graphics.fillCircle(cx + half * 0.6, cy + half * 0.72, r * 0.22);
    // arm/barrel: a thick line from center forward to the rim.
    graphics.lineStyle(3, outline, outlineAlpha);
    graphics.lineBetween(cx, cy, cx + fx * r * 0.95, cy + fy * r * 0.95);
  }

  function drawMonk(
    cx: number, cy: number, r: number,
    tint: number, outline: number, fillAlpha: number, outlineAlpha: number,
  ): void {
    // A hooded robe body (triangle, point up) + a cross tick. No facing weapon
    // (monks are unarmed); orientation-independent so it reads the same idle.
    const top = cy - r * 0.85;
    const baseY = cy + r * 0.7;
    const halfW = r * 0.7;
    graphics.fillStyle(tint, fillAlpha);
    graphics.fillTriangle(cx, top, cx - halfW, baseY, cx + halfW, baseY);
    graphics.lineStyle(1.5, outline, outlineAlpha);
    // cross: a small vertical + horizontal segment near the top.
    graphics.lineStyle(2, outline, outlineAlpha);
    const crossCy = cy - r * 0.15;
    graphics.lineBetween(cx, crossCy - r * 0.4, cx, crossCy + r * 0.2);
    graphics.lineBetween(cx - r * 0.28, crossCy - r * 0.12, cx + r * 0.28, crossCy - r * 0.12);
  }

  return { drawUnit };
}
