import { describe, expect, it } from 'vitest';

import type { ProjectedEntityView } from '../../src/game/simulation/types';
import { interpolateProjectedEntities } from '../../src/phaser/scenes/interpolateProjectedEntities';

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
    ...overrides,
  };
}

describe('interpolateProjectedEntities', () => {
  it('interpolates unit positions between the previous and current tick positions', () => {
    const entities = [
      createProjectedEntity({ id: 7, x: 6, y: 5 }),
    ];
    const previousPositions = new Map<number, { x: number; y: number }>([
      [7, { x: 5, y: 5 }],
    ]);

    const displayed = interpolateProjectedEntities(entities, previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({
      x: 5.5,
      y: 5,
    });
    expect(displayed[0]).not.toBe(entities[0]);
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
    const previousPositions = new Map<number, { x: number; y: number }>([
      [9, { x: 9, y: 8 }],
    ]);

    const displayed = interpolateProjectedEntities(entities, previousPositions, 0.5);

    expect(displayed[0]).toMatchObject({
      x: 10,
      y: 8,
    });
  });
});
