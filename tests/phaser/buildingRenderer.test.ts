import { describe, expect, it } from 'vitest';

import { AUTHORITATIVE_BUILDING_FOOTPRINTS } from '../../src/game/content/buildingFootprints';
import type { BuildingType, ProjectedEntityView } from '../../src/game/simulation/types';
import {
  buildingRole,
  type BuildingRole,
} from '../../src/phaser/scenes/gameScene/buildingRole';
import { createBuildingRenderer } from '../../src/phaser/scenes/gameScene/buildingRenderer';
import { worldToIso } from '../../src/phaser/scenes/gameScene/isoProjection';

const CELL_SIZE = 24;

function createBuilding(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'building',
    layer: 'building',
    entityType: 'house',
    owner: 1,
    x: 4,
    y: 4,
    tint: 0x3fa7ff,
    size: 1,
    footprintWidth: 2,
    footprintHeight: 2,
    visualVariant: 'complete',
    selected: false,
    currentHp: 550,
    maxHp: 550,
    isMemory: false,
    ...overrides,
  };
}

// A Phaser.GameObjects.Graphics stand-in that records every primitive draw call
// and every (x, y) point so a test can assert the drawn primitive SET per role
// and that everything stays inside the building's footprint rect. Mirrors the
// spy in unitRenderer.test.ts.
interface DrawCall {
  op: string;
  args: number[];
}
function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  const points: Array<{ x: number; y: number }> = [];
  const record = (op: string, xyArgs: Array<[number, number]>, rest: number[] = []): void => {
    const flat: number[] = [];
    for (const [x, y] of xyArgs) {
      flat.push(x, y);
      points.push({ x, y });
    }
    calls.push({ op, args: [...flat, ...rest] });
  };
  const graphics = {
    fillStyle: (color: number, alpha?: number) => {
      calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] });
    },
    lineStyle: (width: number, color: number, alpha?: number) => {
      calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] });
    },
    fillCircle: (x: number, y: number, r: number) => {
      record('fillCircle', [[x, y]], [r]);
      // Expand the circle to its radius extents so the footprint-containment
      // assertion catches a filled circle that bulges past the rect (mirrors
      // the arc / fillEllipse handling).
      points.push({ x: x - r, y: y - r }, { x: x + r, y: y + r });
    },
    strokeCircle: (x: number, y: number, r: number) => record('strokeCircle', [[x, y]], [r]),
    fillRect: (x: number, y: number, w: number, h: number) => {
      record('fillRect', [[x, y], [x + w, y + h]]);
    },
    strokeRect: (x: number, y: number, w: number, h: number) => {
      record('strokeRect', [[x, y], [x + w, y + h]]);
    },
    fillRoundedRect: (x: number, y: number, w: number, h: number) => {
      record('fillRoundedRect', [[x, y], [x + w, y + h]]);
    },
    strokeRoundedRect: (x: number, y: number, w: number, h: number) => {
      record('strokeRoundedRect', [[x, y], [x + w, y + h]]);
    },
    fillPoints: (pts: Array<{ x: number; y: number }>) => {
      record('fillPoints', pts.map((p) => [p.x, p.y] as [number, number]));
    },
    strokePoints: (pts: Array<{ x: number; y: number }>) => {
      record('strokePoints', pts.map((p) => [p.x, p.y] as [number, number]));
    },
    fillTriangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
      record('fillTriangle', [[x1, y1], [x2, y2], [x3, y3]]);
    },
    strokeTriangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
      record('strokeTriangle', [[x1, y1], [x2, y2], [x3, y3]]);
    },
    fillEllipse: (x: number, y: number, w: number, h: number) => {
      record('fillEllipse', [[x, y]], [w, h]);
      points.push({ x: x - w / 2, y: y - h / 2 }, { x: x + w / 2, y: y + h / 2 });
    },
    lineBetween: (x1: number, y1: number, x2: number, y2: number) => {
      record('lineBetween', [[x1, y1], [x2, y2]]);
    },
    beginPath: () => calls.push({ op: 'beginPath', args: [] }),
    arc: (x: number, y: number, r: number) => {
      record('arc', [[x, y]], [r]);
      points.push({ x: x - r, y: y - r }, { x: x + r, y: y + r });
    },
    strokePath: () => calls.push({ op: 'strokePath', args: [] }),
    fillPath: () => calls.push({ op: 'fillPath', args: [] }),
  };
  return { graphics, calls, points };
}

const ALL_BUILDING_TYPES = Object.keys(
  AUTHORITATIVE_BUILDING_FOOTPRINTS,
) as BuildingType[];

