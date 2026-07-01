import { describe, expect, it } from 'vitest';

import { createSelectionLayersRenderer } from '../../src/phaser/scenes/gameScene/selectionLayers';
import type { ProjectedEntityView, SelectionState } from '../../src/game/simulation/types';
import type { SelectionPulse } from '../../src/phaser/scenes/gameScene/feedbackEffects';

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
    selected: true,
    currentHp: 25,
    maxHp: 25,
    isMemory: false,
    ...overrides,
  };
}

interface DrawCall {
  op: string;
  args: number[];
}

// A Graphics spy capturing the calls the selection renderer makes. Only the
// methods renderSelection touches are stubbed.
function createGraphicsSpy() {
  const calls: DrawCall[] = [];
  return {
    calls,
    graphics: {
      lineStyle: (width: number, color: number, alpha?: number) =>
        calls.push({ op: 'lineStyle', args: [width, color, alpha ?? 1] }),
      strokeCircle: (x: number, y: number, r: number) => calls.push({ op: 'strokeCircle', args: [x, y, r] }),
      strokeRoundedRect: (x: number, y: number, w: number, h: number, radius: number) =>
        calls.push({ op: 'strokeRoundedRect', args: [x, y, w, h, radius] }),
      // unused by these tests but needed to satisfy the factory's layer shape
      fillStyle: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      fillCircle: () => {},
      lineBetween: () => {},
    } as unknown as Phaser.GameObjects.Graphics,
  };
}

function makeRenderer(selectionLayer: Phaser.GameObjects.Graphics) {
  const noop = (() => {}) as unknown as Phaser.GameObjects.Graphics;
  return createSelectionLayersRenderer({
    selectionLayer,
    placementLayer: noop,
    selectionBoxLayer: noop,
    cellSize: CELL_SIZE,
    screenToWorldPoint: (x, y) => ({ x, y }),
    getDisplayedEntities: () => [],
  });
}

const SELECTION: SelectionState = {
  selectedEntityId: 1,
  selectedEntityIds: [1],
  selectedCount: 1,
  selectedKind: 'unit',
  selectedEntityType: 'villager',
  owner: 1,
  health: null,
  attack: null,
  armor: null,
  pierceArmor: null,
  faction: null,
  civ: null,  inventory: null,
  activity: null,
  activityBreakdown: null,
  x: null,
  y: null,
  tileX: null,
  tileY: null,
  tileEntityIndex: null,
  tileEntityCount: 0,
  resourceAmount: null,
  resourceMaxAmount: null,
  actionOptions: [],
  buildOptions: [],
  marketOptions: [],
  trainOptions: [],
  visibleResearchOptions: [],
  researchOptions: [],
  queue: [],
  placementMode: null,
};

describe('renderSelection — pulse modulation (M7 selection polish)', () => {
  it('without a pulse, draws the unchanged static ring (alpha 0.9, width 2, base radius)', () => {
    const spy = createGraphicsSpy();
    const renderer = makeRenderer(spy.graphics);
    renderer.renderSelection([createUnit({})], SELECTION);

    const lineStyle = spy.calls.find((c) => c.op === 'lineStyle');
    expect(lineStyle?.args).toEqual([2, 0xf7e5a5, 0.9]);
    const circle = spy.calls.find((c) => c.op === 'strokeCircle');
    // base radius = cellSize * max(size, 0.55) = 24 * 0.55 = 13.2, centered.
    expect(circle?.args[2]).toBeCloseTo(CELL_SIZE * 0.55, 5);
    expect(circle?.args[0]).toBeCloseTo(6 * CELL_SIZE + CELL_SIZE * 0.5, 5);
  });

  it('with a pulse, applies the pulse alpha + width and adds the radius offset (center + base preserved)', () => {
    const spy = createGraphicsSpy();
    const renderer = makeRenderer(spy.graphics);
    const pulse: SelectionPulse = { alpha: 1, radiusOffsetPx: 2, lineWidth: 3 };
    renderer.renderSelection([createUnit({})], SELECTION, pulse);

    const lineStyle = spy.calls.find((c) => c.op === 'lineStyle');
    expect(lineStyle?.args).toEqual([3, 0xf7e5a5, 1]);
    const circle = spy.calls.find((c) => c.op === 'strokeCircle');
    // radius = base + offset; center is unchanged.
    expect(circle?.args[2]).toBeCloseTo(CELL_SIZE * 0.55 + 2, 5);
    expect(circle?.args[0]).toBeCloseTo(6 * CELL_SIZE + CELL_SIZE * 0.5, 5);
    expect(circle?.args[1]).toBeCloseTo(5 * CELL_SIZE + CELL_SIZE * 0.5, 5);
  });

  it('with a pulse, inflates the building ring outward but keeps the footprint origin centered', () => {
    const spy = createGraphicsSpy();
    const renderer = makeRenderer(spy.graphics);
    const building = createUnit({
      id: 2,
      kind: 'building',
      entityType: 'town-center',
      footprintWidth: 4,
      footprintHeight: 4,
      x: 10,
      y: 10,
    });
    const selection: SelectionState = { ...SELECTION, selectedEntityId: 2, selectedEntityIds: [2] };
    const pulse: SelectionPulse = { alpha: 1, radiusOffsetPx: 2, lineWidth: 3 };
    renderer.renderSelection([building], selection, pulse);

    const rect = spy.calls.find((c) => c.op === 'strokeRoundedRect');
    // inflated by the offset on each side: x-2, y-2, w+4, h+4 — footprint center unchanged.
    expect(rect?.args[0]).toBeCloseTo(10 * CELL_SIZE - 2, 5);
    expect(rect?.args[1]).toBeCloseTo(10 * CELL_SIZE - 2, 5);
    expect(rect?.args[2]).toBeCloseTo(4 * CELL_SIZE + 4, 5);
    expect(rect?.args[3]).toBeCloseTo(4 * CELL_SIZE + 4, 5);
  });

  it('does not draw a ring for a memory entity even when in the selection set', () => {
    const spy = createGraphicsSpy();
    const renderer = makeRenderer(spy.graphics);
    renderer.renderSelection([createUnit({ isMemory: true })], SELECTION);
    expect(spy.calls.find((c) => c.op === 'strokeCircle')).toBeUndefined();
  });
});
