import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import {
  UNIQUE_TECHNOLOGIES,
  uniqueBuildingBonus,
  uniqueTechnologiesFor,
  unitEffectsOf,
} from '../../src/game/simulation/uniqueTechnologies';
import { applyUniqueUnitEffect } from '../../src/game/simulation/bridge/combatStateFactory';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import { unitBaseSpeedPercent } from '../../src/game/simulation/prototypeUnitRules/unitBaseSpeed';
import { uniqueTechTrainTimeMultiplier } from '../../src/game/simulation/productionTechEffects';
import { unlockedTrainingFor } from '../../src/game/simulation/uniqueTechnologyUnlocks';
import type { CombatState } from '../../src/game/simulation/bridge/systems/systemTypes';
import type {
  ResearchableTechnologyType,
  UnitType,
} from '../../src/game/simulation/types';
import { selectOwnedBuildingDirect, stepBridgeUntil } from './createSimulationBridge.helpers';

type Bridge = ReturnType<typeof createSimulationBridge>;

const set = (...techs: ResearchableTechnologyType[]) =>
  new Set<ResearchableTechnologyType>(techs);

function stateOf(overrides: Partial<CombatState> = {}): CombatState {
  return {
    currentHp: 100,
    maxHp: 100,
    attackDamage: 10,
    attackRange: 1,
    reloadTicks: 20,
    cooldownTicks: 0,
    armor: 0,
    pierceArmorBonus: 0,
    ...overrides,
  };
}

/** Apply every effect a technology carries to a fresh state. */
function afterResearch(id: ResearchableTechnologyType, unitType: UnitType): CombatState {
  const state = stateOf();
  for (const effect of unitEffectsOf(id)) applyUniqueUnitEffect(state, effect, unitType);
  return state;
}

describe('the unique-technology roster', () => {
  it('gives every listed technology a cost and a research time', () => {
    expect(UNIQUE_TECHNOLOGIES.length).toBeGreaterThanOrEqual(16);
    for (const technology of UNIQUE_TECHNOLOGIES) {
      expect(RESEARCH_COSTS[technology.id], technology.id).toBeDefined();
      expect(RESEARCH_TIME_TICKS[technology.id], technology.id).toBeGreaterThan(0);
      expect(technology.summary.length, technology.id).toBeGreaterThan(0);
    }
  });

  it('gives every technology an effect of some kind', () => {
    // A technology that costs 750 food and does nothing is worse than one that
    // is honestly absent — the three we cannot express are listed as deferred,
    // not shipped as no-ops.
    for (const technology of UNIQUE_TECHNOLOGIES) {
      const hasEffect = Boolean(
        technology.unitEffect
        || technology.buildingEffect
        || technology.trainRate
        || technology.unlocksTraining,
      );
      expect(hasEffect, technology.id).toBe(true);
    }
  });

  it('belongs to a civilization that also has a unique unit', () => {
    for (const technology of UNIQUE_TECHNOLOGIES) {
      expect(uniqueTechnologiesFor(technology.civilization), technology.civilization)
        .toContain(technology);
    }
  });
});

describe('unit effects', () => {
  it('Garland Wars gives infantry +4 attack and leaves cavalry alone', () => {
    expect(afterResearch('garland-wars', 'champion').attackDamage).toBe(14);
    // The infantry-class unique units count too.
    expect(afterResearch('garland-wars', 'jaguar-warrior').attackDamage).toBe(14);
    expect(afterResearch('garland-wars', 'knight').attackDamage).toBe(10);
  });

  it('Furor Celtica multiplies siege hit points and fills a full unit', () => {
    const onager = afterResearch('furor-celtica', 'onager');
    expect(onager.maxHp).toBe(150);
    expect(onager.currentHp).toBe(150);
    expect(afterResearch('furor-celtica', 'champion').maxHp).toBe(100);
  });

  it('Rocketry carries two different amounts to two different lines', () => {
    expect(afterResearch('rocketry', 'chu-ko-nu').attackDamage).toBe(12);
    expect(afterResearch('rocketry', 'scorpion').attackDamage).toBe(14);
    expect(afterResearch('rocketry', 'archer').attackDamage).toBe(10);
  });

  it('Kataparuto shortens the trebuchet reload', () => {
    expect(afterResearch('kataparuto', 'trebuchet').reloadTicks).toBe(15);
    expect(afterResearch('kataparuto', 'mangonel').reloadTicks).toBe(20);
  });

  it('Supremacy raises every villager number at once', () => {
    const villager = afterResearch('supremacy', 'villager');
    expect(villager.attackDamage).toBe(16);
    expect(villager.maxHp).toBe(140);
    expect(villager.armor).toBe(2);
    expect(villager.pierceArmorBonus).toBe(2);
  });

  it('leaves a damaged unit damaged when it grants flat hit points', () => {
    const damaged = stateOf({ currentHp: 40, maxHp: 100 });
    for (const effect of unitEffectsOf('zealotry')) {
      applyUniqueUnitEffect(damaged, effect, 'camel');
    }
    expect(damaged.maxHp).toBe(130);
    expect(damaged.currentHp).toBe(70);
  });
});

