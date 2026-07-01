import { describe, expect, it } from 'vitest';

import {
  applyArmorTech,
  EXTRA_PIERCE_ARMOR_TECHS,
  pierceArmorTechBonus,
} from '../../src/game/simulation/armorTechBonuses';

describe('armor-tech bonuses (spec §11.8 — asymmetric melee/pierce)', () => {
  it('applies a symmetric armor tech as +1 melee / +1 pierce', () => {
    const state = { armor: 0, pierceArmorBonus: 0 };
    applyArmorTech(state, 'scale-mail-armor');
    expect(state.armor).toBe(1); // melee side
    expect(state.pierceArmorBonus).toBe(0); // no extra pierce
    // effective pierce bonus = armor + extra = 1
    expect(pierceArmorTechBonus(state)).toBe(1);
  });

  it('applies an asymmetric armor tech as +1 melee / +2 pierce', () => {
    for (const tech of ['loom', 'plate-mail-armor', 'plate-barding', 'ring-archer-armor'] as const) {
      const state = { armor: 0, pierceArmorBonus: 0 };
      applyArmorTech(state, tech);
      expect(state.armor).toBe(1); // +1 melee
      expect(pierceArmorTechBonus(state)).toBe(2); // +2 pierce (symmetric 1 + extra 1)
    }
  });

  it('stacks symmetric and asymmetric techs (infantry armor line)', () => {
    const state = { armor: 0, pierceArmorBonus: 0 };
    applyArmorTech(state, 'scale-mail-armor'); // +1/+1
    applyArmorTech(state, 'chain-mail-armor'); // +1/+1
    applyArmorTech(state, 'plate-mail-armor'); // +1/+2
    expect(state.armor).toBe(3); // melee: +1+1+1
    expect(pierceArmorTechBonus(state)).toBe(4); // pierce: +1+1+2
  });

  it('EXTRA_PIERCE_ARMOR_TECHS holds exactly the four asymmetric techs', () => {
    expect([...EXTRA_PIERCE_ARMOR_TECHS].sort()).toEqual(
      ['loom', 'plate-barding', 'plate-mail-armor', 'ring-archer-armor'],
    );
  });

  it('migrates a pre-split state (no pierceArmorBonus) as fully symmetric', () => {
    // Legacy combat state: only `armor` was persisted, applied to both sides.
    expect(pierceArmorTechBonus({ armor: 3 })).toBe(3);
  });

  it('does not produce NaN when applied to a pre-split state (no pierceArmorBonus)', () => {
    // A combat state restored from a pre-split save can reach applyArmorTech
    // with `pierceArmorBonus` absent; `undefined + 1` would be NaN and corrupt
    // pierce damage. The defensive `?? 0` guards this.
    const legacy: { armor: number; pierceArmorBonus?: number } = { armor: 0 };
    applyArmorTech(legacy, 'loom');
    expect(legacy.armor).toBe(1);
    expect(Number.isNaN(legacy.pierceArmorBonus)).toBe(false);
    expect(pierceArmorTechBonus(legacy)).toBe(2);
  });
});
