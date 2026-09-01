// civilizations.csv, Indians team bonus: "Scout line and Camels have +2 attack
// vs. buildings."
//
// Sourced from the repo's OWN stats table rather than from memory or an
// unconsulted wiki — which is the distinction the 2026-09-01 retraction was
// about. The Camel line does not exist in this roster, so the rule covers the
// Scout line that does, and widens for free the day camels arrive.

import { describe, expect, it } from 'vitest';

import { civBuildingAttackBonus } from '../../src/game/simulation/civBonusEffects';

describe('the Indians scout line hits buildings harder', () => {
  it('adds 2 for every unit in the scout line', () => {
    for (const unit of ['scout', 'light-cavalry', 'hussar'] as const) {
      expect(civBuildingAttackBonus('Indians', unit), unit).toBe(2);
    }
  });

  it('adds nothing for units outside that line', () => {
    // The bonus is the scout LINE, not cavalry at large: a Knight gaining it
    // would be a much larger civilization bonus than the table describes.
    for (const unit of ['knight', 'cavalier', 'paladin', 'villager', 'archer'] as const) {
      expect(civBuildingAttackBonus('Indians', unit), unit).toBe(0);
    }
  });

  it('adds nothing for other civilizations', () => {
    for (const civ of ['Britons', 'Franks', 'Portuguese', undefined]) {
      expect(civBuildingAttackBonus(civ, 'scout'), String(civ)).toBe(0);
    }
  });
});
