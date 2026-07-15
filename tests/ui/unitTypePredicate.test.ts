// The canonical unit-type predicate.
//
// The lookup must consult only the table's OWN keys. `key in obj` walks the
// prototype chain, so an object literal answers true for every
// Object.prototype member — `isUnitType('toString')` returned true, and the
// HUD would then render a "toString" selection as a unit. Latent while every
// caller passes a typed union value, but the `||` chain this predicate
// replaced was immune, so consolidating onto it must not inherit the hazard.

import { describe, expect, it } from 'vitest';

import type { SelectionState } from '../../src/game/simulation/types';
import { isUnitType } from '../../src/input/unitTypeMap';

type Entity = SelectionState['selectedEntityType'];

describe('isUnitType', () => {
  it('accepts real unit types', () => {
    for (const unit of ['villager', 'militia', 'knight', 'paladin', 'man-at-arms']) {
      expect(isUnitType(unit as Entity), unit).toBe(true);
    }
  });

  it('rejects buildings, resources, and null', () => {
    for (const other of ['town-center', 'house', 'berry-bush', 'sheep', 'farm']) {
      expect(isUnitType(other as Entity), other).toBe(false);
    }
    expect(isUnitType(null)).toBe(false);
  });

  it('rejects inherited Object.prototype members', () => {
    for (const inherited of [
      'toString',
      'constructor',
      'hasOwnProperty',
      'valueOf',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
      '__proto__',
    ]) {
      expect(isUnitType(inherited as Entity), `${inherited} is not a unit type`).toBe(false);
    }
  });
});
