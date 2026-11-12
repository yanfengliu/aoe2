// The counters the cell gates stand on (tests/helpers/cellReadCounter.ts), checked against reads whose number is
// known before the gates trust them: a count that misses a kind of read would let that read's walk back in unseen.
// Review round 2 of work 150 M2b rank 1 found one (F4): a read of a field a cell does not hold, an optional one,
// reached no accessor and counted as nothing.
import { describe, expect, it } from 'vitest';

import { joinProjectedEntityLists, knownProjectedEntityLists } from '../../src/game/simulation/projectedEntityLists';
import type { ProjectedEntityView, RenderState } from '../../src/game/simulation/types';
import { cellReadCounter, terrainArrayReadCounter } from '../helpers/cellReadCounter';

function view(id: number, layer: ProjectedEntityView['layer']): ProjectedEntityView {
  return {
    id, generation: 0, kind: layer === 'terrain' ? 'tile' : 'unit', layer, entityType: layer === 'terrain' ? 'grass' : 'scout',
    owner: null, x: id, y: 0, elevation: 0, tint: 0x587f4e, size: 1, footprintWidth: 1, footprintHeight: 1,
    visualVariant: 'default', selected: false, currentHp: null, maxHp: null, isMemory: false,
  };
}

describe('the count of reads of a cell\'s fields', () => {
  it('counts a read of every field a cell holds, and of a field it does not hold', () => {
    const cells = [view(1, 'terrain'), view(2, 'terrain')];
    const scout = view(3, 'unit');
    const counter = cellReadCounter();
    counter.watch([...cells, scout]);
    expect(counter.reads(), 'watching reads nothing').toBe(0);

    expect(cells[0]!.x).toBe(1);
    expect(counter.reads()).toBe(1);
    // An optional field no cell holds: the walk review round 2 named, `entities.some((e) => e.attackAnimation)`.
    expect(cells.some((cell) => cell.attackAnimation !== undefined)).toBe(false);
    expect(counter.reads(), 'two cells asked for a field they do not hold').toBe(3);
    // A filter by layer over the list reads each cell once; the unit is not counted.
    expect([...cells, scout].filter((entity) => entity.layer === 'terrain')).toHaveLength(2);
    expect(counter.reads()).toBe(5);
    expect(scout.x + (scout.attackAnimation ? 1 : 0)).toBe(3);
    expect(counter.reads(), 'a unit\'s fields are not a cell\'s').toBe(5);
  });

  it('leaves a cell what it was: the same fields, values and object, and Object.prototype\'s own', () => {
    const cell = view(7, 'terrain');
    const before = { ...cell };
    const keys = Object.keys(cell);
    const counter = cellReadCounter();
    counter.watch([cell]);
    counter.watch([cell]);
    counter.quietly(() => {
      expect(Object.keys(cell)).toEqual(keys);
      expect({ ...cell }).toEqual(before);
      expect(JSON.parse(JSON.stringify(cell))).toEqual(before);
      expect('attackAnimation' in cell).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cell, 'attackAnimation')).toBe(false);
      expect(cell.attackAnimation).toBeUndefined();
    });
    expect(counter.reads(), 'the test\'s own look, run quietly').toBe(0);
    // What every object answers is not a field of the cell.
    expect(String(cell)).toBe('[object Object]');
    expect((cell as object).constructor).toBe(Object);
    expect(counter.reads()).toBe(0);
    // A write goes to the cell and is read back, counted.
    (cell as { x: number }).x = 9;
    expect(counter.reads()).toBe(0);
    expect(cell.x).toBe(9);
    expect(counter.reads()).toBe(1);
  });
});

describe('the count of cells fetched from the terrain half\'s array', () => {
  const stateOf = (entities: ProjectedEntityView[]): RenderState => ({ tick: 1, entities, frame: null } as unknown as RenderState);

  it('counts each cell a walk of the half fetches, and leaves its own join out', () => {
    const cells = [view(1, 'terrain'), view(2, 'terrain'), view(3, 'terrain')];
    const scout = view(4, 'unit');
    const counter = terrainArrayReadCounter();
    const state = stateOf(joinProjectedEntityLists(cells, [scout]));
    const watched = counter.readState(state);
    expect(counter.readsOfLastJoin(), 'the join copied the half through the stand-in').toBe(3);
    expect(counter.reads(), 'and is not in the count').toBe(0);
    expect(watched.entities).toEqual(state.entities);
    expect(counter.readState(state), 'one stand-in list for one state').toBe(watched);

    const half = knownProjectedEntityLists(watched.entities)!.terrain;
    // Compared here, not by the matcher: a `not.toBe` that holds goes on to compare the two deeply for its message,
    // which fetches every cell.
    expect(Object.is(half, cells), 'the half is the stand-in, not the array').toBe(false);
    expect(half.length).toBe(3);
    expect(counter.reads(), 'the length is not a cell').toBe(0);
    expect(half[1]).toBe(cells[1]);
    expect(counter.reads()).toBe(1);
    // A native copy and a comparison of the half's objects with another array's: neither reads a field.
    expect(half.concat([])).toHaveLength(3);
    expect(counter.reads()).toBe(4);
    expect(half.every((cell, index) => cell === cells[index])).toBe(true);
    expect(counter.reads()).toBe(7);
  });

  it('keeps one stand-in for as long as the render state hands on one terrain array', () => {
    const cells = [view(1, 'terrain')];
    const counter = terrainArrayReadCounter();
    const first = counter.readState(stateOf(joinProjectedEntityLists(cells, [])));
    const second = counter.readState(stateOf(joinProjectedEntityLists(cells, [view(2, 'unit')])));
    expect(knownProjectedEntityLists(second.entities)!.terrain).toBe(knownProjectedEntityLists(first.entities)!.terrain);
    const third = counter.readState(stateOf(joinProjectedEntityLists([...cells], [])));
    expect(Object.is(knownProjectedEntityLists(third.entities)!.terrain, knownProjectedEntityLists(first.entities)!.terrain)).toBe(false);
  });

  it('refuses a list nobody remembered the halves of', () => {
    expect(() => terrainArrayReadCounter().readState(stateOf([view(1, 'terrain')]))).toThrow(/without its two halves/);
  });
});
