import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  interpolateProjectedEntities,
  renderIdentityKey,
} from '../../src/rendering/interpolateProjectedEntities';

function createProjectedEntity(
  overrides: Partial<ProjectedEntityView>,
): ProjectedEntityView {
  return {
    id: 1,
    kind: 'unit',
    layer: 'unit',
    entityType: 'scout',
    owner: 1,
    x: 6,
    y: 5,
    tint: 0xffffff,
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
}

describe('interpolateProjectedEntities', () => {
  it('interpolates unit positions between the previous and current tick positions', () => {
    const entity = createProjectedEntity({ id: 7, generation: 3, x: 6, y: 5 });
    const previousPositions = new Map<string, { x: number; y: number }>([
      [renderIdentityKey(entity), { x: 5, y: 5 }],
    ]);

    const displayed = interpolateProjectedEntities([entity], previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({
      x: 5.5,
      y: 5,
    });
    expect(displayed[0]).not.toBe(entity);
  });

  it('uses a persisted attack source for a fresh cancellation-tick checkpoint', () => {
    const entity = createProjectedEntity({
      id: 7,
      generation: 3,
      x: 5.5,
      y: 5,
      attackAnimation: {
        tick: 4,
        cancelTick: 5,
        sourceX: 5,
        sourceY: 5,
        targetX: 6,
        targetY: 5,
      },
    });

    expect(interpolateProjectedEntities([entity], new Map(), 0, 5)[0]).toMatchObject({
      x: 5,
      y: 5,
    });
    expect(interpolateProjectedEntities([entity], new Map(), 0.5, 5)[0]).toMatchObject({
      x: 5.25,
      y: 5,
    });
  });

  it('does NOT inherit a destroyed unit position when the id is recycled (full-review id:generation)', () => {
    // A unit with id 7 / generation 1 was at (5,5) last tick, was destroyed,
    // and its id was recycled by a NEW unit (id 7 / generation 2) now at (6,5).
    // Keyed by raw id the new unit would slide 6→5.5; keyed by id:generation it
    // finds no prior position under 7:2 and stays put (snap, no phantom slide).
    const recycled = createProjectedEntity({ id: 7, generation: 2, x: 6, y: 5 });
    const previousPositions = new Map<string, { x: number; y: number }>([
      [renderIdentityKey({ id: 7, generation: 1 }), { x: 5, y: 5 }],
    ]);

    const displayed = interpolateProjectedEntities([recycled], previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({ x: 6, y: 5 });
    // Unchanged reference: no previous position → returned as-is.
    expect(displayed[0]).toBe(recycled);
    // Sanity: raw-id keying WOULD have found the stale entry and mis-slid.
    expect(previousPositions.get(String(recycled.id))).toBeUndefined();
  });

  it('interpolates a moving live sheep even though it projects through the resource layer', () => {
    const sheep = createProjectedEntity({
      id: 12,
      generation: 4,
      kind: 'resource',
      layer: 'resource',
      entityType: 'sheep',
      owner: 1,
      x: 8,
      y: 6,
      currentHp: null,
      maxHp: null,
    });
    const previousPositions = new Map<string, { x: number; y: number }>([
      [renderIdentityKey(sheep), { x: 7.5, y: 6 }],
    ]);

    const displayed = interpolateProjectedEntities([sheep], previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({ x: 7.75, y: 6 });
    expect(displayed[0]).not.toBe(sheep);
  });

  it('preserves static resources and fog memories without allocating interpolated copies', () => {
    const tree = createProjectedEntity({
      id: 13,
      kind: 'resource',
      layer: 'resource',
      entityType: 'tree',
      x: 9,
      y: 6,
      currentHp: null,
      maxHp: null,
    });
    const memory = createProjectedEntity({
      id: 14,
      kind: 'resource',
      layer: 'resource',
      entityType: 'tree',
      x: 10,
      y: 6,
      currentHp: null,
      maxHp: null,
      isMemory: true,
    });
    const previousPositions = new Map<string, { x: number; y: number }>([
      [renderIdentityKey(tree), { x: 9, y: 6 }],
      [renderIdentityKey(memory), { x: 4, y: 6 }],
    ]);

    const displayed = interpolateProjectedEntities(
      [tree, memory],
      previousPositions,
      0.5,
    );

    expect(displayed[0]).toBe(tree);
    expect(displayed[1]).toBe(memory);
  });

  it('keeps non-unit entities at their authoritative projected positions', () => {
    const entities = [
      createProjectedEntity({
        id: 9,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        x: 10,
        y: 8,
        footprintWidth: 2,
        footprintHeight: 2,
        visualVariant: 'complete',
      }),
    ];
    const previousPositions = new Map<string, { x: number; y: number }>([
      [renderIdentityKey(entities[0]), { x: 9, y: 8 }],
    ]);

    const displayed = interpolateProjectedEntities(entities, previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({
      x: 10,
      y: 8,
    });
  });
});
