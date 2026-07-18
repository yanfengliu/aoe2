// Characterization grid for the per-kind hit-shape geometry in
// entityHitTest.ts, captured BEFORE the entityHitShape descriptor refactor by
// evaluating the four pre-refactor functions over sample points and rects —
// the expected booleans below are extracted output, never hand-derived. The
// older entityHitTest.test.ts covers the finder/ordering layer; this file
// covers the shapes themselves, which previously had no direct coverage for
// building rects, resource rects/circles, tiles, or the iso fallback.
//
// The samples discriminate every constant the shapes encode: the unit radius
// factor 0.5, the command-target padding 0.18 (units ONLY — a padded miss on a
// resource edge must stay a miss), the rect-resource inset 0.1 (a click in the
// inset gap is a miss), the circle-resource factor 0.55 (a point between the
// 0.5- and 0.55-factor radii is a hit), true circle-vs-bbox corners (a rect
// overlapping the bounding box but not the circle is a miss), and the iso
// marquee's centre-point fallback for buildings/rect-resources/tiles —
// including that it centres a 2x2 building at the ANCHOR cell's centre
// worldToIso(x + 0.5, y + 0.5), not the footprint centre, and that a tile is
// never hit top-down but IS point-hit by the iso fallback.
//
// Circle-edge samples sit +/-0.05px off the edge rather than exactly on it:
// exact-on-edge goes through cx + r and back, which can flip the dx*dx <= r*r
// comparison by one float ulp. Rect-edge samples reuse the code's own
// expressions, so exact-on-edge is stable there.

import { describe, expect, it } from 'vitest';

import {
  doesIsoWorldRectIntersectEntity,
  doesWorldRectIntersectEntity,
  isWorldPointInsideCommandTargetEntity,
  isWorldPointInsideEntity,
} from '../../src/input/entityHitTest';
import type { ProjectedEntityView } from '../../src/game/simulation/types';

const CELL_SIZE = 24;

const base = {
  tint: 0,
  footprintWidth: 1,
  footprintHeight: 1,
  visualVariant: 'default',
  selected: false,
  currentHp: 10,
  maxHp: 10,
  isMemory: false,
} as const;

const ENTITIES = {
  unit: { ...base, id: 1, kind: 'unit', layer: 'unit', entityType: 'villager', owner: 1, x: 15, y: 8, size: 0.55 },
  building: { ...base, id: 2, kind: 'building', layer: 'building', entityType: 'house', owner: 1, x: 15, y: 8, size: 1, footprintWidth: 2, footprintHeight: 2, visualVariant: 'complete' },
  tree: { ...base, id: 3, kind: 'resource', layer: 'resource', entityType: 'tree', owner: null, x: 12, y: 5, size: 0.8 },
  bush: { ...base, id: 4, kind: 'resource', layer: 'resource', entityType: 'berry-bush', owner: null, x: 9, y: 14, size: 0.7 },
  sheep: { ...base, id: 5, kind: 'resource', layer: 'resource', entityType: 'sheep', owner: null, x: 20, y: 20, size: 0.5 },
  tile: { ...base, id: 6, kind: 'tile', layer: 'tile', entityType: null, owner: null, x: 3, y: 3, size: 1 },
} as unknown as Record<'unit' | 'building' | 'tree' | 'bush' | 'sheep' | 'tile', ProjectedEntityView>;

