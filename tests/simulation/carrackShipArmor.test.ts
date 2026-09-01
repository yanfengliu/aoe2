// Carrack (Portuguese, Castle Age, 200 wood + 200 gold): all ships +1/+1 armour.
//
// The sixth expansion-civilization unique technology. Its effect rides
// `unitEffect` with `applies: isWaterUnit`, which is the same shape Careening
// already uses for its pierce-only half — so the naval armour path is shared
// rather than reinvented, and the two stack as AoE2's naval armour does.
//
// The end-to-end assertion is the one that matters, and the reason is in the
// register three times over: a technology can exist as a data row, appear on a
// Dock's research card, be charged for, and change nothing at all because no
// consumer reads the effect. Two elite naval upgrades shipped exactly that way.

import { describe, expect, it } from 'vitest';

import { UNIQUE_TECHNOLOGIES } from '../../src/game/simulation/uniqueTechnologies';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import { isWaterUnit } from '../../src/game/simulation/unitDomain';

const carrack = () => {
  const entry = UNIQUE_TECHNOLOGIES.find((tech) => tech.id === 'carrack');
  if (!entry) throw new Error('Carrack is missing from the unique-technology table');
  return entry;
};

describe('Carrack', () => {
  it('gives ships one point of each armour', () => {
    const effect = carrack().unitEffect;
    expect(effect, 'Carrack carries no unit effect — it would be a 400-resource no-op').toBeDefined();
    expect(effect!.armor).toBe(1);
    expect(effect!.pierceArmor).toBe(1);
  });

  it('applies to ships and to nothing on land', () => {
    const applies = carrack().unitEffect!.applies;
    // Ships across the whole Dock roster, not just the warships: Careening's
    // transport bonus is the precedent that naval technologies reach the
    // civilian hulls too.
    for (const ship of ['galley', 'war-galley', 'galleon', 'fire-ship', 'demolition-ship',
      'cannon-galleon', 'transport-ship', 'fishing-ship', 'trade-cog'] as const) {
      expect(applies(ship), `${ship} should be covered`).toBe(true);
      expect(isWaterUnit(ship), `${ship} must be a water unit for the predicate to be right`).toBe(true);
    }
    for (const land of ['villager', 'knight', 'archer', 'battering-ram', 'monk'] as const) {
      expect(applies(land), `${land} must not gain ship armour`).toBe(false);
    }
  });

  it('is a Castle-Age Portuguese technology with a real price', () => {
    const entry = carrack();
    expect(entry.civilization).toBe('Portuguese');
    expect(entry.age).toBe('castle-age');
    // A technology with no cost row is offerable and free, which is how a menu
    // and its validator drift apart.
    expect(RESEARCH_COSTS.carrack).toEqual({ wood: 200, gold: 200 });
    expect(RESEARCH_TIME_TICKS.carrack).toBe(400);
  });
});
