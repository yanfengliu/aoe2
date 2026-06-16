import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView, UnitType } from '../../src/game/simulation/types';
import {
  createUnitRenderer,
  unitFacingRadians,
  unitRole,
  type UnitRole,
} from '../../src/phaser/scenes/gameScene/unitRenderer';
import { ALL_UNIT_TYPES } from '../../src/phaser/scenes/gameScene/unitTypeMap';

const CELL_SIZE = 24;

function createUnit(overrides: Partial<ProjectedEntityView>): ProjectedEntityView {
  return {
    id: 1,
    kind: 'unit',
    layer: 'unit',
    entityType: 'villager',
    owner: 1,
    x: 6,
    y: 5,
    tint: 0x3fa7ff,
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

// A tiny Phaser.GameObjects.Graphics stand-in that records each primitive draw
// call. The unit renderer only ever calls fill/line styling + fill primitives;
// we record the calls + every (x, y) point passed so a test can assert the
// drawn primitive SET per role and that everything stays inside the unit's
// bounding circle.
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
    fillCircle: (x: number, y: number, r: number) => record('fillCircle', [[x, y]], [r]),
    strokeCircle: (x: number, y: number, r: number) => record('strokeCircle', [[x, y]], [r]),
    fillRect: (x: number, y: number, w: number, h: number) => {
      record('fillRect', [[x, y], [x + w, y + h]]);
    },
    fillRoundedRect: (x: number, y: number, w: number, h: number) => {
      record('fillRoundedRect', [[x, y], [x + w, y + h]]);
    },
    fillTriangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
      record('fillTriangle', [[x1, y1], [x2, y2], [x3, y3]]);
    },
    fillEllipse: (x: number, y: number, w: number, h: number) => {
      record('fillEllipse', [[x, y]], [w, h]);
      // ellipse extent contributes to the bounding check
      points.push({ x: x - w / 2, y: y - h / 2 }, { x: x + w / 2, y: y + h / 2 });
    },
    lineBetween: (x1: number, y1: number, x2: number, y2: number) => {
      record('lineBetween', [[x1, y1], [x2, y2]]);
    },
    beginPath: () => calls.push({ op: 'beginPath', args: [] }),
    arc: (x: number, y: number, r: number) => record('arc', [[x, y]], [r]),
    strokePath: () => calls.push({ op: 'strokePath', args: [] }),
  };
  return { graphics, calls, points };
}

describe('unitRole', () => {
  const cases: Array<[UnitType, UnitRole]> = [
    ['villager', 'villager'],
    ['militia', 'infantry'],
    ['man-at-arms', 'infantry'],
    ['two-handed-swordsman', 'infantry'],
    ['champion', 'infantry'],
    ['spearman', 'infantry'],
    ['halberdier', 'infantry'],
    ['archer', 'archer'],
    ['arbalest', 'archer'],
    ['longbowman', 'archer'],
    ['skirmisher', 'archer'], // ranged but NOT in ARCHER_LINE_UNITS
    ['scout', 'cavalry'],
    ['knight', 'cavalry'],
    ['paladin', 'cavalry'],
    ['camel', 'cavalry'],
    ['heavy-camel', 'cavalry'],
    ['hussar', 'cavalry'],
    ['cavalry-archer', 'cavalry-archer'],
    ['heavy-cavalry-archer', 'cavalry-archer'],
    ['mangonel', 'siege'],
    ['onager', 'siege'],
    ['scorpion', 'siege'],
    ['battering-ram', 'siege'],
    ['trebuchet', 'siege'],
    ['bombard-cannon', 'siege'],
    ['monk', 'monk'],
  ];

  it.each(cases)('maps %s to role %s', (unitType, role) => {
    expect(unitRole(unitType)).toBe(role);
  });

  it('returns a role for every UnitType (exhaustive)', () => {
    for (const unitType of Object.keys(ALL_UNIT_TYPES) as UnitType[]) {
      expect(typeof unitRole(unitType)).toBe('string');
    }
  });
});

