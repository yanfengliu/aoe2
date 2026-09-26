import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import { gatherRateMultiplier } from '../../src/game/simulation/economyTechEffects';
import { RESEARCH_COSTS, RESEARCH_TIME_TICKS } from '../../src/game/simulation/researchTables';
import {
  UNIQUE_TECHNOLOGIES,
  uniqueBuildingBonus,
  uniqueTechnologiesFor,
  unitEffectsOf,
} from '../../src/game/simulation/uniqueTechnologies';
import { applyUniqueUnitEffect } from '../../src/game/simulation/bridge/combatStateFactory';
import {
  UPGRADE_BONUS_ARCHERY_RANGE,
  UPGRADE_BONUS_CAPPED_RAM_WORKSHOP,
  UPGRADE_BONUS_SIEGE_ONAGER_WORKSHOP,
} from '../../src/game/simulation/fixtures/upgradeKeepsLineBonuses';
import { movementSpeedPercent } from '../../src/game/simulation/movementTechEffects';
import { unitAttackRange, unitMaxHp } from '../../src/game/simulation/prototypeUnitRules';
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
    //
    // An effect does not have to live on this record. A gather-rate technology
    // belongs in `GATHER_RATE_TECH_FACTORS` with Gold Mining and the rest, so
    // that it STACKS the way AoE2's economy techs stack — giving it a field
    // here instead would have handed one entry different arithmetic. So the
    // question is "does something read it", not "does this record carry a
    // field", and the gather table is a legitimate answer.
    for (const technology of UNIQUE_TECHNOLOGIES) {
      const hasRecordEffect = Boolean(
        technology.unitEffect
        || technology.buildingEffect
        || technology.trainRate
        || technology.unlocksTraining
        || technology.regenMultiplier
        || technology.countdownExtensionTicks,
      );
      const hasGatherEffect = (['food', 'wood', 'gold', 'stone'] as const).some(
        (resource) => gatherRateMultiplier(new Set([technology.id]), resource) !== 1,
      );
      expect(hasRecordEffect || hasGatherEffect, technology.id).toBe(true);
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

  // The line's LATER tiers, which the three hand lists behind these left out
  // (defect register, 2026-09-26). The lists here are the rosters the
  // technologies.csv rows name, written out rather than read from the game's
  // tables, so a table that drops a tier fails by name. Current DE words two of
  // them differently (spec §9.2.2), and that is not decided here.
  it('Shinkichon reaches the whole Mangonel line, the Siege Onager included', () => {
    for (const unitType of ['mangonel', 'onager', 'siege-onager'] as const) {
      expect(afterResearch('shinkichon', unitType).attackRange, unitType).toBe(2);
    }
    expect(afterResearch('shinkichon', 'scorpion').attackRange).toBe(1);
  });

  it('Furor Celtica and Drill reach every Siege Workshop unit, the Capped Ram and Siege Onager included', () => {
    const workshop: UnitType[] = [
      'mangonel', 'onager', 'siege-onager', 'scorpion', 'heavy-scorpion',
      'battering-ram', 'capped-ram', 'siege-ram', 'bombard-cannon',
    ];
    for (const unitType of workshop) {
      expect(afterResearch('furor-celtica', unitType).maxHp, unitType).toBe(150);
      expect(movementSpeedPercent(set('drill'), unitType), unitType)
        .toBe(Math.round(unitBaseSpeedPercent(unitType) * 1.5));
    }
    // technologies.csv says "Siege Workshop Units", and the Trebuchet is a
    // Castle unit. (DE's current text says "Siege Weapons"; spec §9.2.2.)
    expect(afterResearch('furor-celtica', 'trebuchet').maxHp).toBe(100);
  });

  it('Yeomen reaches both tiers of the Skirmisher', () => {
    for (const unitType of ['skirmisher', 'elite-skirmisher'] as const) {
      expect(afterResearch('yeomen', unitType).attackRange, unitType).toBe(2);
    }
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
    const anarchy = (technology: ResearchableTechnologyType) => technology === 'anarchy';
    expect(unlockedTrainingFor('Goths', 'barracks', anarchy)).toEqual(['huskarl']);
    expect(unlockedTrainingFor('Goths', 'stable', anarchy)).toHaveLength(0);
    expect(unlockedTrainingFor('Franks', 'barracks', anarchy)).toHaveLength(0);
    // ...and only once it is actually researched.
    expect(unlockedTrainingFor('Goths', 'barracks', () => false)).toHaveLength(0);
  });

  it('Anarchy follows the Huskarl line: after the Elite Huskarl upgrade the Barracks trains the elite', () => {
    // The unlock named the first tier only, so the Barracks went on training
    // base Huskarls after the upgrade while the Castle trained elites
    // (defect register, 2026-09-26). The same line's tiers, the same place.
    const researched = (...technologies: ResearchableTechnologyType[]) =>
      (technology: ResearchableTechnologyType) => technologies.includes(technology);
    expect(unlockedTrainingFor('Goths', 'barracks', researched('anarchy', 'elite-huskarl-upgrade'))).toEqual(['elite-huskarl']);
    // Only the Huskarl's own upgrade moves it, not another elite upgrade.
    expect(unlockedTrainingFor('Goths', 'barracks', researched('anarchy', 'elite-samurai-upgrade'))).toEqual(['huskarl']);
    expect(unlockedTrainingFor('Goths', 'barracks', researched('elite-huskarl-upgrade'))).toHaveLength(0);
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

describe('an upgrade keeps the unique technology its line had', () => {
  // In a match: researching an upgrade rebuilds every unit it replaces from the
  // new type, so a tier a technology's list leaves out loses the bonus the
  // moment the research completes. Before the fix, the Celts' Siege Onager
  // upgrade took Furor Celtica's hit points off their Onagers, their Capped Ram
  // upgrade took them off their Battering Rams, and the Britons' Elite
  // Skirmisher upgrade took Yeomen's range off their Skirmishers. (Shinkichon's
  // own miss, the Siege Onager, is not reachable this way: the Korean tree here
  // has no Mangonel line, as in current DE, so only a converted one shows it.)
  function upgradeScene(seed: string) {
    const bridge: Bridge = createSimulationBridge(seed);
    const combatOf = (id: number) => {
      const rows = (bridge.world.getState('aoe2.combatStates') ?? []) as Array<
        [number, { maxHp: number; attackRange: number }]
      >;
      const combat = new Map(rows).get(id);
      if (!combat) throw new Error(`unit ${String(id)} has no combat state`);
      return combat;
    };
    const unitNamed = (unitType: UnitType) => {
      const unit = bridge.getEconomyState().units.find((u) => u.owner === 1 && u.unitType === unitType);
      if (!unit) throw new Error(`${seed} has no ${unitType} of owner 1`);
      return unit.id;
    };
    const typeOf = (id: number) => bridge.getEconomyState().units.find((u) => u.id === id)?.unitType;
    const research = (at: { x: number; y: number }, technology: ResearchableTechnologyType) => {
      expect(bridge.selectEntityAtCell(at.x, at.y), `nothing to select at (${String(at.x)}, ${String(at.y)})`).toBe(true);
      expect(bridge.queueResearch(technology), `${technology} was refused`).toBe(true);
    };
    const stepUntilUpgraded = (upgraded: ReadonlyArray<readonly [number, UnitType]>) => {
      const done = () => upgraded.every(([id, unitType]) => typeOf(id) === unitType);
      expect(stepBridgeUntil(bridge, done, { maxSteps: 2_000 }),
        `still waiting on ${upgraded.map(([id]) => String(typeOf(id))).join(', ')}`).toBe(true);
    };
    return { combatOf, unitNamed, research, stepUntilUpgraded };
  }

  it('leaves the Celts\' Siege Onagers and Capped Rams Furor Celtica\'s hit points', () => {
    const scene = upgradeScene('upgrade-keeps-line-bonuses-celts-fixture');
    const onager = scene.unitNamed('onager');
    const ram = scene.unitNamed('battering-ram');
    // The instrument: the bonus is on the lower tiers before anything runs.
    expect(scene.combatOf(onager).maxHp).toBe(Math.round(unitMaxHp('onager') * 1.5));
    expect(scene.combatOf(ram).maxHp).toBe(Math.round(unitMaxHp('battering-ram') * 1.5));

    scene.research(UPGRADE_BONUS_SIEGE_ONAGER_WORKSHOP, 'siege-onager-upgrade');
    scene.research(UPGRADE_BONUS_CAPPED_RAM_WORKSHOP, 'capped-ram-upgrade');
    scene.stepUntilUpgraded([[onager, 'siege-onager'], [ram, 'capped-ram']]);

    expect(scene.combatOf(onager).maxHp, 'the upgraded Siege Onager')
      .toBe(Math.round(unitMaxHp('siege-onager') * 1.5));
    expect(scene.combatOf(ram).maxHp, 'the upgraded Capped Ram')
      .toBe(Math.round(unitMaxHp('capped-ram') * 1.5));
  }, 120_000);

  it('leaves the Britons\' Elite Skirmishers Yeomen\'s range', () => {
    const scene = upgradeScene('upgrade-keeps-line-bonuses-britons-fixture');
    const skirmisher = scene.unitNamed('skirmisher');
    expect(scene.combatOf(skirmisher).attackRange).toBe(unitAttackRange('skirmisher') + 1);

    scene.research(UPGRADE_BONUS_ARCHERY_RANGE, 'elite-skirmisher-upgrade');
    scene.stepUntilUpgraded([[skirmisher, 'elite-skirmisher']]);

    expect(scene.combatOf(skirmisher).attackRange, 'the upgraded Elite Skirmisher')
      .toBe(unitAttackRange('elite-skirmisher') + 1);
  }, 120_000);
});
