import { describe, expect, it } from 'vitest';

import type { UnitType } from '../../src/game/simulation/types';
import {
  UNIT_STANCES,
  autoEngageRadius,
  defaultStanceFor,
  engagesBuildings,
  holdsPosition,
} from '../../src/game/simulation/unitStance';

describe('default stances match AoE2', () => {
  it('starts military units aggressive and villagers defensive', () => {
    for (const unitType of [
      'militia', 'archer', 'knight', 'mangonel', 'longbowman', 'galley',
    ] as const) {
      expect(defaultStanceFor(unitType)).toBe('aggressive');
    }
    expect(defaultStanceFor('villager')).toBe('defensive');
    // A Fishing Ship is an economy unit and should not go hunting either.
    expect(defaultStanceFor('fishing-ship')).toBe('defensive');
  });

  it('offers exactly the four AoE2 stances', () => {
    expect([...UNIT_STANCES]).toEqual([
      'aggressive', 'defensive', 'stand-ground', 'no-attack',
    ]);
  });
});

describe('how far a unit looks for a fight', () => {
  const VISION = 7;
  const RANGE = 4;

  it('scans its whole line of sight when aggressive', () => {
    expect(autoEngageRadius('aggressive', VISION, RANGE)).toBe(VISION);
  });

  it('scans only its own weapon reach when defensive, never its whole vision', () => {
    // Defensive fights back; it does not go looking. A villager (reach 1)
    // therefore counter-attacks only what is adjacent — which is exactly what
    // the game did before stances existed.
    expect(autoEngageRadius('defensive', VISION, RANGE)).toBe(RANGE);
    expect(autoEngageRadius('defensive', VISION, 1)).toBe(1);
    expect(autoEngageRadius('defensive', VISION, RANGE)).toBeLessThan(VISION);
  });

  it('separates defensive from stand-ground by movement, not by reach', () => {
    // Same scan radius; the difference is that Stand Ground will not move.
    expect(autoEngageRadius('defensive', VISION, RANGE))
      .toBe(autoEngageRadius('stand-ground', VISION, RANGE));
    expect(holdsPosition('defensive')).toBe(false);
    expect(holdsPosition('stand-ground')).toBe(true);
  });

  it('scans exactly its weapon range when holding ground', () => {
    // Stand Ground never moves, so looking further than it can shoot would
    // only produce orders it cannot act on.
    expect(autoEngageRadius('stand-ground', VISION, RANGE)).toBe(RANGE);
  });

  it('never scans at all under no-attack', () => {
    expect(autoEngageRadius('no-attack', VISION, RANGE)).toBe(0);
  });

  it('gives a melee unit on stand ground at least its own cell reach', () => {
    expect(autoEngageRadius('stand-ground', VISION, 1)).toBe(1);
  });
});

describe('stance behaviour flags', () => {
  it('only holds position under stand-ground', () => {
    expect(holdsPosition('stand-ground')).toBe(true);
    for (const stance of ['aggressive', 'defensive', 'no-attack'] as const) {
      expect(holdsPosition(stance)).toBe(false);
    }
  });

  it('only attacks buildings unprompted when aggressive', () => {
    // Defensive and Stand Ground defend; they do not start demolishing a base.
    expect(engagesBuildings('aggressive')).toBe(true);
    for (const stance of ['defensive', 'stand-ground', 'no-attack'] as const) {
      expect(engagesBuildings(stance)).toBe(false);
    }
  });
});

describe('every unit gets a default stance', () => {
  it('never returns undefined for any unit in the roster', () => {
    const roster: UnitType[] = [
      'villager', 'scout', 'militia', 'spearman', 'archer', 'skirmisher',
      'knight', 'monk', 'trebuchet', 'fishing-ship', 'galley',
      'demolition-ship', 'elite-cannon-galleon',
    ];
    for (const unitType of roster) {
      expect(UNIT_STANCES).toContain(defaultStanceFor(unitType));
    }
  });
});
