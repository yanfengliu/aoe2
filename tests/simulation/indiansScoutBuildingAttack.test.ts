// Hindustanis (this roster's Indians) team bonus, DE: "Scout Cavalry-line and
// Camel Units +2 attack vs. buildings" (the help text in aoe2techtree
// 3bb43b14, DE update 185872).
//
// A TEAM line: `teamBuildingAttackBonus` gives it to the whole side, the Indian
// owner included. Until v0.3.248 the Indians entry in CIV_BONUSES added the same
// +2 again through `civBuildingAttackBonus`, so an Indian owner's Scout hit a
// building for +4 (defect register, 2026-10-11). The emptied table seam was
// deleted in v0.3.251, so the team seam is the line's only home. The census over
// every civilization, unit and age is civBonusDeParity.test.ts.

import { describe, expect, it } from 'vitest';

import { teamBuildingAttackBonus } from '../../src/game/simulation/teamCombatBonuses';
import type { UnitType } from '../../src/game/simulation/types';

const SOLO = new Map<number, number>();
const ALLIED = new Map([[1, 1], [2, 1]]);

/** What the attack delivery adds for owner 1 from the team seam; the Indians have no ladder. */
function total(civilizations: Map<number, string>, teams: Map<number, number>, unit: UnitType): number {
  return teamBuildingAttackBonus(teams, civilizations, 1, unit);
}

describe('the Indian Scout line hits buildings harder, once', () => {
  it('adds 2 for every unit in the Scout line and the camels, for the Indian owner', () => {
    for (const unit of ['scout', 'light-cavalry', 'hussar', 'camel', 'heavy-camel'] as const) {
      expect(total(new Map([[1, 'Indians']]), SOLO, unit), unit).toBe(2);
    }
  });

  it('adds the same 2 for an ally of the Indians', () => {
    for (const unit of ['scout', 'light-cavalry', 'hussar'] as const) {
      expect(total(new Map([[1, 'Britons'], [2, 'Indians']]), ALLIED, unit), unit).toBe(2);
    }
  });

  it('adds nothing for units outside those lines', () => {
    // The bonus is the Scout LINE, not cavalry at large: a Knight gaining it
    // would be a much larger bonus than DE describes.
    for (const unit of ['knight', 'cavalier', 'paladin', 'villager', 'archer'] as const) {
      expect(total(new Map([[1, 'Indians']]), SOLO, unit), unit).toBe(0);
    }
  });

  it('adds nothing for other civilizations', () => {
    for (const civilization of ['Britons', 'Franks', 'Portuguese']) {
      expect(total(new Map([[1, civilization]]), SOLO, 'scout'), civilization).toBe(0);
    }
  });
});
