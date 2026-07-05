import { describe, expect, it } from 'vitest';

import { isoBuildingPolys } from '../../src/phaser/scenes/gameScene/isoBuilding';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

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