// 72 samples (35 true / 37 false), extracted from the pre-refactor code.
const SAMPLES = [
  { entity: 'unit', fn: 'point', label: 'centre', args: [372, 204], expected: true },
  { entity: 'unit', fn: 'point', label: 'just inside edge right', args: [378.55, 204], expected: true },
  { entity: 'unit', fn: 'point', label: 'just outside edge right', args: [378.65000000000003, 204], expected: false },
  { entity: 'unit', fn: 'point', label: 'diagonal outside body (dist 6.65 > r 6.6)', args: [376.7, 208.7], expected: false },
  { entity: 'unit', fn: 'point', label: 'far away', args: [300, 300], expected: false },
  { entity: 'unit', fn: 'commandPoint', label: 'diagonal outside body but inside 0.18-cell padding', args: [376.7, 208.7], expected: true },
  { entity: 'unit', fn: 'commandPoint', label: 'just inside padded edge right (r + 0.18*cell)', args: [382.87, 204], expected: true },
  { entity: 'unit', fn: 'commandPoint', label: 'just outside padded edge', args: [382.97, 204], expected: false },
  { entity: 'unit', fn: 'rect', label: 'covering the whole body', args: [360, 192, 384, 216], expected: true },
  { entity: 'unit', fn: 'rect', label: 'overlap-touch from the left (maxX just past cx - r)', args: [350.4, 200, 365.45, 208], expected: true },
  { entity: 'unit', fn: 'rect', label: 'just shy from the left', args: [350.4, 200, 365.34999999999997, 208], expected: false },
  { entity: 'unit', fn: 'rect', label: 'corner region: inside bbox, outside circle', args: [377, 209, 384, 216], expected: false },
  { entity: 'unit', fn: 'rect', label: 'degenerate point-rect at centre', args: [372, 204, 372, 204], expected: true },
  { entity: 'unit', fn: 'rect', label: 'disjoint', args: [0, 0, 10, 10], expected: false },
  { entity: 'unit', fn: 'isoRect', label: 'covering the iso centre', args: [220, 380, 228, 388], expected: true },
  { entity: 'unit', fn: 'isoRect', label: 'overlap-touch right (minX just inside centre + r)', args: [230.54999999999998, 380, 238.6, 388], expected: true },
  { entity: 'unit', fn: 'isoRect', label: 'just shy right', args: [230.65, 380, 238.6, 388], expected: false },
  { entity: 'unit', fn: 'isoRect', label: 'corner region: inside bbox, outside circle', args: [229, 389, 236, 396], expected: false },
  { entity: 'unit', fn: 'isoRect', label: 'disjoint', args: [324, 484, 334, 494], expected: false },
  { entity: 'building', fn: 'point', label: 'inside centre', args: [384, 216], expected: true },
  { entity: 'building', fn: 'point', label: 'far corner exact (x+w, y+h)', args: [408, 240], expected: true },
  { entity: 'building', fn: 'point', label: 'just outside far corner', args: [408.1, 240], expected: false },
  { entity: 'building', fn: 'point', label: 'on left edge', args: [360, 200], expected: true },
  { entity: 'building', fn: 'point', label: 'just outside left edge', args: [359.9, 200], expected: false },
  { entity: 'building', fn: 'point', label: 'far away', args: [0, 0], expected: false },
  { entity: 'building', fn: 'commandPoint', label: 'far corner exact (delegates unpadded)', args: [408, 240], expected: true },
  { entity: 'building', fn: 'commandPoint', label: 'just outside far corner (no padding for buildings)', args: [408.1, 240], expected: false },
  { entity: 'building', fn: 'rect', label: 'overlapping the body', args: [350, 182, 370, 202], expected: true },
  { entity: 'building', fn: 'rect', label: 'edge-touch left (maxX == x)', args: [340, 196, 360, 204], expected: true },
  { entity: 'building', fn: 'rect', label: 'just shy left', args: [340, 196, 359.9, 204], expected: false },
  { entity: 'building', fn: 'rect', label: 'contained inside the body', args: [370, 202, 380, 212], expected: true },
  { entity: 'building', fn: 'rect', label: 'disjoint', args: [0, 0, 10, 10], expected: false },
  { entity: 'building', fn: 'isoRect', label: 'containing the iso centre', args: [220, 380, 228, 388], expected: true },
  { entity: 'building', fn: 'isoRect', label: 'overlapping the drawn body but missing the iso centre', args: [226, 380, 254, 388], expected: false },
  { entity: 'building', fn: 'isoRect', label: 'iso-centre-exact on rect corner', args: [224, 384, 234, 394], expected: true },
  { entity: 'building', fn: 'isoRect', label: 'containing the footprint centre but not the anchor-cell centre', args: [222, 398, 226, 402], expected: false },
  { entity: 'building', fn: 'isoRect', label: 'disjoint', args: [324, 484, 334, 494], expected: false },
  { entity: 'tree', fn: 'point', label: 'centre of cell', args: [300, 132], expected: true },
  { entity: 'tree', fn: 'point', label: 'far corner exact (offset 0.1 + size)', args: [309.59999999999997, 141.60000000000002], expected: true },
  { entity: 'tree', fn: 'point', label: 'just outside far corner', args: [309.7, 141.60000000000002], expected: false },
  { entity: 'tree', fn: 'point', label: 'inside cell but inside the 0.1 offset gap', args: [289, 121], expected: false },
  { entity: 'tree', fn: 'point', label: 'far away', args: [0, 0], expected: false },
  { entity: 'tree', fn: 'commandPoint', label: 'far corner exact (delegates unpadded)', args: [309.59999999999997, 141.60000000000002], expected: true },
  { entity: 'tree', fn: 'rect', label: 'edge-touch left (maxX == offset x)', args: [270.4, 126.4, 290.4, 134.4], expected: true },
  { entity: 'tree', fn: 'rect', label: 'just shy left', args: [270.4, 126.4, 290.29999999999995, 134.4], expected: false },
  { entity: 'tree', fn: 'rect', label: 'overlapping', args: [285.4, 117.4, 295.4, 127.4], expected: true },
  { entity: 'tree', fn: 'rect', label: 'disjoint', args: [0, 0, 10, 10], expected: false },
  { entity: 'tree', fn: 'isoRect', label: 'containing the iso centre (point test, not rect)', args: [220, 284, 228, 292], expected: true },
  { entity: 'tree', fn: 'isoRect', label: 'overlapping the drawn body but missing the iso centre', args: [226, 284, 254, 292], expected: false },
  { entity: 'tree', fn: 'isoRect', label: 'disjoint', args: [324, 388, 334, 398], expected: false },
  { entity: 'bush', fn: 'point', label: 'centre', args: [228, 348], expected: true },
  { entity: 'bush', fn: 'point', label: 'just inside edge right (r = size*0.55)', args: [237.19, 348], expected: true },
  { entity: 'bush', fn: 'point', label: 'just outside edge', args: [237.29000000000002, 348], expected: false },
  { entity: 'bush', fn: 'point', label: 'between 0.5 and 0.55 factor radii (pins 0.55)', args: [236.6, 348], expected: true },
  { entity: 'bush', fn: 'point', label: 'far away', args: [0, 0], expected: false },
  { entity: 'bush', fn: 'commandPoint', label: 'just inside edge right (delegates unpadded)', args: [237.19, 348], expected: true },
  { entity: 'bush', fn: 'commandPoint', label: 'just outside edge (NO unit padding for resources)', args: [237.29000000000002, 348], expected: false },
  { entity: 'bush', fn: 'rect', label: 'corner region: inside bbox, outside circle', args: [235, 355, 242, 362], expected: false },
  { entity: 'bush', fn: 'rect', label: 'overlap-touch right (minX just inside cx + r)', args: [237.19, 344, 247.24, 352], expected: true },
  { entity: 'bush', fn: 'rect', label: 'overlapping', args: [224, 344, 232, 352], expected: true },
  { entity: 'bush', fn: 'rect', label: 'disjoint', args: [0, 0, 10, 10], expected: false },
  { entity: 'bush', fn: 'isoRect', label: 'covering the iso centre', args: [-164, 380, -156, 388], expected: true },
  { entity: 'bush', fn: 'isoRect', label: 'overlap-touch right in iso space', args: [-150.81, 380, -142.76, 388], expected: true },
  { entity: 'bush', fn: 'isoRect', label: 'just shy right in iso space', args: [-150.70999999999998, 380, -142.76, 388], expected: false },
  { entity: 'bush', fn: 'isoRect', label: 'disjoint', args: [-60, 484, -50, 494], expected: false },
  { entity: 'sheep', fn: 'point', label: 'centre', args: [492, 492], expected: true },
  { entity: 'sheep', fn: 'isoRect', label: 'covering the iso centre', args: [-3, 653, 3, 659], expected: true },
  { entity: 'tile', fn: 'point', label: 'centre of the tile (still false)', args: [84, 84], expected: false },
  { entity: 'tile', fn: 'commandPoint', label: 'centre of the tile (still false)', args: [84, 84], expected: false },
  { entity: 'tile', fn: 'rect', label: 'rect covering the whole tile (still false)', args: [62, 62, 106, 106], expected: false },
  { entity: 'tile', fn: 'isoRect', label: 'containing the iso centre (asymmetry: TRUE here)', args: [-4, 108, 4, 116], expected: true },
  { entity: 'tile', fn: 'isoRect', label: 'missing the iso centre', args: [2, 114, 10, 122], expected: false },
] as const;

