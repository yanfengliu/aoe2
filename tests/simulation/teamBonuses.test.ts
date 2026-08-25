import { describe, expect, it } from 'vitest';

import {
  AZTECS_TEAM_RELIC_GOLD_MULTIPLIER,
  BYZANTINES_TEAM_HEAL_MULTIPLIER,
  CHINESE_TEAM_FARM_FOOD_BONUS,
  MAYANS_TEAM_WALL_COST_MULTIPLIER,
  SPANISH_TEAM_TRADE_GOLD_MULTIPLIER,
  TEAM_PRODUCTION_SPEED_MULTIPLIER,
  teamHasCivilization,
  TEUTONS_TEAM_CONVERT_RESISTANCE_MULTIPLIER,
  VIKINGS_TEAM_DOCK_COST_MULTIPLIER,
} from '../../src/game/simulation/teamBonuses';
import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';

// Team bonuses (spec §9.2): a civilization's gift to its SIDE — active for an
// owner when the owner or any ally plays the civ, so a team of one still
// enjoys its own, which is AoE2's rule and what makes a 1v1 testable.

describe('who carries a team bonus', () => {
  const civs = new Map([[1, 'Aztecs'], [2, 'Franks'], [3, 'Britons']]);
  it('is the owner and its allies, never the enemy', () => {
    const teams = new Map([[1, 1], [3, 1], [2, 2]]);
    expect(teamHasCivilization(teams, civs, 1, 'Aztecs')).toBe(true);
    expect(teamHasCivilization(teams, civs, 3, 'Aztecs')).toBe(true);
    expect(teamHasCivilization(teams, civs, 2, 'Aztecs')).toBe(false);
    expect(teamHasCivilization(teams, civs, 1, 'Britons')).toBe(true);
  });
  it('holds for a side of one in a free-for-all', () => {
    expect(teamHasCivilization(new Map(), civs, 1, 'Aztecs')).toBe(true);
    expect(teamHasCivilization(new Map(), civs, 2, 'Aztecs')).toBe(false);
  });
});

describe('the numbers', () => {
  it('are the CSV figures, one constant per line', () => {
    expect(AZTECS_TEAM_RELIC_GOLD_MULTIPLIER).toBeCloseTo(1.33, 5);
    expect(SPANISH_TEAM_TRADE_GOLD_MULTIPLIER).toBeCloseTo(1.33, 5);
    expect(CHINESE_TEAM_FARM_FOOD_BONUS).toBe(45);
    expect(BYZANTINES_TEAM_HEAL_MULTIPLIER).toBe(1.5);
    expect(TEUTONS_TEAM_CONVERT_RESISTANCE_MULTIPLIER).toBe(0.5);
    expect(MAYANS_TEAM_WALL_COST_MULTIPLIER).toBe(0.5);
    expect(VIKINGS_TEAM_DOCK_COST_MULTIPLIER).toBe(0.75);
    expect(TEAM_PRODUCTION_SPEED_MULTIPLIER).toBeCloseTo(1 / 1.2, 5);
  });
});

function bootAs(civilization: string): ReturnType<typeof createSimulationBridge> {
  return createSimulationBridge(undefined, {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
}

describe('team bonuses in a real match', () => {
  it('prices Mayan walls at half and Viking Docks a quarter off', () => {
    const mayans = bootAs('Mayans');
    const plain = bootAs('Britons');
    expect(mayans.getConstructionCost(1, 'stone-wall').stone)
      .toBe(Math.round((plain.getConstructionCost(1, 'stone-wall').stone ?? 0) * 0.5));
    const vikings = bootAs('Vikings');
    expect(vikings.getConstructionCost(1, 'dock').wood)
      .toBe(Math.round((plain.getConstructionCost(1, 'dock').wood ?? 0) * 0.75));
    // The enemy pays full price.
    expect(mayans.getConstructionCost(2, 'stone-wall'))
      .toEqual(plain.getConstructionCost(2, 'stone-wall'));
  });

  it('shelters five more per Slav-team military building', () => {
    // The bonus lands at building CREATION, so the civ has to be set when the
    // fixture's barracks is seeded — the civilizationsByOwner option reaches
    // any fresh scenario. (A blob-swapped civ after boot rightly changes
    // nothing: raw supply is persisted history, not re-derived.)
    const slavs = createSimulationBridge('new-tech-reach-fixture', {
      civilizationsByOwner: new Map([[1, 'Slavs']]),
    });
    const plain = createSimulationBridge('new-tech-reach-fixture');
    // The fixture stands TWO military buildings (Barracks + Archery Range).
    expect(slavs.getPopulationState(1).cap)
      .toBe(plain.getPopulationState(1).cap + 10);
  });
});
