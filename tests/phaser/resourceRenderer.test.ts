import { describe, expect, it } from 'vitest';

import { drawResourceEntity } from '../../src/phaser/scenes/gameScene/resourceRenderer';
import type { ProjectedEntityView, ResourceKind } from '../../src/game/simulation/types';

const CELL_SIZE = 24;

function createResource(entityType: ResourceKind, overrides: Partial<ProjectedEntityView> = {}): ProjectedEntityView {
  return {
    id: 1,
    kind: 'resource',
    layer: 'resource',
    entityType,
    owner: null,
    x: 4,
    y: 3,
    tint: 0x88aa44,
    size: 1,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: null,
    maxHp: null,
    isMemory: false,
    ...overrides,
  };
}

interface DrawCall {
  op: string;
  args: number[];
}
function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  return {
    calls,
    graphics: {
      fillStyle: (color: number, alpha?: number) => calls.push({ op: 'fillStyle', args: [color, alpha ?? 1] }),
      fillRect: (x: number, y: number, w: number, h: number) => calls.push({ op: 'fillRect', args: [x, y, w, h] }),
      fillCircle: (x: number, y: number, r: number) => calls.push({ op: 'fillCircle', args: [x, y, r] }),
      fillEllipse: (x: number, y: number, w: number, h: number) => calls.push({ op: 'fillEllipse', args: [x, y, w, h] }),
    } as unknown as Phaser.GameObjects.Graphics,
  };
}

describe('drawResourceEntity (extracted from GameScene)', () => {
  const px = 4 * CELL_SIZE;
  const py = 3 * CELL_SIZE;

  it('draws a tree as a raised canopy + trunk + ground shadow (iso), tinted canopy', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('tree'), px, py, CELL_SIZE, 1);
    const cy = py + CELL_SIZE * 0.5;
    // ground shadow ellipse BELOW the cell centre
    const shadow = spy.calls.find((c) => c.op === 'fillEllipse');
    expect(shadow).toBeDefined();
    expect(shadow!.args[1]).toBeGreaterThan(cy);
    // a trunk rect
    expect(spy.calls.some((c) => c.op === 'fillRect')).toBe(true);
    // a canopy circle ABOVE the cell centre
    const canopy = spy.calls.find((c) => c.op === 'fillCircle');
    expect(canopy).toBeDefined();
    expect(canopy!.args[1]).toBeLessThan(cy);
    // the tree tint is used as a fill colour (the canopy)
    expect(spy.calls.some((c) => c.op === 'fillStyle' && c.args[0] === 0x88aa44)).toBe(true);
  });

  it('draws a gold/stone mine as an iso mound of rock lumps + a ground shadow, tinted', () => {
    for (const kind of ['gold-mine', 'stone-mine'] as ResourceKind[]) {
      const spy = createGraphicsSpy();
      drawResourceEntity(spy.graphics, createResource(kind), px, py, CELL_SIZE, 1);
      expect(spy.calls.filter((c) => c.op === 'fillCircle').length).toBeGreaterThanOrEqual(2);
      expect(spy.calls.some((c) => c.op === 'fillEllipse')).toBe(true);
      expect(spy.calls.some((c) => c.op === 'fillStyle' && c.args[0] === 0x88aa44)).toBe(true);
      expect(spy.calls.some((c) => c.op === 'fillRect')).toBe(false);
    }
  });

  it('draws other resources (berry bush, sheep, fish, farm, relic) as a centred circle', () => {
    for (const kind of ['berry-bush', 'sheep', 'fish', 'farm', 'relic'] as ResourceKind[]) {
      const spy = createGraphicsSpy();
      drawResourceEntity(spy.graphics, createResource(kind), px, py, CELL_SIZE, 1);
      const circle = spy.calls.find((c) => c.op === 'fillCircle');
      expect(circle?.args).toEqual([
        px + CELL_SIZE * 0.5,
        py + CELL_SIZE * 0.5,
        CELL_SIZE * 1 * 0.55,
      ]);
      expect(spy.calls.find((c) => c.op === 'fillRect')).toBeUndefined();
    }
  });
});
