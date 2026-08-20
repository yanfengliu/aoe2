import { describe, expect, it } from 'vitest';

import {
  UNIT_BASE_SPEED_PERCENT,
  unitBaseSpeedPercent,
} from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import { UNIT_MAX_HP } from '../../src/game/simulation/prototypeUnitRules/statTables';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

const NONE = new Set<ResearchableTechnologyType>();

describe('per-unit base movement speed', () => {
  it('measures every unit against a villager, which stays the 100% reference', () => {
    // Anchoring on the villager (units.csv movement_rate 0.8) is what keeps the
    // whole economy on the executor's byte-identical speed-percent-100 path.
    expect(unitBaseSpeedPercent('villager')).toBe(100);
  });

  it('has a rate for every unit on the roster', () => {
    for (const unitType of Object.keys(UNIT_MAX_HP) as UnitType[]) {
      expect(UNIT_BASE_SPEED_PERCENT[unitType], unitType).toBeGreaterThan(0);
    }
  });

  it('makes cavalry outrun infantry, which outruns siege', () => {
    // The whole point of the slice: speed is part of a unit's identity, so a
    // Hussar raids, a Champion marches, and a Mangonel crawls.
    expect(unitBaseSpeedPercent('hussar'))
      .toBeGreaterThan(unitBaseSpeedPercent('knight'));
    expect(unitBaseSpeedPercent('knight'))
      .toBeGreaterThan(unitBaseSpeedPercent('champion'));
    expect(unitBaseSpeedPercent('champion'))
      .toBeGreaterThan(unitBaseSpeedPercent('villager'));
    expect(unitBaseSpeedPercent('villager'))
      .toBeGreaterThan(unitBaseSpeedPercent('mangonel'));
    expect(unitBaseSpeedPercent('mangonel'))
      .toBeGreaterThan(unitBaseSpeedPercent('battering-ram'));
  });

  it('gives the archer line one step over infantry and under cavalry', () => {
    expect(unitBaseSpeedPercent('archer'))
      .toBeGreaterThan(unitBaseSpeedPercent('champion'));
    expect(unitBaseSpeedPercent('archer'))
      .toBeLessThan(unitBaseSpeedPercent('cavalry-archer'));
  });
});

describe('base speed composes with the movement technologies', () => {
  it('leaves an unteched villager on the no-modifier fast path', () => {
    expect(movementSpeedPercent(NONE, 'villager')).toBe(100);
  });

  it('multiplies Husbandry onto a knight base rather than replacing it', () => {
    const base = unitBaseSpeedPercent('knight');
    expect(base).toBeGreaterThan(100);
    const withHusbandry = movementSpeedPercent(
      new Set<ResearchableTechnologyType>(['husbandry']),
      'knight',
    );
    expect(withHusbandry).toBe(Math.round((base * 110) / 100));
  });

  it('multiplies Squires onto an infantry base', () => {
    const base = unitBaseSpeedPercent('champion');
    expect(movementSpeedPercent(new Set<ResearchableTechnologyType>(['squires']), 'champion'))
      .toBe(Math.round((base * 110) / 100));
  });

  it('still stacks Wheelbarrow and Hand Cart on the villager', () => {
    expect(movementSpeedPercent(new Set<ResearchableTechnologyType>(['wheelbarrow']), 'villager'))
      .toBe(110);
    expect(movementSpeedPercent(
      new Set<ResearchableTechnologyType>(['wheelbarrow', 'hand-cart']),
      'villager',
    )).toBe(121);
  });

  it('applies a base speed to units no movement technology touches', () => {
    // A Mangonel has no speed tech at all, so before this slice its percent was
    // a flat 100 and it moved exactly as fast as a villager.
    expect(movementSpeedPercent(NONE, 'mangonel')).toBeLessThan(100);
    expect(movementSpeedPercent(NONE, 'hussar')).toBeGreaterThan(100);
  });
});
