// A key of DE's grid presses ONE button: two buildings a villager can build in
// one slot of one page would make that key ambiguous, and the key handler
// would press whichever the palette drew first. The table's values are DE's
// (`src/ui/hud/commandCardKeys.ts` cites each); the contract they serve, a key
// pressing its button, is held by `tests/browser/de-command-card-keys.spec.ts`.

import { describe, expect, it } from 'vitest';

import { isDeCivilianUnit } from '../../src/game/simulation/deCivilianUnits';
import { UNIT_FORMATIONS } from '../../src/game/simulation/unitFormation';
import { UNIT_STANCES } from '../../src/game/simulation/unitStance';
import {
  BUILD_PAGE_KEYS,
  GRID_KEYS,
  gridSlotOf,
  inUnitCardSlotOrder,
  MILITARY_ORDER_KEYS,
  unitCardKeyOf,
  VILLAGER_BUILD_SLOTS,
} from '../../src/ui/hud/commandCardKeys';

// Work 142 M2b-1: the military card's keys, from MILITARY_UNITS_HOTKEYS, and
// DE's civilians, from selection_group_def.json; the contract (a key presses
// its button or arms its order) is `tests/browser/de-military-card-keys.spec.ts`.
describe('DE military card keys (work 142 M2b-1)', () => {
  it('gives every stance, formation and ground order its own key of the military card', () => {
    const commands = [...UNIT_STANCES.map((s) => `stance-${s}`), ...UNIT_FORMATIONS.map((f) => `formation-${f}`)];
    const keys = [...commands.map((command) => unitCardKeyOf(command)), ...Object.values(MILITARY_ORDER_KEYS)];
    expect(keys.every((key) => key !== null && (GRID_KEYS as readonly string[]).includes(key))).toBe(true);
    expect(new Set(keys).size, keys.join(' ')).toBe(keys.length);
    expect(MILITARY_ORDER_KEYS).toEqual({ patrol: 'q', 'attack-move': 'r', 'attack-ground': 't' });
  });

  it('draws the stances A S D F and the formations Z X C V, whatever order they come in', () => {
    expect(inUnitCardSlotOrder([...UNIT_FORMATIONS], (f) => `formation-${f}`)).toEqual(['line', 'box', 'staggered', 'flank']);
    expect(inUnitCardSlotOrder([...UNIT_STANCES].reverse(), (s) => `stance-${s}`))
      .toEqual(['aggressive', 'defensive', 'stand-ground', 'no-attack']);
  });

  it('counts villagers, Fishing Ships, Trade Carts and Trade Cogs as civilians, and no other unit', () => {
    for (const civilian of ['villager', 'fishing-ship', 'trade-cart', 'trade-cog'] as const) {
      expect(isDeCivilianUnit(civilian), civilian).toBe(true);
    }
    for (const military of ['scout', 'monk', 'transport-ship', 'mangonel', 'galley'] as const) {
      expect(isDeCivilianUnit(military), military).toBe(false);
    }
  });
});

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
