import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { worldToIso } from '../../src/rendering/isometricProjection';
import {
  computeBaseFocusCell,
  isDragSelectableEntity,
  isoDragPixelBounds,
  isoViewportCellBounds,
  isoWorldPixelBounds,
  marqueePreviewEntities,
} from '../../src/rendering/isoViewHelpers';

const CELL_SIZE = 24;

function entity(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 5,
    y: 5,
    tint: 0,
    size: 0.5,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

describe('isoWorldPixelBounds', () => {
  it('is the iso diamond bounding box of the map, with a margin (negative min-x)', () => {
    const bounds = isoWorldPixelBounds(60, 36, CELL_SIZE);
    // Corners: (0,36)->left, (60,0)->right, (0,0)->top, (60,36)->bottom.
    expect(bounds.x).toBe(worldToIso(0, 36).x - CELL_SIZE); // -1152 - 24
    expect(bounds.y).toBe(worldToIso(0, 0).y - CELL_SIZE); // 0 - 24
    expect(bounds.width).toBe(worldToIso(60, 0).x + CELL_SIZE - bounds.x);
    expect(bounds.height).toBe(worldToIso(60, 36).y + CELL_SIZE - bounds.y);
    expect(bounds.x).toBeLessThan(0); // left half spans negative x
  });
});

describe('computeBaseFocusCell', () => {
  it('prefers the human Town Center centre', () => {
    const focus = computeBaseFocusCell(
      [
        entity({ id: 2, kind: 'building', entityType: 'town-center', footprintWidth: 4, footprintHeight: 4, x: 10, y: 10 }),
        entity({ id: 3, x: 20, y: 20 }),
      ],
      1,
    );
    expect(focus).toEqual({ cellX: 12, cellY: 12 });
  });

  it('falls back to the centroid of owned entity centres when there is no TC', () => {
    const focus = computeBaseFocusCell([entity({ x: 5, y: 5 }), entity({ id: 2, x: 7, y: 7 })], 1);
    // centres (5.5,5.5) and (7.5,7.5) → (6.5, 6.5)
    expect(focus).toEqual({ cellX: 6.5, cellY: 6.5 });
  });

  it('ignores enemy + memory entities and returns null when the player has none', () => {
    expect(computeBaseFocusCell([entity({ owner: 2 }), entity({ id: 2, isMemory: true })], 1)).toBeNull();
  });
});

describe('isoViewportCellBounds', () => {
  it('returns the cell AABB of the projected viewport corners', () => {
    // A viewport around the iso origin covers cells near (0,0); isoToWorld of its
    // corners bounds a small cell diamond.
    const bounds = isoViewportCellBounds({ x: -64, y: 0, right: 64, bottom: 64 });
    expect(bounds.minX).toBeLessThanOrEqual(bounds.maxX);
    expect(bounds.minY).toBeLessThanOrEqual(bounds.maxY);
    // Corner (right=64, bottom=64) → cell (isoToWorld) has the largest cellX.
    expect(bounds.maxX).toBeGreaterThan(bounds.minX);
  });
});

describe('isoDragPixelBounds', () => {
  it('bounds the two opposite screen corners after projection (identity screenToIso)', () => {
    const bounds = isoDragPixelBounds(30, 10, 5, 40, (x, y) => ({ x, y }));
    expect(bounds).toEqual({ minX: 5, minY: 10, maxX: 30, maxY: 40 });
  });
});

describe('isDragSelectableEntity', () => {
  it('accepts human units and human sheep; rejects enemies, other resources, and ghosts', () => {
    expect(isDragSelectableEntity(entity({ kind: 'unit', owner: 1 }), 1)).toBe(true);
    expect(isDragSelectableEntity(entity({ kind: 'unit', owner: 2 }), 1)).toBe(false);
    expect(isDragSelectableEntity(entity({ kind: 'resource', entityType: 'sheep', owner: 1 }), 1)).toBe(true);
    expect(isDragSelectableEntity(entity({ kind: 'resource', entityType: 'tree', owner: 1 }), 1)).toBe(false);
    expect(isDragSelectableEntity(entity({ kind: 'unit', owner: 1, isMemory: true }), 1)).toBe(false);
  });
});

describe('marqueePreviewEntities', () => {
  it('keeps only intersecting drag-selectable entities, ordered by y then x then id', () => {
    // Two human villagers near cells (5,5) and (5,4); a wide iso-pixel rect covers
    // both. worldToIso(5.5,5.5)=(0,176); worldToIso(5.5,4.5)=(32,160).
    const near = entity({ id: 10, x: 5, y: 5 });
    const above = entity({ id: 11, x: 5, y: 4 });
    const enemy = entity({ id: 12, x: 5, y: 5, owner: 2 });
    const bounds = { minX: -64, minY: 140, maxX: 96, maxY: 200 };
    const result = marqueePreviewEntities(
      [near, above, enemy],
      bounds,
      (candidate) => isDragSelectableEntity(candidate, 1),
      CELL_SIZE,
    );
    expect(result.map((entry) => entry.id)).toEqual([11, 10]); // y=4 before y=5, enemy excluded
  });
});
