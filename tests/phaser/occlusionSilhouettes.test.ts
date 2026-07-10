import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  buildingSilhouettePolygon,
  computeOccludedUnits,
  depthKey,
  pointInPolygon,
} from '../../src/phaser/scenes/gameScene/occlusionSilhouettes';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

// "Unit behind a building" occlusion (v0.1.133): a unit painted over by a
// building in the depth-sorted entity pass gets a white silhouette. These tests
// pin the pure predicate — WHICH units are occluded — against the real iso
// projection + building volume geometry.

function building(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 100,
    kind: 'building',
    layer: 'building',
    entityType: 'town-center',
    owner: 2,
    x: 10,
    y: 10,
    tint: 0xff5a4d,
    size: 1,
    footprintWidth: 4,
    footprintHeight: 4,
    visualVariant: 'complete',
    selected: false,
    currentHp: 2400,
    maxHp: 2400,
    isMemory: false,
    ...overrides,
  };
}

function unit(x: number, y: number, overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    kind: 'unit',
    layer: 'unit',
    entityType: 'militia',
    owner: 1,
    x,
    y,
    tint: 0x3fa7ff,
    size: 0.5,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 40,
    maxHp: 40,
    isMemory: false,
    ...overrides,
  };
}

describe('depthKey', () => {
  it('is exactly cellX + cellY (must match the render sort)', () => {
    expect(depthKey({ x: 8, y: 8 })).toBe(16);
    expect(depthKey({ x: 12.5, y: 3.25 })).toBe(15.75);
  });
});

describe('buildingSilhouettePolygon', () => {
  it('is a 6-point hexagon extruded above the footprint diamond', () => {
    const poly = buildingSilhouettePolygon(building({}));
    expect(poly).toHaveLength(6);
    // The footprint ground corners (worldToIso) are the base.
    const bottom = worldToIso(14, 14); // (x+w, y+h)
    expect(poly[0]).toEqual(bottom);
    // Every roof point sits ABOVE (smaller y) its ground corner.
    const groundTopY = worldToIso(10, 10).y;
    const topRoof = poly[3]!;
    expect(topRoof.x).toBeCloseTo(worldToIso(10, 10).x, 5);
    expect(topRoof.y).toBeLessThan(groundTopY); // lifted by wall + ridge
  });

  it('a construction stub is much shorter than the completed volume', () => {
    const full = buildingSilhouettePolygon(building({}));
    const stub = buildingSilhouettePolygon(building({ visualVariant: 'construction' }));
    // topRoof.y smaller = higher; the stub's peak is lower on screen (larger y).
    expect(stub[3]!.y).toBeGreaterThan(full[3]!.y);
  });
});

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  it('detects inside vs outside', () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
    expect(pointInPolygon(-1, 5, square)).toBe(false);
    expect(pointInPolygon(5, 11, square)).toBe(false);
  });
});

describe('computeOccludedUnits', () => {
  it('flags a unit standing BEHIND a building (building paints on top of it)', () => {
    const tc = building({}); // 4x4 @ (10,10), depthKey 20
    const behind = unit(8, 8); // depthKey 16 < 20, centre projects into the TC volume
    const occluded = computeOccludedUnits([tc, behind]);
    expect(occluded.map((u) => u.id)).toEqual([1]);
  });

  it('does NOT flag a unit ABOVE the pitched roofline (review regression: apex over-claim)', () => {
    // A pitched roof's ridge is inset toward centre and sits well below a naive
    // full-height apex over the back corner. A villager ~3 cells NW of its own
    // Town Center pokes ABOVE the real roofline and is fully visible — it must
    // NOT get a false white ghost. (Before the fix, its centre fell in the
    // empty band between the inflated apex and the real ridge.)
    const tc = building({}); // 4x4 pitched TC @ (10,10)
    const aboveRoof = unit(7, 7); // depthKey 14 < 20, but centre is above the ridge
    expect(computeOccludedUnits([tc, aboveRoof])).toHaveLength(0);
    // The silhouette's top point is the real hip ridge, NOT the apex-over-corner.
    const poly = buildingSilhouettePolygon(tc);
    const topPoint = poly.reduce((a, b) => (b.y < a.y ? b : a));
    const wallTopY = worldToIso(10, 10).y - (1.7 * 32); // eave height (wall only)
    // The ridge sits within a couple of px of the eave, NOT ~apex px above it.
    expect(topPoint.y).toBeGreaterThan(wallTopY - 4);
  });

  it('does NOT flag a unit IN FRONT of the building (unit paints on top)', () => {
    const tc = building({});
    const inFront = unit(16, 16); // depthKey 32 > 20 → TC is behind it
    expect(computeOccludedUnits([tc, inFront])).toHaveLength(0);
  });

  it('does NOT flag a unit beside the building (centre outside the silhouette)', () => {
    const tc = building({});
    const beside = unit(8, 20); // small enough depth on one axis but off to the side
    expect(computeOccludedUnits([tc, beside])).toHaveLength(0);
  });

  it('does NOT flag a unit behind a MEMORY (ghost) building — ghosts do not occlude', () => {
    const ghost = building({ isMemory: true });
    const behind = unit(8, 8);
    expect(computeOccludedUnits([ghost, behind])).toHaveLength(0);
  });

  it('respects drawn height: a construction stub is too short to hide the same unit', () => {
    const stub = building({ visualVariant: 'construction' });
    const behind = unit(8, 8); // occluded by the FULL TC, but its centre is above the stub roof
    expect(computeOccludedUnits([stub, behind])).toHaveLength(0);
    // …and the completed TC at the same spot DOES occlude it (control).
    expect(computeOccludedUnits([building({}), behind]).map((u) => u.id)).toEqual([1]);
  });

  it('returns nothing when there are no buildings', () => {
    expect(computeOccludedUnits([unit(8, 8), unit(9, 9)])).toHaveLength(0);
  });

  it('only flags units, never buildings or resources', () => {
    const tc = building({});
    const res = building({ id: 200, kind: 'resource', layer: 'resource', entityType: 'tree', x: 8, y: 8 } as Partial<ProjectedEntityView>);
    const occluded = computeOccludedUnits([tc, res]);
    expect(occluded.every((e) => e.kind === 'unit')).toBe(true);
  });
});
