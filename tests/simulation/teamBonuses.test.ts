import { describe, expect, it } from 'vitest';

import {
  AZTECS_TEAM_RELIC_GOLD_MULTIPLIER,
  BYZANTINES_TEAM_HEAL_MULTIPLIER,
  CHINESE_TEAM_FARM_FOOD_MULTIPLIER,
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
    expect(SPANISH_TEAM_TRADE_GOLD_MULTIPLIER).toBeCloseTo(1.25, 5); // DE: +25%.
    expect(CHINESE_TEAM_FARM_FOOD_MULTIPLIER).toBeCloseTo(1.1, 5); // DE: farms +10% food.
    expect(BYZANTINES_TEAM_HEAL_MULTIPLIER).toBe(2); // DE: +100% heal speed.
    expect(TEUTONS_TEAM_CONVERT_RESISTANCE_MULTIPLIER).toBe(0.5);
    expect(MAYANS_TEAM_WALL_COST_MULTIPLIER).toBe(0.5);
    expect(VIKINGS_TEAM_DOCK_COST_MULTIPLIER).toBe(0.85); // DE: -15%.
    expect(TEAM_PRODUCTION_SPEED_MULTIPLIER).toBeCloseTo(1 / 1.2, 5);
  });
});

function bootAs(civilization: string): ReturnType<typeof createSimulationBridge> {
  return createSimulationBridge(undefined, {
    civilizationsByOwner: new Map([[1, civilization]]),
  });
}

describe('team bonuses in a real match', () => {
  it('prices Mayan walls at half and Viking Docks 15% off', () => {
    const mayans = bootAs('Mayans');
    const plain = bootAs('Britons');
    expect(mayans.getConstructionCost(1, 'stone-wall').stone)
      .toBe(Math.round((plain.getConstructionCost(1, 'stone-wall').stone ?? 0) * 0.5));
    const vikings = bootAs('Vikings');
    expect(vikings.getConstructionCost(1, 'dock').wood)
      .toBe(Math.round((plain.getConstructionCost(1, 'dock').wood ?? 0) * 0.85));
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

describe('combat-stat bonuses', () => {
  it('adds line of sight, range, and class attacks by side', async () => {
    const {
      bonusVisionRadius, bonusAttackRange, teamBuildingAttackBonus, teamAntiArcherBonus,
    } = await import('../../src/game/simulation/teamCombatBonuses');
    const civs = new Map([[1, 'Franks'], [2, 'Persians']]);
    const teams = new Map<number, number>();
    // Frankish knights see two farther; Korean-TEAM villagers three
    // (sourced v0.3.144 — DE lists it as the team bonus).
    expect(bonusVisionRadius(teams, civs, 1, 'knight', 6)).toBe(2);
    expect(bonusVisionRadius(teams, new Map([[1, 'Koreans']]), 1, 'villager', 4)).toBe(3);
    expect(bonusVisionRadius(new Map([[1, 1], [2, 1]]), new Map([[1, 'Koreans'], [2, 'Franks']]), 2, 'villager', 4)).toBe(3);
    expect(bonusVisionRadius(teams, new Map([[1, 'Japanese']]), 1, 'galley', 7)).toBe(4);
    expect(bonusVisionRadius(teams, civs, 1, 'archer', 6)).toBe(0);
    // Khmer scorpions reach one farther; the Korean mangonel range left
    // with DE (Eupseong reshaped it — sourced v0.3.144).
    expect(bonusAttackRange(teams, new Map([[1, 'Koreans']]), 1, 'mangonel')).toBe(0);
    expect(bonusAttackRange(teams, new Map([[1, 'Khmer']]), 1, 'scorpion')).toBe(1);
    // Saracen archers and Indian camels punish buildings; Persian knights
    // punish archers.
    expect(teamBuildingAttackBonus(teams, new Map([[1, 'Saracens']]), 1, 'archer')).toBe(2);
    // Hindustanis: +2, and the scout line carries it too (sourced v0.3.144).
    expect(teamBuildingAttackBonus(teams, new Map([[1, 'Indians']]), 1, 'camel')).toBe(2);
    expect(teamBuildingAttackBonus(teams, new Map([[1, 'Indians']]), 1, 'hussar')).toBe(2);
    expect(teamAntiArcherBonus(teams, civs, 2, 'knight', 'archer')).toBe(2);
    expect(teamAntiArcherBonus(teams, civs, 2, 'knight', 'militia')).toBe(0);
    // And an ALLY carries it too.
    const allied = new Map([[1, 1], [2, 1]]);
    expect(teamAntiArcherBonus(allied, civs, 1, 'knight', 'archer')).toBe(2);
  });

  it('reaches a real match: a Khmer scorpion outranges a plain one', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const khmer = createSimulationBridge('unit-showcase-fixture', {
      civilizationsByOwner: new Map([[1, 'Khmer']]),
    });
    const plain = createSimulationBridge('unit-showcase-fixture');
    const rangeOf = (bridge: typeof plain) => bridge.getEconomyState().units.find(
      (unit) => unit.unitType === 'scorpion',
    )!.attackRange;
    expect(rangeOf(khmer)).toBe(rangeOf(plain) + 1);
  });
});
