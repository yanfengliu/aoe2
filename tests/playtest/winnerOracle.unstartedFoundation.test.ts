// The playtest winner oracle counts owners as conquest does: a foundation
// nobody has started building keeps nobody in the match (work 121; spec
// §12.2), so the oracle and the game agree about who is out.
//
// BOUND: `entityCountsByOwner` and `extractWinner` on hand-made economy rows;
// the browser agent API and the corpus script call the same function.

import { describe, expect, it } from 'vitest';

import { entityCountsByOwner, extractWinner } from '../../src/game/playtest/winnerOracle';
import type { EconomyState } from '../../src/game/simulation/types';

function economy(foundation: { isComplete: boolean; buildProgressTicks: number }) {
  return {
    units: [{ id: 10, owner: 1, unitType: 'militia', x: 1, y: 1 }],
    buildings: [{ id: 20, owner: 2, buildingType: 'house', x: 9, y: 9, ...foundation }],
  } as unknown as Pick<EconomyState, 'units' | 'buildings'>;
}

describe('winner oracle and unstarted foundations', () => {
  it('counts an owner left with only an unstarted foundation as out', () => {
    const counts = entityCountsByOwner(economy({ isComplete: false, buildProgressTicks: 0 }));
    expect(counts[2]?.buildings ?? 0).toBe(0);
    expect(extractWinner(counts)).toEqual({ kind: 'winner', ownerId: 1 });
  });

  it('counts a started foundation, and a finished building, as presence', () => {
    for (const foundation of [{ isComplete: false, buildProgressTicks: 1 }, { isComplete: true, buildProgressTicks: 250 }]) {
      const counts = entityCountsByOwner(economy(foundation));
      expect(counts[2]?.buildings).toBe(1);
      expect(extractWinner(counts)).toEqual({ kind: 'in-progress', aliveOwners: [1, 2] });
    }
  });
});
