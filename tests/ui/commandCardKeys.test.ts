// A key of DE's grid presses ONE button: two buildings a villager can build in
// one slot of one page would make that key ambiguous, and the key handler
// would press whichever the palette drew first. The table's values are DE's
// (`src/ui/hud/commandCardKeys.ts` cites each); the contract they serve, a key
// pressing its button, is held by `tests/browser/de-command-card-keys.spec.ts`.

import { describe, expect, it } from 'vitest';

import {
  BUILD_PAGE_KEYS,
  GRID_KEYS,
  gridSlotOf,
  VILLAGER_BUILD_SLOTS,
} from '../../src/ui/hud/commandCardKeys';

describe('DE command-card keys (work 142)', () => {
  it('gives each slot of a villager build page to one building at most', () => {
    const seen = new Map<string, string>();
    for (const [building, { page, key }] of Object.entries(VILLAGER_BUILD_SLOTS)) {
      // A Fishing Ship builds the Fish Trap, alone on its own palette.
      if (building === 'fish-trap') continue;
      const slot = `${page}:${key}`;
      expect(seen.get(slot), `${building} and ${seen.get(slot)} share ${slot}`).toBeUndefined();
      seen.set(slot, building);
    }
  });

  it('numbers the grid row by row, Q W E R T, A S D F G, Z X C V B', () => {
    expect(GRID_KEYS.map(gridSlotOf)).toEqual([...GRID_KEYS.keys()]);
    expect(gridSlotOf('t')).toBe(4);
    expect(gridSlotOf('g')).toBe(9);
    expect(gridSlotOf('b')).toBe(14);
    expect(Object.values(BUILD_PAGE_KEYS)).toEqual(['q', 'w']);
  });
});
