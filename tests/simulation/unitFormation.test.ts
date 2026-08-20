import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FORMATION,
  UNIT_FORMATIONS,
  formationAxis,
  formationCells,
  formationRank,
  isUnitFormation,
  orderForFormation,
} from '../../src/game/simulation/unitFormation';
import type { UnitType } from '../../src/game/simulation/types';

const CENTER = { x: 20, y: 20 };

function distinct(cells: ReadonlyArray<{ x: number; y: number }>): number {
  return new Set(cells.map(({ x, y }) => `${String(x)},${String(y)}`)).size;
}

describe('formation names', () => {
  it('are the four AoE2 formations, defaulting to Line', () => {
    expect([...UNIT_FORMATIONS]).toEqual(['line', 'staggered', 'box', 'flank']);
    expect(DEFAULT_FORMATION).toBe('line');
    expect(isUnitFormation('box')).toBe(true);
    expect(isUnitFormation('wedge')).toBe(false);
  });
});

describe('formation ordering', () => {
  it('puts melee in front, shooters behind them, and the fragile at the back', () => {
    expect(formationRank('champion')).toBeLessThan(formationRank('archer'));
    expect(formationRank('archer')).toBeLessThan(formationRank('mangonel'));
    expect(formationRank('mangonel')).toBeLessThan(formationRank('villager'));
    expect(formationRank('monk')).toBe(formationRank('villager'));
  });

  it('sorts a mixed selection into that order, stable within a rank', () => {
    const units: Array<{ id: number; type: UnitType }> = [
      { id: 1, type: 'mangonel' },
      { id: 2, type: 'archer' },
      { id: 3, type: 'champion' },
      { id: 4, type: 'militia' },
      { id: 5, type: 'villager' },
    ];
    const ordered = orderForFormation(units, (unit) => unit.type);
    expect(ordered.map((unit) => unit.id)).toEqual([3, 4, 2, 1, 5]);
  });
});

describe('formation axes', () => {
  it('runs the line across the march, not along it', () => {
    // Walking east: the rank spreads north-south and later ranks sit west.
    const axis = formationAxis({ x: 10, y: 20 }, { x: 30, y: 20 });
    expect(axis.across).toEqual({ x: 0, y: 1 });
    expect(axis.back).toEqual({ x: -1, y: 0 });
  });

  it('turns with the march', () => {
    const north = formationAxis({ x: 20, y: 30 }, { x: 20, y: 10 });
    expect(north.across).toEqual({ x: 1, y: 0 });
    expect(north.back).toEqual({ x: 0, y: 1 });
  });

  it('is stable when the group is already standing on the target', () => {
    expect(formationAxis(CENTER, CENTER)).toEqual(formationAxis(CENTER, CENTER));
  });
});

describe('formation shapes', () => {
  const axis = formationAxis({ x: 10, y: 20 }, { x: 30, y: 20 });

  it('gives every unit its own cell', () => {
    for (const formation of UNIT_FORMATIONS) {
      const cells = formationCells(formation, CENTER, 12, axis);
      expect(cells.length, formation).toBeGreaterThanOrEqual(12);
      expect(distinct(cells.slice(0, 12)), formation).toBe(12);
    }
  });

  it('centres the shape on the click rather than starting at one edge', () => {
    const cells = formationCells('line', CENTER, 9, axis);
    const acrossValues = cells.map((point) => point.y - CENTER.y);
    expect(Math.min(...acrossValues)).toBeLessThan(0);
    expect(Math.max(...acrossValues)).toBeGreaterThan(0);
  });

  it('makes a line wider than it is deep, and a box roughly square', () => {
    const spread = (cells: ReadonlyArray<{ x: number; y: number }>) => ({
      width: new Set(cells.map((point) => point.y)).size,
      depth: new Set(cells.map((point) => point.x)).size,
    });
    const line = spread(formationCells('line', CENTER, 16, axis));
    const box = spread(formationCells('box', CENTER, 16, axis));
    expect(line.width).toBeGreaterThan(line.depth);
    expect(Math.abs(box.width - box.depth)).toBeLessThanOrEqual(1);
  });

  it('spreads staggered further than line, which is the entire point of it', () => {
    // A staggered block exists so one mangonel shot cannot cover the group.
    const area = (cells: ReadonlyArray<{ x: number; y: number }>) => {
      const xs = cells.map((point) => point.x);
      const ys = cells.map((point) => point.y);
      return (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
    };
    expect(area(formationCells('staggered', CENTER, 12, axis)))
      .toBeGreaterThan(area(formationCells('line', CENTER, 12, axis)));
  });

  it('leaves a hole in the middle of a flank', () => {
    const cells = formationCells('flank', CENTER, 10, axis);
    const onCentreLine = cells.filter((point) => point.y === CENTER.y);
    expect(onCentreLine).toHaveLength(0);
    // ...and puts units on both sides of it.
    expect(cells.some((point) => point.y > CENTER.y)).toBe(true);
    expect(cells.some((point) => point.y < CENTER.y)).toBe(true);
  });
});