const RUNNERS: Record<
  (typeof SAMPLES)[number]['fn'],
  (entity: ProjectedEntityView, args: readonly number[]) => boolean
> = {
  point: (entity, [x, y]) => isWorldPointInsideEntity(entity, x!, y!, CELL_SIZE),
  commandPoint: (entity, [x, y]) => isWorldPointInsideCommandTargetEntity(entity, x!, y!, CELL_SIZE),
  rect: (entity, [sx, sy, ex, ey]) => doesWorldRectIntersectEntity(entity, sx!, sy!, ex!, ey!, CELL_SIZE),
  isoRect: (entity, [sx, sy, ex, ey]) => doesIsoWorldRectIntersectEntity(entity, sx!, sy!, ex!, ey!, CELL_SIZE),
};

describe('entity hit shapes — characterization grid', () => {
  for (const fn of ['point', 'commandPoint', 'rect', 'isoRect'] as const) {
    it(`matches the pre-refactor ${fn} behaviour for every sample`, () => {
      for (const sample of SAMPLES) {
        if (sample.fn !== fn) continue;
        expect(
          RUNNERS[fn](ENTITIES[sample.entity], sample.args),
          `${sample.entity}: ${sample.label}`,
        ).toBe(sample.expected);
      }
    });
  }
});