describe('buildingRole', () => {
  const cases: Array<[BuildingType, BuildingRole]> = [
    ['town-center', 'town-center'],
    ['castle', 'fortress'],
    ['wonder', 'wonder'],
    ['house', 'house'],
    ['mill', 'mill'],
    ['farm', 'farm'],
    ['lumber-camp', 'drop-site'],
    ['mining-camp', 'drop-site'],
    ['barracks', 'military'],
    ['stable', 'military'],
    ['archery-range', 'military'],
    ['siege-workshop', 'military'],
    ['blacksmith', 'blacksmith'],
    ['market', 'market'],
    ['monastery', 'monastery'],
    ['watch-tower', 'tower'],
    ['stone-wall', 'wall'],
    ['palisade-wall', 'wall'],
  ];

  it.each(cases)('maps %s to role %s', (buildingType, role) => {
    expect(buildingRole(buildingType)).toBe(role);
  });

  it('returns a role for every BuildingType (exhaustive)', () => {
    for (const buildingType of ALL_BUILDING_TYPES) {
      expect(typeof buildingRole(buildingType)).toBe('string');
    }
  });
});

describe('createBuildingRenderer.renderBuildingEntity', () => {
  function render(overrides: Partial<ProjectedEntityView>) {
    const spy = createGraphicsSpy();
    const renderer = createBuildingRenderer({
      entityLayer: spy.graphics as never,
      cellSize: CELL_SIZE,
    });
    const entity = createBuilding(overrides);
    const px = entity.x * CELL_SIZE;
    const py = entity.y * CELL_SIZE;
    const visual = renderer.renderBuildingEntity(entity, px, py);
    return { spy, px, py, entity, visual };
  }

  it('draws a completed silhouette for every building type', () => {
    for (const buildingType of ALL_BUILDING_TYPES) {
      const fp = AUTHORITATIVE_BUILDING_FOOTPRINTS[buildingType];
      const { spy } = render({
        entityType: buildingType,
        footprintWidth: fp.width,
        footprintHeight: fp.height,
        visualVariant: 'complete',
      });
      const fillOps = spy.calls.filter((c) => c.op.startsWith('fill') && c.op !== 'fillStyle');
      expect(fillOps.length).toBeGreaterThan(0);
    }
  });

  it('uses the entity tint as a fill color', () => {
    const { spy, entity } = render({ entityType: 'barracks', footprintWidth: 3, footprintHeight: 3 });
    const usedTint = spy.calls.some((c) => c.op === 'fillStyle' && c.args[0] === entity.tint);
    expect(usedTint).toBe(true);
  });

  it('wires per-role roofs: house-like roles get a pitched roof, battlement/dome roles stay flat', () => {
    // The pitched roof caps the volume with two 5-point pentagon planes; a flat
    // roof caps it with a single 4-point diamond. A pentagon fillPoints call
    // therefore only appears for pitched roles (end-to-end through the wiring
    // `pitched = roleHasPitchedRoof(role)` in buildingRenderer).
    const pentagonFills = (spy: ReturnType<typeof createGraphicsSpy>) =>
      spy.calls.filter((c) => c.op === 'fillPoints' && c.args.length === 10).length;

    for (const [type, fp] of [
      ['house', { width: 2, height: 2 }],
      ['barracks', { width: 3, height: 3 }],
      ['monastery', { width: 3, height: 3 }],
      ['town-center', { width: 4, height: 4 }],
    ] as const) {
      const { spy } = render({ entityType: type, footprintWidth: fp.width, footprintHeight: fp.height });
      expect(pentagonFills(spy), `${type} should have a pitched (pentagon) roof`).toBe(2);
    }
    for (const [type, fp] of [
      ['castle', { width: 4, height: 4 }],
      ['watch-tower', { width: 1, height: 1 }],
      ['wonder', { width: 4, height: 4 }],
      ['farm', { width: 3, height: 3 }],
    ] as const) {
      const { spy } = render({ entityType: type, footprintWidth: fp.width, footprintHeight: fp.height });
      expect(pentagonFills(spy), `${type} should have a flat roof`).toBe(0);
    }
  });

  it('anchors the iso volume on the footprint diamond and stays horizontally within it', () => {
    // The extruded volume rises ABOVE the footprint (roof lifted), but its
    // horizontal span must stay within the footprint's iso diamond (its four
    // cell corners projected) so it reads as sitting on those cells. Vertically
    // it may rise (roof + accents) but never sink below the ground diamond.
    const tol = 3;
    for (const buildingType of ALL_BUILDING_TYPES) {
      const fp = AUTHORITATIVE_BUILDING_FOOTPRINTS[buildingType];
      const entity = createBuilding({
        entityType: buildingType,
        footprintWidth: fp.width,
        footprintHeight: fp.height,
        visualVariant: 'complete',
      });
      const spy = createGraphicsSpy();
      const renderer = createBuildingRenderer({ entityLayer: spy.graphics as never, cellSize: CELL_SIZE });
      renderer.renderBuildingEntity(entity, 0, 0);

      const left = worldToIso(entity.x, entity.y + fp.height).x;
      const right = worldToIso(entity.x + fp.width, entity.y).x;
      const groundBottom = worldToIso(entity.x + fp.width, entity.y + fp.height).y;
      for (const point of spy.points) {
        expect(point.x).toBeGreaterThanOrEqual(left - tol);
        expect(point.x).toBeLessThanOrEqual(right + tol);
        expect(point.y).toBeLessThanOrEqual(groundBottom + tol); // never below the ground
      }
    }
  });

  it('draws distinct roof accents across roles (mill blades, wonder dome arc, wall merlons; plain house)', () => {
    const mill = render({ entityType: 'mill', footprintWidth: 2, footprintHeight: 2 }).spy;
    const wonder = render({ entityType: 'wonder', footprintWidth: 4, footprintHeight: 4 }).spy;
    const wall = render({ entityType: 'stone-wall', footprintWidth: 1, footprintHeight: 1 }).spy;
    const house = render({ entityType: 'house', footprintWidth: 2, footprintHeight: 2 }).spy;

    // mill: four-blade cross -> line segments; wonder: dome -> an arc; wall:
    // crenellations -> merlon fillRects.
    expect(mill.calls.filter((c) => c.op === 'lineBetween').length).toBeGreaterThanOrEqual(2);
    expect(wonder.calls.some((c) => c.op === 'arc')).toBe(true);
    expect(wall.calls.some((c) => c.op === 'fillRect')).toBe(true);
    // A plain house has no roof accent — just the extruded volume (fillPoints),
    // so it has no dome arc and no merlon fillRects.
    expect(house.calls.some((c) => c.op === 'arc')).toBe(false);
    expect(house.calls.some((c) => c.op === 'fillRect')).toBe(false);
    expect(house.calls.some((c) => c.op === 'fillPoints')).toBe(true);
  });

  it('reports the completed-structure flags for a completed building (contract)', () => {
    const { visual } = render({
      entityType: 'town-center',
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'complete',
    });
    expect(visual).not.toBeNull();
    expect(visual?.hasStructureBody).toBe(true);
    expect(visual?.hasRoofAccent).toBe(true);
    expect(visual?.hasCompletionAccent).toBe(true);
    expect(visual?.hasFoundationSlab).toBe(false);
    expect(visual?.hasScaffoldPosts).toBe(false);
    expect(visual?.hasConstructionIndicator).toBe(false);
  });

  it('reports the construction flags for a building under construction (contract unchanged)', () => {
    const { visual } = render({
      entityType: 'house',
      footprintWidth: 2,
      footprintHeight: 2,
      visualVariant: 'construction',
    });
    expect(visual).not.toBeNull();
    expect(visual?.hasFoundationSlab).toBe(true);
    expect(visual?.hasScaffoldPosts).toBe(true);
    expect(visual?.hasConstructionIndicator).toBe(true);
    expect(visual?.hasStructureBody).toBe(false);
    expect(visual?.hasRoofAccent).toBe(false);
    expect(visual?.hasCompletionAccent).toBe(false);
  });

  it('keeps construction stubs plain, without completed-building material seams', () => {
    const { spy } = render({
      entityType: 'castle',
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'construction',
    });
    expect(spy.calls.filter((c) => c.op === 'lineBetween')).toHaveLength(0);
  });

  it('returns null for a memory (last-seen ghost) building', () => {
    const { visual, spy } = render({
      entityType: 'castle',
      footprintWidth: 4,
      footprintHeight: 4,
      visualVariant: 'complete',
      isMemory: true,
    });
    expect(visual).toBeNull();
    // ghost still paints the flat tinted footprint diamond (no extruded volume).
    expect(spy.calls.some((c) => c.op === 'fillPoints')).toBe(true);
  });

  it('returns null for a non-building entity', () => {
    const spy = createGraphicsSpy();
    const renderer = createBuildingRenderer({
      entityLayer: spy.graphics as never,
      cellSize: CELL_SIZE,
    });
    const unit = createBuilding({ kind: 'unit', entityType: 'villager' });
    expect(renderer.renderBuildingEntity(unit, 0, 0)).toBeNull();
  });
});
