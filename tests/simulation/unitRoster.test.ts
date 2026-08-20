import { describe, expect, it } from 'vitest';

import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { TrainableUnitType, UnitType } from '../../src/game/simulation/types';

// The roster union lived twice in types.ts — `UnitType` and `TrainableUnitType`
// were 44 byte-identical members, so adding a unit meant typing it twice with
// nothing catching a miss. These assertions pin that they stay one roster.
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;

type _EveryUnitIsTrainable = Assert<Extends<UnitType, TrainableUnitType>>;
type _EveryTrainableIsAUnit = Assert<Extends<TrainableUnitType, UnitType>>;

describe('the unit roster', () => {
  it('is one union, so a new unit cannot be half-added', () => {
    // Type-level assertions above do the real work; this keeps them referenced
    // so an unused-type lint cannot quietly delete the guard.
    const proofs: Array<_EveryUnitIsTrainable | _EveryTrainableIsAUnit> = [true, true];
    expect(proofs).toEqual([true, true]);
  });

  it('has a stat entry for every unit it can name', () => {
    const roster = Object.keys(UNIT_MAX_HP) as UnitType[];
    expect(roster.length).toBeGreaterThan(0);
    for (const unitType of roster) {
      expect(UNIT_MAX_HP[unitType]).toBeGreaterThan(0);
    }
  });
});
