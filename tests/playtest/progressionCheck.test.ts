import { describe, it, expect } from 'vitest';

import { ageAtLeast, checkAgeProgression } from '../../src/game/playtest/progressionCheck';

describe('ageAtLeast', () => {
  it('orders the four ages', () => {
    expect(ageAtLeast('feudal-age', 'feudal-age')).toBe(true);
    expect(ageAtLeast('castle-age', 'feudal-age')).toBe(true);
    expect(ageAtLeast('imperial-age', 'castle-age')).toBe(true);
    expect(ageAtLeast('dark-age', 'feudal-age')).toBe(false);
  });

  it('treats an unknown age as the lowest (never satisfies a requirement)', () => {
    expect(ageAtLeast('bogus', 'feudal-age')).toBe(false);
    expect(ageAtLeast('bogus', 'dark-age')).toBe(true);
  });
});

describe('checkAgeProgression', () => {
  it('passes when at least one LIVING owner reached the required age', () => {
    const result = checkAgeProgression(
      { 1: 'feudal-age', 2: 'dark-age' },
      [1, 2],
      'feudal-age',
    );
    expect(result.ok).toBe(true);
    expect(result.message).toBe('');
  });

  it('FAILS when every living owner is stuck below the required age (the drop-off-freeze class)', () => {
    const result = checkAgeProgression(
      { 1: 'dark-age', 2: 'dark-age' },
      [1, 2],
      'feudal-age',
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no living owner reached feudal-age/);
  });

  it('ignores eliminated owners — a dead player that never aged up is not a stall', () => {
    // Owner 2 was eliminated (not in aliveOwners); only living owner 1 counts,
    // and it reached Castle Age, so the run progressed.
    const result = checkAgeProgression(
      { 1: 'castle-age', 2: 'dark-age' },
      [1],
      'feudal-age',
    );
    expect(result.ok).toBe(true);
  });

  it('flags when the ONLY living owner is stuck in the Dark Age', () => {
    const result = checkAgeProgression({ 1: 'dark-age', 2: 'dark-age' }, [1], 'feudal-age');
    expect(result.ok).toBe(false);
  });

  it('passes on mutual elimination (no living owners) — the match resolved', () => {
    const result = checkAgeProgression({ 1: 'dark-age', 2: 'dark-age' }, [], 'feudal-age');
    expect(result.ok).toBe(true);
  });

  it('defaults a missing owner age to dark-age', () => {
    const result = checkAgeProgression({ 1: 'castle-age' }, [1, 2], 'imperial-age');
    expect(result.ok).toBe(false);
    expect(result.reached).toContainEqual({ owner: 2, age: 'dark-age' });
  });
});
