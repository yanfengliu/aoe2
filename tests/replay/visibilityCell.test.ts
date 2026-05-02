import { describe, expect, it } from 'vitest';
import { VisibilityMap } from 'civ-engine';

import { VisibilityCell } from '../../src/game/simulation/bridge/visibilityCell';

describe('VisibilityCell', () => {
  it('starts dirty so the first sync writes to world.state', () => {
    const map = new VisibilityMap(20, 20);
    const cell = new VisibilityCell(map);
    expect(cell.isDirty).toBe(true);
  });

  it('exposes the underlying map by reference', () => {
    const map = new VisibilityMap(20, 20);
    const cell = new VisibilityCell(map);
    expect(cell.map).toBe(map);
  });

  it('consumeIfDirty returns true once and clears the flag', () => {
    const map = new VisibilityMap(20, 20);
    const cell = new VisibilityCell(map);
    expect(cell.consumeIfDirty()).toBe(true);
    expect(cell.consumeIfDirty()).toBe(false);
    expect(cell.isDirty).toBe(false);
  });

  it('markDirty re-arms the flag', () => {
    const map = new VisibilityMap(20, 20);
    const cell = new VisibilityCell(map);
    cell.consumeIfDirty(); // clear
    expect(cell.isDirty).toBe(false);
    cell.markDirty();
    expect(cell.isDirty).toBe(true);
  });

  it('markClean clears without consuming (for replay-bridge hydration)', () => {
    const map = new VisibilityMap(20, 20);
    const cell = new VisibilityCell(map);
    cell.markClean();
    expect(cell.isDirty).toBe(false);
  });
});
