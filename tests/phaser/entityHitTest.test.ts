import { describe, expect, it } from 'vitest';

import { findEntityAtWorldPoint, isWorldPointInsideEntity } from '../../src/phaser/scenes/entityHitTest';
import type { RenderState } from '../../src/game/simulation/types';

const CELL_SIZE = 24;

function createRenderState(): RenderState {
  return {
    tick: 1,
    frame: null,
    entities: [
      {
        id: 1,
        kind: 'building',
        layer: 'building',
        entityType: 'house',
        owner: 2,
        x: 15,
        y: 8,
        tint: 0,
        size: 1,
        footprintWidth: 2,
        footprintHeight: 2,
        visualVariant: 'complete',
        selected: false,
        currentHp: 75,
        maxHp: 75,
      },
      {
        id: 2,
        kind: 'unit',
        layer: 'unit',
        entityType: 'scout',
        owner: 2,
        x: 15.5,
        y: 8,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 45,
        maxHp: 45,
      },
    ],
  };
}

describe('entityHitTest', () => {
  it('treats the visible body of a sub-grid unit as clickable even when it spills into the next tile', () => {
    const renderState = createRenderState();
    const pointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 4;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(isWorldPointInsideEntity(renderState.entities[1], pointX, pointY, CELL_SIZE)).toBe(true);
    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.id).toBe(2);
  });

  it('prioritizes units over overlapping buildings when both are under the pointer', () => {
    const renderState = createRenderState();
    const pointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.kind).toBe('unit');
  });

  it('allows slight pointer drift when hit-testing moving units', () => {
    const renderState = createRenderState();
    const pointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 8.5;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(isWorldPointInsideEntity(renderState.entities[1], pointX, pointY, CELL_SIZE)).toBe(true);
    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.id).toBe(2);
  });

  it('still resolves a moving unit with wider live-click drift from a stale rendered frame', () => {
    const renderState = createRenderState();
    const pointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 10;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(isWorldPointInsideEntity(renderState.entities[1], pointX, pointY, CELL_SIZE)).toBe(true);
    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.id).toBe(2);
  });
});
