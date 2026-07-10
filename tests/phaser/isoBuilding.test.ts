import { describe, expect, it } from 'vitest';

import {
  drawIsoBuilding,
  hipRoofFaces,
  isoBuildingPolys,
  pitchedApexPx,
  pitchedRoofDetailSegments,
  roleHasPitchedRoof,
  roofBevelSegments,
  roofTileSegments,
  wallCourseSegments,
  wallWindowPolys,
} from '../../src/phaser/scenes/gameScene/isoBuilding';
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
    lineBetween: () => calls.push({ op: 'lineBetween' }),
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
    // 3 course lines per visible wall face + 5 roof tile seams + 4 bevel/eave cues.
    expect(spy.calls.filter((c) => c.op === 'lineBetween').length).toBe(15);
  });

  it('omits the door and windows on a short (flat / low) building', () => {
    const spy = createIsoBuildingSpy();
    drawIsoBuilding(spy.graphics, corners, 10, STYLE);
    // ground + left + right + roof = 4 (no door, no windows)
    expect(spy.calls.filter((c) => c.op === 'fillPoints').length).toBe(4);
    expect(spy.calls.filter((c) => c.op === 'lineBetween').length).toBe(0);
  });
});

describe('pitched (ridged hip) roof — the "reads as a building" cap', () => {
  const roof = isoBuildingPolys(footprint2x2(), 40).roof; // [top,right,bottom,left]

  it('pitchedApexPx scales with roof width and clamps to a roof (not a spire)', () => {
    expect(pitchedApexPx(120)).toBeCloseTo(120 * 0.16, 5);
    expect(pitchedApexPx(20)).toBe(11); // clamped up (min)
    expect(pitchedApexPx(1000)).toBe(38); // clamped down (max)
  });

  it('lifts a ridge above the flat roof centre with two 5-point side planes', () => {
    const apex = 30;
    const faces = hipRoofFaces(roof, apex);
    const flatCentreY = (roof[0].y + roof[1].y + roof[2].y + roof[3].y) / 4;
    // The ridge MIDPOINT sits exactly `apex` above the flat roof plane (each
    // endpoint is additionally shifted toward its top/bottom eave).
    expect(faces.ridgeBack.y).toBeLessThan(flatCentreY);
    expect(faces.ridgeFront.y).toBeLessThan(flatCentreY);
    const ridgeMidY = (faces.ridgeBack.y + faces.ridgeFront.y) / 2;
    expect(flatCentreY - ridgeMidY).toBeCloseTo(apex, 5);
    // …and the ridge runs along the top↔bottom (screen-vertical) axis.
    expect(faces.ridgeBack.y).toBeLessThan(faces.ridgeFront.y); // back (near top) higher on screen
    // Two pentagon side planes (an eave corner + its two eaves + two ridge ends).
    expect(faces.leftPlane).toHaveLength(5);
    expect(faces.rightPlane).toHaveLength(5);
    // Each plane contains its eave corner and both ridge ends.
    expect(faces.leftPlane).toContainEqual(roof[3]); // left eave
    expect(faces.rightPlane).toContainEqual(roof[1]); // right eave
    expect(faces.leftPlane).toContainEqual(faces.ridgeBack);
    expect(faces.rightPlane).toContainEqual(faces.ridgeFront);
  });

  it('roleHasPitchedRoof: house-like roles pitched, battlement/dome roles flat', () => {
    for (const role of ['town-center', 'house', 'mill', 'military', 'monastery', 'market', 'blacksmith', 'drop-site'] as const) {
      expect(roleHasPitchedRoof(role), `${role} should be pitched`).toBe(true);
    }
    for (const role of ['fortress', 'tower', 'wall', 'wonder', 'farm'] as const) {
      expect(roleHasPitchedRoof(role), `${role} should be flat`).toBe(false);
    }
  });

  it('keeps every hip/course detail line ON the roof, never streaking down the walls', () => {
    // Regression (review 2026-07-10): the detail lines previously ran to the
    // GROUND footprint corners, which sit a full wall-height BELOW the roof
    // eaves, so they streaked across the wall faces. They must terminate on
    // the roof eaves — i.e. no endpoint drops below the lowest roof point.
    const heightPx = 34;
    const polys = isoBuildingPolys(footprint2x2(), heightPx);
    const faces = hipRoofFaces(polys.roof, pitchedApexPx(polys.roof[1].x - polys.roof[3].x));
    const maxRoofY = Math.max(...polys.roof.map((p) => p.y)); // the bottom eave
    const minRoofX = Math.min(...polys.roof.map((p) => p.x));
    const maxRoofX = Math.max(...polys.roof.map((p) => p.x));
    const detail = pitchedRoofDetailSegments(polys.roof, faces);
    expect(detail.hips).toHaveLength(2);
    expect(detail.courses).toHaveLength(2);
    for (const [a, b] of [...detail.hips, ...detail.courses]) {
      for (const p of [a, b]) {
        // At or above the eave line (roof), never down on the walls (below).
        expect(p.y).toBeLessThanOrEqual(maxRoofY + 0.001);
        expect(p.x).toBeGreaterThanOrEqual(minRoofX - 0.001);
        expect(p.x).toBeLessThanOrEqual(maxRoofX + 0.001);
      }
    }
  });

  it('drawIsoBuilding pitched draws two roof-plane pentagons; flat draws one roof diamond', () => {
    const corners = footprint2x2();
    const pitchedSpy = createIsoBuildingSpy();
    drawIsoBuilding(pitchedSpy.graphics, corners, 60, { ...STYLE, pitched: true });
    const pitchedRoofPolys = pitchedSpy.calls.filter((c) => c.op === 'fillPoints' && c.pointCount === 5);
    expect(pitchedRoofPolys).toHaveLength(2); // the two hip planes

    const flatSpy = createIsoBuildingSpy();
    drawIsoBuilding(flatSpy.graphics, corners, 60, STYLE);
    expect(flatSpy.calls.filter((c) => c.op === 'fillPoints' && c.pointCount === 5)).toHaveLength(0);
    // The flat roof is a 4-point diamond; pitched replaces it with the pentagons.
    expect(pitchedSpy.calls.some((c) => c.op === 'lineBetween')).toBe(true); // ridge + hips
  });
});

