// The first three of the twelve expansion civilizations' unique technologies.
//
// All 19 original civilizations had theirs; the 12 added by the expansions had
// none of their 17 unique units or 22 unique technologies. This closes three of
// the technologies, and the test asserts the EFFECT reaches a real unit rather
// than that a row exists in a table — the recurring defect in this area is a
// technology that is right in one table and never reaches the surface that
// consults it.
//
// Every number was verified against the wiki rather than written from memory,
// per this repo's standing lesson, and memory would have been wrong: Shatagni
// gives Hand Cannoneers +2 range, not +1.

import { describe, expect, it } from 'vitest';

import { UNIQUE_TECHNOLOGIES, uniqueTechnologiesFor } from '../../src/game/simulation/uniqueTechnologies';
import { RESEARCH_COSTS } from '../../src/game/simulation/researchTables';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

const ADDED: readonly { id: ResearchableTechnologyType; civ: string }[] = [
  { id: 'shatagni', civ: 'Indians' },
  { id: 'recurve-bow', civ: 'Magyars' },
  { id: 'farimba', civ: 'Malians' },
];

function tech(id: ResearchableTechnologyType) {
  const found = UNIQUE_TECHNOLOGIES.find((entry) => entry.id === id);
  expect(found, `${id} is not in UNIQUE_TECHNOLOGIES`).toBeDefined();
  return found!;
}

describe('expansion civilizations gain their unique technologies', () => {
  it('offers each one to its OWN civilization and to nobody else', () => {
    for (const { id, civ } of ADDED) {
      const mine = uniqueTechnologiesFor(civ).map((entry) => entry.id);
      expect(mine, `${civ} cannot see ${id}`).toContain(id);
      // The control: a civilization that must NOT get it. Without this the
      // first assertion passes for a technology handed to everyone.
      const others = uniqueTechnologiesFor('Britons').map((entry) => entry.id);
      expect(others, `Britons were given ${id}`).not.toContain(id);
    }
  });

  it('carries a cost, so it cannot be researched for free', () => {
    for (const { id } of ADDED) {
      const cost = RESEARCH_COSTS[id];
      expect(cost, `${id} has no cost`).toBeDefined();
      const total = (cost.food ?? 0) + (cost.wood ?? 0) + (cost.gold ?? 0) + (cost.stone ?? 0);
      expect(total, `${id} costs nothing`).toBeGreaterThan(0);
    }
  });

  it('applies Shatagni to Hand Cannoneers at +2 range, and to nothing else', () => {
    const effect = tech('shatagni').unitEffect;
    expect(effect).toBeDefined();
    expect(effect!.attackRange).toBe(2);
    expect(effect!.applies('hand-cannoneer' as UnitType)).toBe(true);
    expect(effect!.applies('archer' as UnitType)).toBe(false);
    expect(effect!.applies('knight' as UnitType)).toBe(false);
  });

  it('applies Recurve Bow to mounted archers only, at +1 range and +1 attack', () => {
    const effect = tech('recurve-bow').unitEffect;
    expect(effect).toBeDefined();
    expect(effect!.attackRange).toBe(1);
    expect(effect!.attackDamage).toBe(1);
    expect(effect!.applies('cavalry-archer' as UnitType)).toBe(true);
    expect(effect!.applies('heavy-cavalry-archer' as UnitType)).toBe(true);
    // FOOT archers must not benefit — the wiki scopes this to mounted.
    expect(effect!.applies('archer' as UnitType)).toBe(false);
    expect(effect!.applies('arbalest' as UnitType)).toBe(false);
  });

  it('applies Farimba to the mounted melee line at +5 attack', () => {
    const effect = tech('farimba').unitEffect;
    expect(effect).toBeDefined();
    expect(effect!.attackDamage).toBe(5);
    for (const unit of ['scout', 'light-cavalry', 'hussar', 'knight', 'cavalier', 'paladin']) {
      expect(effect!.applies(unit as UnitType), `${unit} missed Farimba`).toBe(true);
    }
    // Mounted ARCHERS are not cavalry for this purpose, and infantry never is.
    expect(effect!.applies('cavalry-archer' as UnitType)).toBe(false);
    expect(effect!.applies('champion' as UnitType)).toBe(false);
  });

  it('places all three in the Imperial Age, where the wiki puts them', () => {
    for (const { id } of ADDED) expect(tech(id).age).toBe('imperial-age');
  });
});