describe('unitFacingRadians', () => {
  it('returns ~0 for a rightward (east) movement', () => {
    const angle = unitFacingRadians({ x: 5, y: 5 }, { x: 6, y: 5 }, 1);
    expect(angle).not.toBeNull();
    expect(Math.abs(angle as number)).toBeLessThan(0.01);
  });

  it('returns ~pi/2 for a downward (south) movement', () => {
    const angle = unitFacingRadians({ x: 5, y: 5 }, { x: 5, y: 6 }, 1);
    expect(angle).not.toBeNull();
    expect(Math.abs((angle as number) - Math.PI / 2)).toBeLessThan(0.01);
  });

  it('returns null when there is no previous position', () => {
    expect(unitFacingRadians(undefined, { x: 5, y: 5 }, 1)).toBeNull();
  });

  it('returns null when raw per-tick movement is below the idle threshold', () => {
    // raw |Δ| = 0.000141 (< 0.02 epsilon) at full alpha → genuinely idle.
    expect(unitFacingRadians({ x: 5, y: 5 }, { x: 5.0001, y: 5.0001 }, 1)).toBeNull();
  });

  it('does NOT read idle for a moving unit early in a tick (alpha-independent gate)', () => {
    // raw |Δ| = 0.5 cells/tick, but alpha = 0.03 → interpolated delta 0.015.
    // Gating the interpolated magnitude directly (0.015 < 0.02) would wrongly read
    // idle and flicker the facing to the rest pose; the alpha-scaled gate
    // (0.015 < 0.02·0.03 = 0.0006 is false) keeps the unit facing east.
    const angle = unitFacingRadians({ x: 5, y: 5 }, { x: 5.015, y: 5 }, 0.03);
    expect(angle).not.toBeNull();
    expect(Math.abs(angle as number)).toBeLessThan(0.01);
  });

  it('returns null at the exact tick boundary (alpha 0)', () => {
    expect(unitFacingRadians({ x: 5, y: 5 }, { x: 5, y: 5 }, 0)).toBeNull();
  });
});

describe('createUnitRenderer.drawUnit', () => {
  function drawRole(unitType: UnitType, size: number) {
    const spy = createGraphicsSpy();
    const renderer = createUnitRenderer({ graphics: spy.graphics as never, cellSize: CELL_SIZE });
    const entity = createUnit({ entityType: unitType, size });
    const px = entity.x * CELL_SIZE;
    const py = entity.y * CELL_SIZE;
    renderer.drawUnit(entity, px, py, 0, 1);
    return { spy, px, py, entity };
  }

  it('draws something for every role', () => {
    for (const unitType of Object.keys(ALL_UNIT_TYPES) as UnitType[]) {
      const { spy } = drawRole(unitType, 0.55);
      const fillOps = spy.calls.filter((c) => c.op.startsWith('fill') && c.op !== 'fillStyle');
      expect(fillOps.length).toBeGreaterThan(0);
    }
  });

  it('uses the entity tint as a fill color', () => {
    const { spy, entity } = drawRole('militia', 0.5);
    const usedTint = spy.calls.some((c) => c.op === 'fillStyle' && c.args[0] === entity.tint);
    expect(usedTint).toBe(true);
  });

  it('keeps every drawn point within the unit bounding circle', () => {
    // The health-bar + selection-ring geometry assume the unit occupies the
    // cell-centred circle of radius size*0.5 cells. A small tolerance covers
    // outline stroke width.
    for (const [unitType, size] of [
      ['villager', 0.45],
      ['champion', 0.52],
      ['archer', 0.48],
      ['knight', 0.58],
      ['cavalry-archer', 0.55],
      ['mangonel', 0.68],
      ['monk', 0.48],
    ] as Array<[UnitType, number]>) {
      const { spy, px, py } = drawRole(unitType, size);
      const cx = px + CELL_SIZE * 0.5;
      const cy = py + CELL_SIZE * 0.5;
      const maxR = CELL_SIZE * size * 0.5 + 3; // +3px outline tolerance
      for (const point of spy.points) {
        const dist = Math.hypot(point.x - cx, point.y - cy);
        expect(dist).toBeLessThanOrEqual(maxR);
      }
    }
  });

  it('draws distinct primitive sets per role (siege has rects, monk has a cross, cavalry has an elongated body)', () => {
    const siege = drawRole('mangonel', 0.68).spy;
    const monk = drawRole('monk', 0.48).spy;
    const cavalry = drawRole('knight', 0.58).spy;

    // siege: a boxy chassis -> at least one rect primitive
    expect(siege.calls.some((c) => c.op === 'fillRect' || c.op === 'fillRoundedRect')).toBe(true);
    // monk: a cross -> at least two line segments
    expect(monk.calls.filter((c) => c.op === 'lineBetween').length).toBeGreaterThanOrEqual(2);
    // cavalry: an elongated mount body -> an ellipse
    expect(cavalry.calls.some((c) => c.op === 'fillEllipse')).toBe(true);
  });
});
