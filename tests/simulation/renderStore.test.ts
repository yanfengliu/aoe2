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

describe('RenderStore tick tracking', () => {
  it('follows forward ticks and a rewinding snapshot', () => {
    const store = new RenderStore();
    store.apply(snapshot(10, [entity(1)]));
    store.apply(tick(11, [entity(2)]));
    expect(store.getTick()).toBe(11);
    expect(store.getEntities()[0]).toMatchObject({ x: 2, y: 4 });

    store.apply(snapshot(4, [entity(8)]));

    expect(store.getTick()).toBe(4);
    expect(store.getEntities()[0]).toMatchObject({ x: 8, y: 4 });
  });
});

describe('RenderStore transient attack reconciliation', () => {
  it('touches only active and previously active attackers, then forgets expired keys', () => {
    const store = new RenderStore();
    store.apply(snapshot(20, [entity(1), entity(2, { id: 8, generation: 0 })]));

    expect(store.reconcileUnitAttackAnimations(new Map([
      ['7:3', { tick: 20, sourceX: 3, sourceY: 4, targetX: 5, targetY: 4 }],
    ]))).toBe(1);
    expect(store.getEntities().find((view) => view.id === 7)?.attackAnimation).toEqual({
      tick: 20,
      sourceX: 3,
      sourceY: 4,
      targetX: 5,
      targetY: 4,
    });

    expect(store.reconcileUnitAttackAnimations(new Map())).toBe(1);
    expect(store.getEntities().find((view) => view.id === 7)?.attackAnimation).toBeUndefined();

    // Once the transient key has been cleared, quiet ticks do no per-unit work.
    expect(store.reconcileUnitAttackAnimations(new Map())).toBe(0);
  });

  it('replaces an active cue when its captured source changes', () => {
    const store = new RenderStore();
    store.apply(snapshot(20, [entity(1)]));
    store.reconcileUnitAttackAnimations(new Map([[
      '7:3',
      { tick: 20, sourceX: 1, sourceY: 4, targetX: 5, targetY: 4 },
    ]]));

    store.reconcileUnitAttackAnimations(new Map([[
      '7:3',
      { tick: 20, sourceX: 2, sourceY: 3, targetX: 5, targetY: 4 },
    ]]));

    expect(store.getEntities()[0]?.attackAnimation).toMatchObject({
      sourceX: 2,
      sourceY: 3,
    });
  });
});
