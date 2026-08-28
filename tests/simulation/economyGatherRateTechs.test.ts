import { describe, it, expect } from 'vitest';

import {
  gatherRateMultiplier,
  gatherRateMultiplierForKind,
  ticksToGatherCarry,
} from '../../src/game/simulation/economyTechEffects';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const techs = (...t: ResearchableTechnologyType[]) =>
  new Set<ResearchableTechnologyType>(t);

describe('economy gather-rate tech multipliers', () => {
  it('returns 1.0 when no relevant tech is researched', () => {
    expect(gatherRateMultiplier(techs(), 'wood')).toBe(1);
    // unrelated techs (age-up, blacksmith) do not affect gather rate
    expect(gatherRateMultiplier(techs('feudal-age', 'forging'), 'wood')).toBe(1);
  });

  it('applies the wood-line multipliers and stacks them multiplicatively', () => {
    expect(gatherRateMultiplier(techs('double-bit-axe'), 'wood')).toBeCloseTo(1.2);
    expect(gatherRateMultiplier(techs('double-bit-axe', 'bow-saw'), 'wood')).toBeCloseTo(1.44);
    expect(
      gatherRateMultiplier(techs('double-bit-axe', 'bow-saw', 'two-man-saw'), 'wood'),
    ).toBeCloseTo(1.584);
  });

  it('applies gold/stone mining multipliers and isolates by resource', () => {
    expect(gatherRateMultiplier(techs('gold-mining'), 'gold')).toBeCloseTo(1.15);
    expect(
      gatherRateMultiplier(techs('gold-mining', 'gold-shaft-mining'), 'gold'),
    ).toBeCloseTo(1.3225);
    expect(gatherRateMultiplier(techs('stone-mining'), 'stone')).toBeCloseTo(1.15);
    expect(
      gatherRateMultiplier(techs('stone-mining', 'stone-shaft-mining'), 'stone'),
    ).toBeCloseTo(1.3225);
    // cross-resource isolation
    expect(gatherRateMultiplier(techs('double-bit-axe'), 'gold')).toBe(1);
    expect(gatherRateMultiplier(techs('gold-mining'), 'wood')).toBe(1);
    expect(gatherRateMultiplier(techs('double-bit-axe', 'gold-mining'), 'food')).toBe(1);
  });

  it('gatherRateMultiplierForKind maps a resource kind to its economy multiplier', () => {
    expect(gatherRateMultiplierForKind(techs('double-bit-axe'), 'tree')).toBeCloseTo(1.2);
    expect(gatherRateMultiplierForKind(techs('gold-mining'), 'gold-mine')).toBeCloseTo(1.15);
    expect(gatherRateMultiplierForKind(techs('stone-mining'), 'stone-mine')).toBeCloseTo(1.15);
    expect(gatherRateMultiplierForKind(techs('double-bit-axe'), 'gold-mine')).toBe(1);
  });

  it('no-tech gather takes base-cadence × cycles; wood techs do not touch gold', () => {
    // tree: base 26 ticks/cycle (spec §6.3 retune), amount 1, carry 10 -> 260
    expect(ticksToGatherCarry(techs(), 'tree', 10)).toBe(260);
    expect(ticksToGatherCarry(techs('double-bit-axe'), 'gold-mine', 10)).toBe(
      ticksToGatherCarry(techs(), 'gold-mine', 10),
    );
  });

  // The rate-accumulation model (carry the remainder) must make EVERY tier add a
  // real speedup — the regression guard against integer-cadence rounding, which
  // collapsed Two-Man Saw / Shaft Mining to no effect (Codex iter-1 HIGH).
  it('each stacked wood tech strictly reduces ticks-to-fill-carry (no no-op tiers)', () => {
    const base = ticksToGatherCarry(techs(), 'tree', 10);
    const dba = ticksToGatherCarry(techs('double-bit-axe'), 'tree', 10);
    const bow = ticksToGatherCarry(techs('double-bit-axe', 'bow-saw'), 'tree', 10);
    const two = ticksToGatherCarry(techs('double-bit-axe', 'bow-saw', 'two-man-saw'), 'tree', 10);
    expect(dba).toBeLessThan(base);
    expect(bow).toBeLessThan(dba);
    expect(two).toBeLessThan(bow);
  });

  it('each mining tier (base + Shaft) strictly reduces ticks-to-fill-carry', () => {
    expect(ticksToGatherCarry(techs('gold-mining'), 'gold-mine', 10)).toBeLessThan(
      ticksToGatherCarry(techs(), 'gold-mine', 10),
    );
    expect(
      ticksToGatherCarry(techs('gold-mining', 'gold-shaft-mining'), 'gold-mine', 10),
    ).toBeLessThan(ticksToGatherCarry(techs('gold-mining'), 'gold-mine', 10));
    expect(ticksToGatherCarry(techs('stone-mining'), 'stone-mine', 10)).toBeLessThan(
      ticksToGatherCarry(techs(), 'stone-mine', 10),
    );
    expect(
      ticksToGatherCarry(techs('stone-mining', 'stone-shaft-mining'), 'stone-mine', 10),
    ).toBeLessThan(ticksToGatherCarry(techs('stone-mining'), 'stone-mine', 10));
  });
});
