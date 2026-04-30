import { describe, expect, it } from 'vitest';
import type { EntityRef } from 'civ-engine';
import { selectionToRefs } from '../../src/game/annotations/selectionToRefs';

describe('selectionToRefs', () => {
  it('returns tickRange-only fallback when nothing is selected', () => {
    const refs = selectionToRefs([], 42);
    expect(refs).toEqual({ tickRange: { from: 42, to: 42 } });
    expect(refs.entities).toBeUndefined();
  });

  it('returns entities when selection is non-empty', () => {
    const sel: EntityRef[] = [{ id: 1, generation: 0 }, { id: 2, generation: 3 }];
    const refs = selectionToRefs(sel, 42);
    expect(refs.entities).toEqual(sel);
    expect(refs.tickRange).toBeUndefined();
  });

  it('returns a defensive copy (later mutation does not leak)', () => {
    const sel: EntityRef[] = [{ id: 1, generation: 0 }];
    const refs = selectionToRefs(sel, 42);
    sel.push({ id: 2, generation: 0 });
    expect(refs.entities!.length).toBe(1);
  });

  it('preserves generation through to the result', () => {
    const sel: EntityRef[] = [{ id: 7, generation: 5 }];
    const refs = selectionToRefs(sel, 100);
    expect(refs.entities![0]).toEqual({ id: 7, generation: 5 });
  });
});
