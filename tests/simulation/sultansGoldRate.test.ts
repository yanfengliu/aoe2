// Sultans (Indians, Castle Age, 400 gold): villagers gather gold 10% faster.
//
// The fifth expansion-civilization unique technology, and the first whose
// effect is economic rather than martial. Its multiplier lives in
// `GATHER_RATE_TECH_FACTORS` alongside Gold Mining and Gold Shaft Mining rather
// than in a new field on `UniqueTechnology`, so it stacks with them the way
// AoE2 stacks its own gold technologies — and so one entry does not invent
// effect vocabulary the rest of the roster would not use.
//
// The end-to-end case is the one that matters. This repo has repeatedly found
// technologies that exist as a data row, appear on a menu, and change nothing
// at runtime because no consumer reads the effect — the menu/validator pair
// defects of 2026-08-23 are three instances in the register.

import { describe, expect, it } from 'vitest';

import { gatherRateMultiplier } from '../../src/game/simulation/economyTechEffects';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import { UNIQUE_TECHNOLOGIES } from '../../src/game/simulation/uniqueTechnologies';
import type { ResearchableTechnologyType } from '../../src/game/simulation/types';

const researched = (...techs: ResearchableTechnologyType[]) => new Set(techs);

describe('Sultans', () => {
  it('speeds gold gathering by 10%', () => {
    expect(gatherRateMultiplier(researched('sultans'), 'gold')).toBeCloseTo(1.1, 5);
  });

  it('touches nothing but gold', () => {
    // The failure this guards is a resource-blind multiplier: an effect keyed
    // on the wrong field would speed every gatherer and read as a much bigger
    // civilization bonus than the wiki describes.
    for (const resource of ['food', 'wood', 'stone'] as const) {
      expect(gatherRateMultiplier(researched('sultans'), resource)).toBe(1);
    }
  });

  it('stacks with the mining line, as AoE2 stacks its gold techs', () => {
    // 1.1 x 1.15 x 1.15, not 1.1 or a replacement — the whole reason the effect
    // was put in the shared table rather than given its own field.
    const stacked = gatherRateMultiplier(
      researched('sultans', 'gold-mining', 'gold-shaft-mining'),
      'gold',
    );
    expect(stacked).toBeCloseTo(1.1 * 1.15 * 1.15, 5);
  });

  it('is registered as a researchable Castle-Age unique with a real price', () => {
    const entry = UNIQUE_TECHNOLOGIES.find((tech) => tech.id === 'sultans');
    expect(entry, 'Sultans is missing from the unique-technology table').toBeDefined();
    expect(entry!.civilization).toBe('Indians');
    expect(entry!.age).toBe('castle-age');
    // A technology with no cost row is offerable and free; a validator that
    // charges nothing is how a menu and its rules drift apart.
    expect(RESEARCH_COSTS.sultans).toEqual({ gold: 400 });
    expect(RESEARCH_TIME_TICKS.sultans).toBe(500);
  });
});
