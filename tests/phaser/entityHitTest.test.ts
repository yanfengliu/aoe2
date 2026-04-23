import { describe, expect, it } from 'vitest';

import {
  doesWorldRectIntersectEntity,
  findCommandTargetEntityAtWorldPointInEntities,
  findEntitiesAtWorldPointInEntities,
  findEntityAtWorldPoint,
  isWorldPointInsideEntity,
} from '../../src/phaser/scenes/entityHitTest';
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
        isMemory: false,
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
        isMemory: false,
      },
    ],
  };
}

function createAdjacentUnitsRenderState(): RenderState {
  return {
    tick: 1,
    frame: null,
    entities: [
      {
        id: 10,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 15,
        y: 8,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 25,
        maxHp: 25,
        isMemory: false,
      },
      {
        id: 11,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 16,
        y: 8,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 25,
        maxHp: 25,
        isMemory: false,
      },
    ],
  };
}

function createOverlappingUnitsRenderState(): RenderState {
  return {
    tick: 1,
    frame: null,
    entities: [
      {
        id: 20,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 15.25,
        y: 8.25,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 25,
        maxHp: 25,
        isMemory: false,
      },
      // The enemy scout is listed second, so the scene would draw it on top of
      // the villager at the same world point. Generic world-point and command
      // targeting should therefore resolve to the scout, while exact selection
      // still prefers the human-owned villager.
      {
        id: 21,
        kind: 'unit',
        layer: 'unit',
        entityType: 'scout',
        owner: 2,
        x: 15.25,
        y: 8.25,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 45,
        maxHp: 45,
        isMemory: false,
      },
    ],
  };
}

function createSameOwnerOverlappingUnitsRenderState(): RenderState {
  return {
    tick: 1,
    frame: null,
    entities: [
      {
        id: 31,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 15.25,
        y: 8.25,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 25,
        maxHp: 25,
        isMemory: false,
      },
      {
        id: 30,
        kind: 'unit',
        layer: 'unit',
        entityType: 'villager',
        owner: 1,
        x: 15.25,
        y: 8.25,
        tint: 0,
        size: 0.55,
        footprintWidth: 1,
        footprintHeight: 1,
        visualVariant: 'default',
        selected: false,
        currentHp: 25,
        maxHp: 25,
        isMemory: false,
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

  it('stops unit hits at the rendered circle edge', () => {
    const renderState = createRenderState();
    const insidePointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 6.4;
    const outsidePointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 6.8;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(isWorldPointInsideEntity(renderState.entities[1], insidePointX, pointY, CELL_SIZE)).toBe(true);
    expect(isWorldPointInsideEntity(renderState.entities[1], outsidePointX, pointY, CELL_SIZE)).toBe(false);
  });

  it('does not treat the visible gap between adjacent unit bodies as clickable', () => {
    const renderState = createAdjacentUnitsRenderState();
    const pointX = 15.95 * CELL_SIZE;
    const pointY = 8.5 * CELL_SIZE;

    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)).toBeNull();
  });

  it('prefers the human-owned unit when overlapping units share the clicked point', () => {
    const renderState = createOverlappingUnitsRenderState();
    const pointX = (15.25 + 0.5) * CELL_SIZE;
    const pointY = (8.25 + 0.5) * CELL_SIZE;

    expect(
      findEntitiesAtWorldPointInEntities(renderState.entities, pointX, pointY, CELL_SIZE)[0]?.id,
    ).toBe(20);
  });

  it('keeps generic world-point resolution in render order for same-layer overlaps', () => {
    const renderState = createOverlappingUnitsRenderState();
    const pointX = (15.25 + 0.5) * CELL_SIZE;
    const pointY = (8.25 + 0.5) * CELL_SIZE;

    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.id).toBe(21);
  });

  it('keeps command targeting on the topmost same-layer overlap', () => {
    const renderState = createOverlappingUnitsRenderState();
    const pointX = (15.25 + 0.5) * CELL_SIZE;
    const pointY = (8.25 + 0.5) * CELL_SIZE;

    expect(
      findCommandTargetEntityAtWorldPointInEntities(renderState.entities, pointX, pointY, CELL_SIZE)?.id,
    ).toBe(21);
  });

  it('preserves topmost render order for same-owner overlaps after applying owner priority', () => {
    const renderState = createSameOwnerOverlappingUnitsRenderState();
    const pointX = (15.25 + 0.5) * CELL_SIZE;
    const pointY = (8.25 + 0.5) * CELL_SIZE;

    expect(
      findEntitiesAtWorldPointInEntities(renderState.entities, pointX, pointY, CELL_SIZE)[0]?.id,
    ).toBe(30);
  });

  it('keeps command targeting forgiving slightly beyond the exact rendered unit body', () => {
    const renderState = createRenderState();
    const pointX = 15.5 * CELL_SIZE + CELL_SIZE * 0.5 + 8.5;
    const pointY = 8 * CELL_SIZE + CELL_SIZE * 0.5;

    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)?.id).toBe(1);
    expect(
      findCommandTargetEntityAtWorldPointInEntities(renderState.entities, pointX, pointY, CELL_SIZE)?.id,
    ).toBe(2);
  });

  it('ignores memory ghosts for live hit tests', () => {
    const renderState = createRenderState();
    renderState.entities = [
      {
        ...renderState.entities[0]!,
        isMemory: true,
      },
    ];
    const pointX = 15.5 * CELL_SIZE;
    const pointY = 8.5 * CELL_SIZE;

    expect(findEntityAtWorldPoint(renderState, pointX, pointY, CELL_SIZE)).toBeNull();
    expect(
      findCommandTargetEntityAtWorldPointInEntities(renderState.entities, pointX, pointY, CELL_SIZE),
    ).toBeNull();
  });

  it('only intersects a marquee when the rectangle touches the visible unit body', () => {
    const renderState = createAdjacentUnitsRenderState();
    const leftVillager = renderState.entities[0];

    expect(
      doesWorldRectIntersectEntity(
        leftVillager,
        15.95 * CELL_SIZE,
        8.28 * CELL_SIZE,
        16.05 * CELL_SIZE,
        8.72 * CELL_SIZE,
        CELL_SIZE,
      ),
    ).toBe(false);
    expect(
      doesWorldRectIntersectEntity(
        leftVillager,
        15.28 * CELL_SIZE,
        8.28 * CELL_SIZE,
        15.72 * CELL_SIZE,
        8.72 * CELL_SIZE,
        CELL_SIZE,
      ),
    ).toBe(true);
  });
});
