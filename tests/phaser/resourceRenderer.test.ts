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
    } as unknown as Phaser.GameObjects.Graphics,
  };
}

describe('drawResourceEntity (extracted from GameScene)', () => {
  const px = 4 * CELL_SIZE;
  const py = 3 * CELL_SIZE;

  it('draws square-footprint resources (mine/tree) as an inset filled rect using the tint + alpha', () => {
    for (const kind of ['gold-mine', 'stone-mine', 'tree'] as ResourceKind[]) {
      const spy = createGraphicsSpy();
      drawResourceEntity(spy.graphics, createResource(kind), px, py, CELL_SIZE, 0.5);
      expect(spy.calls[0]).toEqual({ op: 'fillStyle', args: [0x88aa44, 0.5] });
      const rect = spy.calls.find((c) => c.op === 'fillRect');
      expect(rect?.args).toEqual([
        px + CELL_SIZE * 0.1,
        py + CELL_SIZE * 0.1,
        CELL_SIZE * 1,
        CELL_SIZE * 1,
      ]);
      expect(spy.calls.find((c) => c.op === 'fillCircle')).toBeUndefined();
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