describe('wallCourseSegments - masonry banding', () => {
  const corners = footprint2x2();
  const H = 60;
  const leftBaseA = corners.left;
  const leftBaseB = corners.bottom;

  const liftOf = (
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number => {
    const t = (p.x - a.x) / (b.x - a.x);
    return a.y + (b.y - a.y) * t - p.y;
  };

  it('returns three base-parallel masonry course lines on a tall wall', () => {
    const courses = wallCourseSegments(leftBaseA, leftBaseB, H);
    expect(courses).toHaveLength(3);
    for (const [a, b] of courses) {
      expect(a.x).toBe(leftBaseA.x);
      expect(b.x).toBe(leftBaseB.x);
      expect(liftOf(a, leftBaseA, leftBaseB)).toBeCloseTo(liftOf(b, leftBaseA, leftBaseB), 5);
    }
  });

  it('keeps masonry courses below the window band so openings stay readable', () => {
    const courses = wallCourseSegments(leftBaseA, leftBaseB, H);
    for (const [a, b] of courses) {
      expect(liftOf(a, leftBaseA, leftBaseB)).toBeGreaterThan(0.12 * H);
      expect(liftOf(b, leftBaseA, leftBaseB)).toBeLessThan(0.52 * H);
    }
  });
});

describe('roofTileSegments - roof material breakup', () => {
  const roof = isoBuildingPolys(footprint2x2(), 40).roof;

  it('returns two diagonal families of tile seams inside the roof diamond', () => {
    const segments = roofTileSegments(roof);
    expect(segments).toHaveLength(5);
    const hasTopLeftToBottomRightFamily = segments.some(
      ([a, b]) => a.x < b.x && a.y < b.y,
    );
    const hasTopRightToBottomLeftFamily = segments.some(
      ([a, b]) => a.x > b.x && a.y < b.y,
    );
    expect(hasTopLeftToBottomRightFamily).toBe(true);
    expect(hasTopRightToBottomLeftFamily).toBe(true);
  });

  it('keeps every tile seam endpoint within the roof diamond bounds', () => {
    const segments = roofTileSegments(roof);
    const minX = Math.min(...roof.map((p) => p.x));
    const maxX = Math.max(...roof.map((p) => p.x));
    const minY = Math.min(...roof.map((p) => p.y));
    const maxY = Math.max(...roof.map((p) => p.y));
    for (const [a, b] of segments) {
      for (const p of [a, b]) {
        expect(p.x).toBeGreaterThanOrEqual(minX);
        expect(p.x).toBeLessThanOrEqual(maxX);
        expect(p.y).toBeGreaterThanOrEqual(minY);
        expect(p.y).toBeLessThanOrEqual(maxY);
      }
    }
  });
});

describe('roofBevelSegments - roof depth cues', () => {
  const roof = isoBuildingPolys(footprint2x2(), 40).roof;

  it('returns highlight and shadow/eave segments inside the roof diamond', () => {
    const bevel = roofBevelSegments(roof);
    expect(bevel.highlight).toHaveLength(2);
    expect(bevel.shadow).toHaveLength(2);

    const minX = Math.min(...roof.map((p) => p.x));
    const maxX = Math.max(...roof.map((p) => p.x));
    const minY = Math.min(...roof.map((p) => p.y));
    const maxY = Math.max(...roof.map((p) => p.y));
    for (const segments of [bevel.highlight, bevel.shadow]) {
      for (const [a, b] of segments) {
        for (const p of [a, b]) {
          expect(p.x).toBeGreaterThanOrEqual(minX);
          expect(p.x).toBeLessThanOrEqual(maxX);
          expect(p.y).toBeGreaterThanOrEqual(minY);
          expect(p.y).toBeLessThanOrEqual(maxY);
        }
      }
    }
  });
});
