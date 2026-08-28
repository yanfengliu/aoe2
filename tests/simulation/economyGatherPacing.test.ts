// Spec §6.3 pacing pins: the base gather cadence table must land on AoE2 DE's
// base rates ("these rates define the intended pacing of early and mid game
// economy"). Raw rate = amount / ticks × 10 ticks/sec, before carry/travel
// and before civilization or technology multipliers. Each pin allows ±5% —
// integer tick counts cannot hit every decimal exactly.
import { describe, expect, it } from 'vitest';

import { gatherAmountFor, gatherTicksFor } from '../../src/game/simulation/prototypeEconomyRules';
import { TPS } from '../../src/game/simulation/prototypeScenario';
import type { ResourceKind } from '../../src/game/simulation/types';

const TICKS_PER_SECOND = TPS;

function rawRate(kind: ResourceKind): number {
  return (gatherAmountFor(kind) / gatherTicksFor(kind)) * TICKS_PER_SECOND;
}

// Spec §6.3's table, verbatim.
const SPEC_RATES: ReadonlyArray<[ResourceKind, number]> = [
  ['sheep', 0.33],
  ['berry-bush', 0.31],
  ['boar', 0.41],
  ['farm', 0.33], // "about 0.32 to 0.34"
  ['fish', 0.49], // deep fish
  ['tree', 0.39],
  ['gold-mine', 0.38],
  ['stone-mine', 0.36],
];

describe('spec §6.3 base gather pacing', () => {
  for (const [kind, specRate] of SPEC_RATES) {
    it(`${kind} gathers at ~${specRate}/sec`, () => {
      const rate = rawRate(kind);
      expect(rate).toBeGreaterThanOrEqual(specRate * 0.95);
      expect(rate).toBeLessThanOrEqual(specRate * 1.05);
    });
  }
});
