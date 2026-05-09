import { describe, it, expect } from 'vitest';
import { extractWinner } from '../../src/game/playtest/winnerOracle';

describe('extractWinner', () => {
  it('returns winner: ownerId when exactly one owner has entities', () => {
    expect(
      extractWinner({
        1: { units: 5, buildings: 2 },
        2: { units: 0, buildings: 0 },
      }),
    ).toEqual({ kind: 'winner', ownerId: 1 });
  });

  it('returns winner: ownerId when only buildings remain', () => {
    expect(
      extractWinner({
        1: { units: 0, buildings: 0 },
        2: { units: 0, buildings: 1 },
      }),
    ).toEqual({ kind: 'winner', ownerId: 2 });
  });

  it('returns in-progress with sorted alive owner list when multiple owners alive', () => {
    const result = extractWinner({
      3: { units: 1, buildings: 0 },
      1: { units: 4, buildings: 1 },
      2: { units: 0, buildings: 0 },
    });
    expect(result).toEqual({ kind: 'in-progress', aliveOwners: [1, 3] });
  });

  it('returns tie when no owner has any entities', () => {
    expect(
      extractWinner({
        1: { units: 0, buildings: 0 },
        2: { units: 0, buildings: 0 },
      }),
    ).toEqual({ kind: 'tie' });
  });

  it('returns tie for an empty counts map', () => {
    expect(extractWinner({})).toEqual({ kind: 'tie' });
  });

  it('treats >0 units OR >0 buildings as alive', () => {
    expect(
      extractWinner({
        1: { units: 1, buildings: 0 },
        2: { units: 0, buildings: 0 },
      }),
    ).toEqual({ kind: 'winner', ownerId: 1 });
    expect(
      extractWinner({
        1: { units: 0, buildings: 1 },
        2: { units: 0, buildings: 0 },
      }),
    ).toEqual({ kind: 'winner', ownerId: 1 });
  });

  it('sorts aliveOwners ascending regardless of insertion order', () => {
    const result = extractWinner({
      5: { units: 1, buildings: 0 },
      2: { units: 1, buildings: 0 },
      8: { units: 1, buildings: 0 },
      1: { units: 1, buildings: 0 },
    });
    expect(result).toEqual({ kind: 'in-progress', aliveOwners: [1, 2, 5, 8] });
  });
});
