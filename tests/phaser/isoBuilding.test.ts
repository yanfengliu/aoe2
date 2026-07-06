import { describe, expect, it } from 'vitest';

import { drawIsoBuilding, isoBuildingPolys, wallWindowPolys } from '../../src/phaser/scenes/gameScene/isoBuilding';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

interface DrawCall {
  op: string;
  pointCount?: number;
}
function createIsoBuildingSpy() {
  const calls: DrawCall[] = [];
  const graphics = {
    fillStyle: () => {},
    lineStyle: () => {},
    fillPoints: (pts: Array<{ x: number; y: number }>) => calls.push({ op: 'fillPoints', pointCount: pts.length }),
    strokePoints: (pts: Array<{ x: number; y: number }>) => calls.push({ op: 'strokePoints', pointCount: pts.length }),
  } as unknown as Phaser.GameObjects.Graphics;
  return { graphics, calls };
}
const STYLE = { tint: 0x88aa44, outline: 0x223311, fillAlpha: 1, outlineAlpha: 1 };

// A 2x2 building footprint anchored at cell (10,10). Ground diamond corners are
// the iso projection of the footprint's four cell corners.
function footprint2x2() {
  return {
    top: worldToIso(10, 10),
    right: worldToIso(12, 10),
    bottom: worldToIso(12, 12),
    left: worldToIso(10, 12),
  };
}

describe('isoBuildingPolys — 3/4-view iso building volume geometry', () => {
  const corners = footprint2x2();
  const HEIGHT = 40;
  const polys = isoBuildingPolys(corners, HEIGHT);

  it('returns ground, roof, left-face and right-face polygons', () => {
    expect(polys.ground).toHaveLength(4);
    expect(polys.roof).toHaveLength(4);
    expect(polys.leftFace).toHaveLength(4);
    expect(polys.rightFace).toHaveLength(4);
  });

  it('roof is the ground diamond lifted straight up by the height (screen-y minus H)', () => {
    // Roof corners share the ground corners' x and are exactly HEIGHT above.
    expect(polys.roof[0]).toEqual({ x: corners.top.x, y: corners.top.y - HEIGHT });
    expect(polys.roof[2]).toEqual({ x: corners.bottom.x, y: corners.bottom.y - HEIGHT });
  });

  it('the two visible wall faces are the lower diamond edges extruded upward', () => {
    // Left face spans the left->bottom ground edge and its lifted copy (a
    // parallelogram): ground left, ground bottom, roof bottom, roof left.
    expect(polys.leftFace).toEqual([
      corners.left,
      corners.bottom,
      { x: corners.bottom.x, y: corners.bottom.y - HEIGHT },
      { x: corners.left.x, y: corners.left.y - HEIGHT },
    ]);
    // Right face spans the bottom->right ground edge and its lifted copy.
    expect(polys.rightFace).toEqual([
      corners.bottom,
      corners.right,
      { x: corners.right.x, y: corners.right.y - HEIGHT },
      { x: corners.bottom.x, y: corners.bottom.y - HEIGHT },
    ]);
  });

  it('all wall/roof geometry sits at or above the ground diamond (nothing sinks below)', () => {
    const groundMaxY = Math.max(...polys.ground.map((p) => p.y));
    for (const poly of [polys.roof, polys.leftFace, polys.rightFace]) {
      for (const point of poly) {
        expect(point.y).toBeLessThanOrEqual(groundMaxY + 0.001);
      }
    }
  });
});

describe('wallWindowPolys — facade windows', () => {
  const corners = footprint2x2();
  const H = 60;
  const leftBaseA = corners.left;
  const leftBaseB = corners.bottom;

  // Recover a window point's lift above the (sloped) base edge: solve the base
  // fraction t from the point's x, then subtract the base-edge y at that t.
  const liftOf = (
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number => {
    const t = (p.x - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t - p.y;
  };

  it('returns a row of 4-point window quads along a wall face', () => {
    const wins = wallWindowPolys(leftBaseA, leftBaseB, H);
    expect(wins.length).toBeGreaterThanOrEqual(2);
    for (const w of wins) expect(w).toHaveLength(4);
  });

  it('scales the window count with the wall-edge length', () => {
    const shortWins = wallWindowPolys(worldToIso(10, 11), worldToIso(11, 11), H); // 1-cell edge
    const longWins = wallWindowPolys(worldToIso(10, 16), worldToIso(16, 16), H); // 6-cell edge
    expect(longWins.length).toBeGreaterThan(shortWins.length);
  });

  it('sits every window in the upper wall band (above the door, below the roof)', () => {
    const wins = wallWindowPolys(leftBaseA, leftBaseB, H);
    for (const w of wins) {
      for (const p of w) {
        const lift = liftOf(p, leftBaseA, leftBaseB);
        expect(lift).toBeGreaterThanOrEqual(0.5 * H);
        expect(lift).toBeLessThanOrEqual(0.75 * H);
      }
    }
  });

  it('keeps every window within the wall face horizontally (base fraction in [0,1])', () => {
    const wins = wallWindowPolys(leftBaseA, leftBaseB, H);
    for (const w of wins) {
      for (const p of w) {
        const t = (p.x - leftBaseA.x) / (leftBaseB.x - leftBaseA.x);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(t).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('drawIsoBuilding — front-wall facade door + windows', () => {
  const corners = footprint2x2();

  it('draws a doorway + facade windows on a tall-enough building', () => {
    const spy = createIsoBuildingSpy();
    drawIsoBuilding(spy.graphics, corners, 60, STYLE);
    // ground + left wall + right wall + DOOR + 2 left windows + 2 right windows
    // + roof = 9 filled polygons (the 2x2 footprint yields 2 windows per face).
    expect(spy.calls.filter((c) => c.op === 'fillPoints').length).toBe(9);
  });

  it('omits the door and windows on a short (flat / low) building', () => {
    const spy = createIsoBuildingSpy();
    drawIsoBuilding(spy.graphics, corners, 10, STYLE);
    // ground + left + right + roof = 4 (no door, no windows)
    expect(spy.calls.filter((c) => c.op === 'fillPoints').length).toBe(4);
  });
});