describe('speed effects ride the movement seam', () => {
  it('Drill moves siege 50% faster and nothing else', () => {
    const base = unitBaseSpeedPercent('mangonel');
    expect(movementSpeedPercent(set('drill'), 'mangonel')).toBe(Math.round(base * 1.5));
    expect(movementSpeedPercent(set('drill'), 'knight'))
      .toBe(unitBaseSpeedPercent('knight'));
  });

  it('Mahouts moves War Elephants 30% faster', () => {
    const base = unitBaseSpeedPercent('war-elephant');
    expect(movementSpeedPercent(set('mahouts'), 'war-elephant')).toBe(Math.round(base * 1.3));
  });
});

describe('building and production effects', () => {
  it('Yeomen arms towers and Crenellations lengthens castles', () => {
    expect(uniqueBuildingBonus(set('yeomen'), 'watch-tower').attackDamage).toBe(2);
    expect(uniqueBuildingBonus(set('yeomen'), 'castle').attackDamage).toBe(0);
    expect(uniqueBuildingBonus(set('crenellations'), 'castle').attackRange).toBe(3);
    expect(uniqueBuildingBonus(set(), 'castle')).toEqual({ attackDamage: 0, attackRange: 0 });
  });

  it('Perfusion halves Barracks train time, and only at the Barracks', () => {
    expect(uniqueTechTrainTimeMultiplier(set('perfusion'), 'barracks')).toBeCloseTo(0.5, 5);
    expect(uniqueTechTrainTimeMultiplier(set('perfusion'), 'stable')).toBe(1);
    expect(uniqueTechTrainTimeMultiplier(set(), 'barracks')).toBe(1);
  });

  it('Anarchy opens the Huskarl at the Barracks for the Goths only', () => {
    const has = () => true;
    expect(unlockedTrainingFor('Goths', 'barracks', has)).toContain('huskarl');
    expect(unlockedTrainingFor('Goths', 'stable', has)).toHaveLength(0);
    expect(unlockedTrainingFor('Franks', 'barracks', has)).toHaveLength(0);
    // ...and only once it is actually researched.
    expect(unlockedTrainingFor('Goths', 'barracks', () => false)).toHaveLength(0);
  });
});

describe('a Castle offers only its own civilization technologies', () => {
  function castleResearch(civilization: string, scenario: string): readonly string[] {
    const bridge: Bridge = createSimulationBridge(scenario, {
      civilizationsByOwner: new Map([[1, civilization]]),
    });
    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    return bridge.getSelectionState().researchOptions;
  }

  it('offers Garland Wars to the Aztecs and never to the Teutons', () => {
    expect(castleResearch('Aztecs', 'imperial-castle-fixture')).toContain('garland-wars');
    const teutons = castleResearch('Teutons', 'imperial-castle-fixture');
    expect(teutons).toContain('crenellations');
    expect(teutons).not.toContain('garland-wars');
  });

  it('offers the Castle-Age Anarchy in Castle Age, and Perfusion only in Imperial', () => {
    const castleAge = castleResearch('Goths', 'castle-unique-fixture');
    expect(castleAge).toContain('anarchy');
    expect(castleAge).not.toContain('perfusion');
    expect(castleResearch('Goths', 'imperial-castle-fixture')).toContain('perfusion');
  });
});

describe('researching a unique technology', () => {
  it('reaches the units already standing', () => {
    // imperial-castle-BRITONS-fixture is the one with a Longbowman standing.
    const bridge: Bridge = createSimulationBridge('imperial-castle-britons-fixture');
    const longbow = bridge.getEconomyState().units
      .find((unit) => unit.owner === 1 && unit.unitType === 'longbowman');
    expect(longbow, 'the fixture has no Longbowman to bump').toBeDefined();

    expect(selectOwnedBuildingDirect(bridge, 1, 'castle')).toBe(true);
    expect(bridge.queueResearch('yeomen')).toBe(true);

    const rangeOf = () => {
      const states = bridge.world.getState('aoe2.combatStates') as Array<
        [number, { attackRange: number }]
      > | undefined;
      return (states ?? []).find(([id]) => id === longbow!.id)?.[1].attackRange ?? 0;
    };
    bridge.step(100);
    const startRange = rangeOf();
    expect(startRange).toBeGreaterThan(0);
    expect(stepBridgeUntil(bridge, () => rangeOf() > startRange, { maxSteps: 900 }),
      'Yeomen never reached the standing Longbowman').toBe(true);
    expect(rangeOf()).toBe(startRange + 1);
  }, 60_000);
});
