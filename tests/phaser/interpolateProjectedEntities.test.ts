import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import {
  interpolateProjectedEntities,
  renderIdentityKey,
} from '../../src/phaser/scenes/interpolateProjectedEntities';

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
