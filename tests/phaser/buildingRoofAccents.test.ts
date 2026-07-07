import { describe, expect, it } from 'vitest';

import { drawBuildingRoofAccent } from '../../src/phaser/scenes/gameScene/buildingRoofAccents';
import type { IsoPoint } from '../../src/phaser/scenes/gameScene/isoBuilding';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

const STYLE = { tint: 0xc8a44a, outline: 0x2a2410, fillAlpha: 1, outlineAlpha: 1 };

// Records every y-coordinate any draw op emits (so we can measure how high an
// accent rises above the roof) and whether an axis-aligned fillRect billboard
// was used.
function createAccentSpy() {
  const ys: number[] = [];
  let rects = 0;
  let polys = 0;
  let lines = 0;
  const push = (...vals: number[]) => ys.push(...vals);
  const g = {
    fillStyle: () => {},
    lineStyle: () => {},
    beginPath: () => {},
    fillPath: () => {},
    strokePath: () => {},
    fillRect: (_x: number, y: number, _w: number, h: number) => {
      rects += 1;
      push(y, y + h);
    },
    strokeRect: (_x: number, y: number, _w: number, h: number) => push(y, y + h),
    fillPoints: (pts: IsoPoint[]) => {
      polys += 1;
      push(...pts.map((p) => p.y));
    },
    strokePoints: (pts: IsoPoint[]) => push(...pts.map((p) => p.y)),
    lineBetween: (_x1: number, y1: number, _x2: number, y2: number) => {
      lines += 1;
      push(y1, y2);
    },
    arc: (_x: number, y: number, r: number) => push(y - r, y + r),
    fillCircle: (_x: number, y: number, r: number) => push(y - r, y + r),
    fillTriangle: (_x1: number, y1: number, _x2: number, y2: number, _x3: number, y3: number) =>
      push(y1, y2, y3),
    strokeTriangle: (_x1: number, y1: number, _x2: number, y2: number, _x3: number, y3: number) =>
      push(y1, y2, y3),
  } as unknown as Phaser.GameObjects.Graphics;
  return {
    g,
    ys,
    get rects() {
      return rects;
    },
    get polys() {
      return polys;
    },
    get lines() {
      return lines;
    },
  };
}

// The roof diamond of a footprint x footprint building at cell (10,10), lifted
// 40px. A 4x4 footprint spans 256px on screen — the case where width-scaled
// accents used to balloon.
function roofDiamond(footprint: number): IsoPoint[] {
  const H = 40;
  const lift = (p: IsoPoint): IsoPoint => ({ x: p.x, y: p.y - H });
  return [
    lift(worldToIso(10, 10)),
    lift(worldToIso(10 + footprint, 10)),
    lift(worldToIso(10 + footprint, 10 + footprint)),
    lift(worldToIso(10, 10 + footprint)),
  ];
}

const roofCentreY = (roof: IsoPoint[]): number =>
  (roof[0].y + roof[1].y + roof[2].y + roof[3].y) / 4;

describe('drawBuildingRoofAccent — proportionate accents on large footprints', () => {
  it('draws the Town Center turret as an iso box (fillPoints), not a flat billboard rect', () => {
    const spy = createAccentSpy();
    drawBuildingRoofAccent(spy.g, 'town-center', roofDiamond(4), STYLE);
    expect(spy.rects).toBe(0); // no axis-aligned billboard rectangle
    expect(spy.polys).toBeGreaterThanOrEqual(2); // wall faces + top diamond
  });

  it('adds flanking post strokes to the Town Center roof silhouette', () => {
    const spy = createAccentSpy();
    drawBuildingRoofAccent(spy.g, 'town-center', roofDiamond(4), STYLE);
    expect(spy.lines).toBeGreaterThanOrEqual(4);
  });

  it('caps how high a centre-anchored accent rises on a 4x4 footprint (no ballooning)', () => {
    const roof = roofDiamond(4);
    const cy = roofCentreY(roof);
    // These all used to scale by the full 256px roof width (turret 102px, cross
    // 128px, banner 154px above the roof). Capped, none exceeds ~68px.
    for (const role of ['town-center', 'military', 'monastery', 'wonder', 'mill'] as const) {
      const spy = createAccentSpy();
      drawBuildingRoofAccent(spy.g, role, roof, STYLE);
      const rise = cy - Math.min(...spy.ys);
      expect(rise).toBeGreaterThan(4); // still a visible feature
      expect(rise).toBeLessThanOrEqual(68);
    }
  });

  it('keeps a 4x4 accent no larger than a 3x3 one (scale is capped, not linear)', () => {
    const rise = (footprint: number, role: 'military'): number => {
      const roof = roofDiamond(footprint);
      const spy = createAccentSpy();
      drawBuildingRoofAccent(spy.g, role, roof, STYLE);
      return roofCentreY(roof) - Math.min(...spy.ys);
    };
    // A 4x4 banner must not tower over a 3x3 one — the cap has kicked in for both.
    expect(rise(4, 'military')).toBeCloseTo(rise(3, 'military'), 1);
  });
});
