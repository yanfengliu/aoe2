import type { RenderEntity, RenderServerMessage } from 'civ-engine';
import { describe, expect, it } from 'vitest';

import { RenderStore } from '../../src/game/simulation/renderStore';
import type {
  ProjectedEntityView,
  ProjectedFrameView,
} from '../../src/game/simulation/types';

type TestMessage = RenderServerMessage<
  ProjectedEntityView,
  ProjectedFrameView,
  null
>;

function entity(
  x: number,
  overrides: Partial<ProjectedEntityView> = {},
): RenderEntity<ProjectedEntityView> {
  const view: ProjectedEntityView = {
    id: 7,
    generation: 3,
    kind: 'unit',
    layer: 'unit',
    entityType: 'scout',
    owner: 1,
    x,
    y: 4,
    elevation: 0,
    tint: 0x3568c0,
    size: 0.8,
    footprintWidth: 1,
    footprintHeight: 1,
    visualVariant: 'default',
    selected: false,
    currentHp: 45,
    maxHp: 45,
    isMemory: false,
    ...overrides,
  };
  return {
    ref: { id: view.id, generation: view.generation ?? 0 },
    view,
  };
}

function snapshot(tick: number, entities: RenderEntity<ProjectedEntityView>[]): TestMessage {
  return {
    type: 'renderSnapshot',
    data: {
      render: { tick, entities, frame: null },
      debug: null,
    },
  };
}

function tick(
  tickNumber: number,
  updated: RenderEntity<ProjectedEntityView>[],
): TestMessage {
  return {
    type: 'renderTick',
    data: {
      render: {
        tick: tickNumber,
        created: [],
        updated,
        destroyed: [],
        frame: null,
      },
      debug: null,
    },
  };
}

describe('RenderStore interpolation frame', () => {
  it('retains the exact immediately preceding tick when multiple ticks arrive between reads', () => {
    const store = new RenderStore();
    store.apply(snapshot(0, [entity(1)]));
    store.apply(tick(1, [entity(2)]));
    store.apply(tick(2, [entity(3)]));

    const previous = store.getPreviousPositionFrame();

    expect(previous).toEqual({
      tick: 1,
      positions: [{ id: 7, generation: 3, x: 2, y: 4 }],
    });
    expect(structuredClone(previous)).toEqual(previous);
  });

  it('does not overwrite the prior tick during a same-tick snapshot refresh', () => {
    const store = new RenderStore();
    store.apply(snapshot(10, [entity(1)]));
    store.apply(tick(11, [entity(2)]));
    store.apply(snapshot(11, [entity(2, { selected: true })]));

    expect(store.getPreviousPositionFrame()).toEqual({
      tick: 10,
      positions: [{ id: 7, generation: 3, x: 1, y: 4 }],
    });
  });

  it('clears prior-position history when a snapshot rewinds the render tick', () => {
    const store = new RenderStore();
    store.apply(snapshot(10, [entity(1)]));
    store.apply(tick(11, [entity(2)]));

    expect(store.getPreviousPositionFrame()?.tick).toBe(10);

    store.apply(snapshot(4, [entity(8)]));

    expect(store.getTick()).toBe(4);
    expect(store.getPreviousPositionFrame()).toBeNull();
  });
});
