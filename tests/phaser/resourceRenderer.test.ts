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
      fillTriangle: (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
        calls.push({ op: 'fillTriangle', args: [x1, y1, x2, y2, x3, y3] });
      },
      lineStyle: (width: number, color: number, alpha?: number) => {
        calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] });
      },
      lineBetween: (x1: number, y1: number, x2: number, y2: number) => {
        calls.push({ op: 'lineBetween', args: [x1, y1, x2, y2] });
      },
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

  it('draws a tree with a layered canopy: shaded base clumps + crown + a sun-lit highlight', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('tree'), px, py, CELL_SIZE, 1);
    // A fuller crown = at least 3 filled circles (≥2 base clumps + crown + highlight),
    // not the single flat circle of the old tree.
    expect(spy.calls.filter((c) => c.op === 'fillCircle').length).toBeGreaterThanOrEqual(3);
    const fills = spy.calls.filter((c) => c.op === 'fillStyle').map((c) => c.args[0]);
    expect(fills).toContain(0x88aa44); // crown = the raw tree tint
    // a darker shaded clump (excluding the brown trunk + black shadow) AND a
    // lighter sun-lit highlight, so the crown reads as a lit 3-D mass.
    const darker = fills.filter((g) => g < 0x88aa44 && g !== 0x5b3b1e && g !== 0x000000);
    const lighter = fills.filter((g) => g > 0x88aa44);
    expect(darker.length).toBeGreaterThan(0);
    expect(lighter.length).toBeGreaterThan(0);
  });

  it('varies tree canopy geometry per cell so a forest is not uniformly stamped', () => {
    const a = createGraphicsSpy();
    const b = createGraphicsSpy();
    drawResourceEntity(a.graphics, createResource('tree', { x: 4, y: 3 }), px, py, CELL_SIZE, 1);
    drawResourceEntity(b.graphics, createResource('tree', { x: 5, y: 9 }), px, py, CELL_SIZE, 1);
    const radii = (calls: DrawCall[]) => calls.filter((c) => c.op === 'fillCircle').map((c) => c.args[2]);
    expect(radii(a.calls)).not.toEqual(radii(b.calls));
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

  it('draws a berry bush as a green foliage mound studded with berry dots (not a flat circle)', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('berry-bush'), px, py, CELL_SIZE, 1);
    // foliage blobs + berry dots = several circles, not one flat circle.
    expect(spy.calls.filter((c) => c.op === 'fillCircle').length).toBeGreaterThanOrEqual(4);
    // a ground shadow ellipse grounds it on the iso terrain.
    expect(spy.calls.some((c) => c.op === 'fillEllipse')).toBe(true);
    // the berry tint (the createResource default 0x88aa44) is used for the berries,
    // AND a distinct green foliage colour (not the tint, not black) for the mound.
    const fills = spy.calls.filter((c) => c.op === 'fillStyle').map((c) => c.args[0]);
    expect(fills).toContain(0x88aa44);
    expect(fills.some((g) => g !== 0x88aa44 && g !== 0x000000)).toBe(true);
  });

  it('draws other resources (fish, farm, relic) as a centred circle', () => {
    for (const kind of ['fish', 'farm', 'relic'] as ResourceKind[]) {
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

  it('draws wildlife (sheep/boar/wolf) as a small animal figure: body + head over a shadow', () => {
    for (const kind of ['sheep', 'boar', 'wolf'] as ResourceKind[]) {
      const spy = createGraphicsSpy();
      drawResourceEntity(spy.graphics, createResource(kind), px, py, CELL_SIZE, 1);
      // a body ellipse + a ground shadow ellipse (2 ellipses)
      expect(spy.calls.filter((c) => c.op === 'fillEllipse').length).toBeGreaterThanOrEqual(2);
      // a head circle
      expect(spy.calls.some((c) => c.op === 'fillCircle')).toBe(true);
      // the tint is used for the body/head
      expect(spy.calls.some((c) => c.op === 'fillStyle' && c.args[0] === 0x88aa44)).toBe(true);
    }
  });

  it('draws sheep with wool clumps and small legs, not the generic wildlife silhouette', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('sheep'), px, py, CELL_SIZE, 1);
    expect(spy.calls.filter((c) => c.op === 'fillCircle').length).toBeGreaterThanOrEqual(4);
    expect(spy.calls.filter((c) => c.op === 'lineBetween').length).toBeGreaterThanOrEqual(2);
    expect(spy.calls.some((c) => c.op === 'fillTriangle')).toBe(false);
  });

  it('draws boar with tusks so huntable wildlife reads as dangerous at default zoom', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('boar'), px, py, CELL_SIZE, 1);
    expect(spy.calls.filter((c) => c.op === 'fillTriangle').length).toBeGreaterThanOrEqual(2);
    expect(spy.calls.filter((c) => c.op === 'lineBetween').length).toBeGreaterThanOrEqual(2);
  });

  it('draws wolves with pointed ears and a tail so they differ from boar and sheep', () => {
    const spy = createGraphicsSpy();
    drawResourceEntity(spy.graphics, createResource('wolf'), px, py, CELL_SIZE, 1);
    expect(spy.calls.filter((c) => c.op === 'fillTriangle').length).toBeGreaterThanOrEqual(3);
    expect(spy.calls.filter((c) => c.op === 'lineBetween').length).toBeGreaterThanOrEqual(2);
  });

  it('uses distinct primitive signatures for sheep, boar, and wolf', () => {
    const signatures = (['sheep', 'boar', 'wolf'] as ResourceKind[]).map((kind) => {
      const spy = createGraphicsSpy();
      drawResourceEntity(spy.graphics, createResource(kind), px, py, CELL_SIZE, 1);
      return spy.calls
        .filter((c) => c.op !== 'fillStyle' && c.op !== 'lineStyle')
        .map((c) => c.op)
        .join(',');
    });
    expect(new Set(signatures).size).toBe(3);
  });
});
