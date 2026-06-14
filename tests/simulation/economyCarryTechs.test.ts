import { describe, it, expect } from 'vitest';

import {
  carryCapacityMultiplier,
  effectiveCarryCapacity,
} from '../../src/game/simulation/economyTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const techs = (...t: ResearchableTechnologyType[]) =>
  new Set<ResearchableTechnologyType>(t);

describe('economy carry-capacity techs', () => {
  it('returns 1.0 with no carry tech; unrelated techs do not affect carry', () => {
    expect(carryCapacityMultiplier(techs())).toBe(1);
    expect(carryCapacityMultiplier(techs('double-bit-axe', 'feudal-age'))).toBe(1);
  });

  it('applies Wheelbarrow and Hand Cart, stacking multiplicatively', () => {
    expect(carryCapacityMultiplier(techs('wheelbarrow'))).toBeCloseTo(1.25);
    expect(carryCapacityMultiplier(techs('hand-cart'))).toBeCloseTo(1.5);
    expect(carryCapacityMultiplier(techs('wheelbarrow', 'hand-cart'))).toBeCloseTo(1.875);
  });

  it('effectiveCarryCapacity rounds baseCarry × multiplier and never reduces it', () => {
    expect(effectiveCarryCapacity(techs(), 10)).toBe(10);
    expect(effectiveCarryCapacity(techs('wheelbarrow'), 10)).toBe(13); // round(12.5)
    expect(effectiveCarryCapacity(techs('wheelbarrow', 'hand-cart'), 10)).toBe(19); // round(18.75)
    expect(effectiveCarryCapacity(techs('wheelbarrow'), 10)).toBeGreaterThan(
      effectiveCarryCapacity(techs(), 10),
    );
  });
});
