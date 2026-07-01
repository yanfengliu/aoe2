import { describe, expect, it } from 'vitest';

import { createCombatStateFactory } from '../../src/game/simulation/bridge/combatStateFactory';
import { pierceArmorTechBonus } from '../../src/game/simulation/armorTechBonuses';
import type { ResearchableTechnologyType, UnitType } from '../../src/game/simulation/types';

// Build a combat state for a unit whose owner has exactly `techs` researched.
// Asserts on the TECH bonus (armor = melee side, pierceArmorTechBonus = pierce
// side) so the base CSV armor doesn't matter — isolates the split's behavior.
function techBonus(unitType: UnitType, ...techs: ResearchableTechnologyType[]) {
  const set = new Set(techs);
  const factory = createCombatStateFactory({ hasTechnology: (_owner, tech) => set.has(tech) });
  const state = factory(1, unitType);
  return { melee: state.armor, pierce: pierceArmorTechBonus(state) };
}

// Spec §11.8 — armor techs are +1 melee, and +1 OR +2 pierce. The four
// asymmetric techs (Loom + the three top-tier blacksmith armor techs) give +2.
describe('asymmetric armor via the combat-state factory (spec §11.8)', () => {
  it('applies the four asymmetric techs as +1 melee / +2 pierce', () => {
    expect(techBonus('villager', 'loom')).toEqual({ melee: 1, pierce: 2 });
    expect(techBonus('spearman', 'plate-mail-armor')).toEqual({ melee: 1, pierce: 2 });
    expect(techBonus('knight', 'plate-barding')).toEqual({ melee: 1, pierce: 2 });
    expect(techBonus('archer', 'ring-archer-armor')).toEqual({ melee: 1, pierce: 2 });
  });

  it('applies symmetric armor techs as +1 melee / +1 pierce', () => {
    expect(techBonus('spearman', 'scale-mail-armor')).toEqual({ melee: 1, pierce: 1 });
    expect(techBonus('knight', 'scale-barding-armor')).toEqual({ melee: 1, pierce: 1 });
    expect(techBonus('archer', 'padded-archer-armor')).toEqual({ melee: 1, pierce: 1 });
  });

  it('stacks the full infantry armor line to +3 melee / +4 pierce', () => {
    // Scale (+1/+1) + Chain (+1/+1) + Plate (+1/+2) = +3 melee / +4 pierce.
    expect(
      techBonus('spearman', 'scale-mail-armor', 'chain-mail-armor', 'plate-mail-armor'),
    ).toEqual({ melee: 3, pierce: 4 });
  });

  it('gives no armor bonus to a unit whose class the tech does not match', () => {
    // Plate Mail (infantry) does nothing to an archer.
    expect(techBonus('archer', 'plate-mail-armor')).toEqual({ melee: 0, pierce: 0 });
  });
});
