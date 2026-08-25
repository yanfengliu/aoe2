import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import {
  civAgeAdvanceGrant,
  civGatherRateMultiplier,
  civUnitHpMultiplier,
  civBuildingAttackBonus,
  civTrainTimeMultiplier,
  civSpeedMultiplier,
  effectiveTrainingCost,
} from '../../src/game/simulation/civBonusEffects';

// The civilization-bonus breadth push (spec §9.2): every CSV bonus line the
// existing seams can express, declared in one table. Each block below is one
// SEAM, asserting the newly-encoded civs and that everyone else still reads
// the neutral value — the five original curated civs keep their own tests.

const NONE = new Set<never>() as ReadonlySet<never>;

describe('gather-rate bonuses', () => {
  it('speeds the right workers for the right civs and nobody else', () => {
    expect(civGatherRateMultiplier('Celts', 'tree')).toBeCloseTo(1.15, 5);
    expect(civGatherRateMultiplier('Koreans', 'stone-mine')).toBeCloseTo(1.2, 5);
    expect(civGatherRateMultiplier('Turks', 'gold-mine')).toBeCloseTo(1.15, 5);
    expect(civGatherRateMultiplier('Slavs', 'farm')).toBeCloseTo(1.15, 5);
    expect(civGatherRateMultiplier('Indians', 'fish')).toBeCloseTo(1.15, 5);
    // The originals hold, and a civ without the bonus reads 1.
    expect(civGatherRateMultiplier('Britons', 'sheep')).toBeCloseTo(1.25, 5);
    expect(civGatherRateMultiplier('Celts', 'gold-mine')).toBe(1);
    expect(civGatherRateMultiplier('Vikings', 'tree')).toBe(1);
  });
});

describe('unit-HP bonuses', () => {
  it('multiplies the named lines', () => {
    expect(civUnitHpMultiplier('Chinese', 'demolition-ship')).toBeCloseTo(1.5, 5);
    expect(civUnitHpMultiplier('Japanese', 'fishing-ship')).toBeCloseTo(2, 5);
    expect(civUnitHpMultiplier('Saracens', 'transport-ship')).toBeCloseTo(2, 5);
    expect(civUnitHpMultiplier('Turks', 'hand-cannoneer')).toBeCloseTo(1.25, 5);
    expect(civUnitHpMultiplier('Turks', 'bombard-cannon')).toBeCloseTo(1.25, 5);
    expect(civUnitHpMultiplier('Portuguese', 'galley')).toBeCloseTo(1.1, 5);
    // Originals hold; unmatched civs and units read 1.
    expect(civUnitHpMultiplier('Franks', 'knight')).toBeCloseTo(1.2, 5);
    expect(civUnitHpMultiplier('Turks', 'knight')).toBe(1);
    expect(civUnitHpMultiplier('Portuguese', 'militia')).toBe(1);
  });
});

describe('anti-building bonuses', () => {
  it('adds Saracen cavalry-archer siege alongside the Goth infantry bonus', () => {
    expect(civBuildingAttackBonus('Saracens', 'cavalry-archer')).toBe(4);
    expect(civBuildingAttackBonus('Saracens', 'heavy-cavalry-archer')).toBe(4);
    expect(civBuildingAttackBonus('Goths', 'militia')).toBe(1);
    expect(civBuildingAttackBonus('Saracens', 'knight')).toBe(0);
  });
});

describe('speed bonuses', () => {
  it('moves the named lines faster', () => {
    expect(civSpeedMultiplier('Celts', 'militia')).toBeCloseTo(1.15, 5);
    expect(civSpeedMultiplier('Celts', 'champion')).toBeCloseTo(1.15, 5);
    expect(civSpeedMultiplier('Berbers', 'villager')).toBeCloseTo(1.1, 5);
    expect(civSpeedMultiplier('Berbers', 'galley')).toBeCloseTo(1.1, 5);
    expect(civSpeedMultiplier('Ethiopians', 'archer')).toBeCloseTo(1.15, 5);
    expect(civSpeedMultiplier('Celts', 'archer')).toBe(1);
    expect(civSpeedMultiplier(undefined, 'militia')).toBe(1);
  });
});

describe('cost bonuses', () => {
  it('scales Byzantine trash, Berber stables, and Magyar scouts', () => {
    expect(effectiveTrainingCost('Byzantines', 'feudal-age', 'spearman', NONE))
      .toEqual({ food: 26, wood: 19 });
    expect(effectiveTrainingCost('Berbers', 'castle-age', 'knight', NONE))
      .toEqual({ food: 48, gold: 60 });
    // Not yet in Castle Age: full price at the stable.
    expect(effectiveTrainingCost('Berbers', 'feudal-age', 'knight', NONE))
      .toEqual({ food: 60, gold: 75 });
    expect(effectiveTrainingCost('Magyars', 'feudal-age', 'scout', NONE))
      .toEqual({ food: 68 });
  });

  it('scales by age where the CSV scales by age', () => {
    // Huns cavalry archers: -25% Castle, -30% Imperial.
    expect(effectiveTrainingCost('Huns', 'castle-age', 'cavalry-archer', NONE))
      .toEqual({ wood: 30, gold: 53 });
    expect(effectiveTrainingCost('Huns', 'imperial-age', 'cavalry-archer', NONE))
      .toEqual({ wood: 28, gold: 49 });
    // Mayans archers: -10/-20/-30 by age.
    expect(effectiveTrainingCost('Mayans', 'feudal-age', 'archer', NONE))
      .toEqual({ wood: 23, gold: 41 });
    // 45 × 0.7 is 31.499999999999996 in floats, so the round lands on 31 —
    // deterministic, and the figure the game actually charges.
    expect(effectiveTrainingCost('Mayans', 'imperial-age', 'archer', NONE))
      .toEqual({ wood: 18, gold: 31 });
    // Indians villagers: -10/-15/-20/-25 by age.
    expect(effectiveTrainingCost('Indians', 'dark-age', 'villager', NONE))
      .toEqual({ food: 45 });
    expect(effectiveTrainingCost('Indians', 'imperial-age', 'villager', NONE))
      .toEqual({ food: 38 });
  });

  it('discounts the Portuguese gold component and Viking warships', () => {
    // Portuguese: every unit costs -15% GOLD — the other components hold.
    expect(effectiveTrainingCost('Portuguese', 'castle-age', 'knight', NONE))
      .toEqual({ food: 60, gold: 64 });
    // Vikings: warships -20%; a transport is not a warship.
    expect(effectiveTrainingCost('Vikings', 'feudal-age', 'galley', NONE))
      .toEqual({ wood: 72, gold: 24 });
    expect(effectiveTrainingCost('Vikings', 'feudal-age', 'transport-ship', NONE))
      .toEqual({ wood: 125 });
    // Italians: gunpowder -25%, fishing ships -15 wood flat.
    expect(effectiveTrainingCost('Italians', 'imperial-age', 'hand-cannoneer', NONE))
      .toEqual({ food: 34, gold: 38 });
    expect(effectiveTrainingCost('Italians', 'dark-age', 'fishing-ship', NONE))
      .toEqual({ wood: 60 });
  });

  it('leaves the Goths discount and everyone unmatched exactly as before', () => {
    expect(effectiveTrainingCost('Goths', 'feudal-age', 'militia', NONE))
      .toEqual({ food: 39, gold: 13 });
    expect(effectiveTrainingCost('Britons', 'castle-age', 'knight', NONE))
      .toEqual({ food: 60, gold: 75 });
  });
});

describe('train-time bonuses', () => {
  it('keeps the Aztec military speed-up and nobody else', () => {
    expect(civTrainTimeMultiplier('Aztecs', 'militia')).toBeCloseTo(0.85, 5);
    expect(civTrainTimeMultiplier('Aztecs', 'villager')).toBe(1);
    expect(civTrainTimeMultiplier('Celts', 'militia')).toBe(1);
  });
});

describe('opening bonuses in a real match', () => {
  async function bootAs(civilization: string) {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    return createSimulationBridge(undefined, {
      civilizationsByOwner: new Map([[1, civilization]]),
    });
  }

  it('opens the Chinese with three extra villagers and a lighter stockpile', async () => {
    const bridge = await bootAs('Chinese');
    const villagers = bridge.getEconomyState().units.filter(
      (unit) => unit.owner === 1 && unit.unitType === 'villager',
    );
    expect(villagers).toHaveLength(6);
    expect(bridge.getEconomyState().playerResources[1]).toMatchObject({ food: 0, wood: 150 });
    // Their Town Center shelters ten: base cap 5 becomes 10.
    expect(bridge.getPopulationState(1).cap).toBe(10);
  });

  it('opens the Persians richer and the Huns short of wood', async () => {
    const persians = await bootAs('Persians');
    expect(persians.getEconomyState().playerResources[1]).toMatchObject({ food: 250, wood: 250 });
    const huns = await bootAs('Huns');
    expect(huns.getEconomyState().playerResources[1]).toMatchObject({ wood: 100 });
  });

  it('opens the Incas with the llama', async () => {
    const bridge = await bootAs('Incas');
    const sheep = bridge.getEconomyState().resources.filter(
      (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1,
    );
    // The opening's own flock plus the llama.
    const plain = await bootAs('Britons');
    const plainSheep = plain.getEconomyState().resources.filter(
      (resource) => resource.resourceType === 'sheep' && resource.baseOwner === 1,
    );
    expect(sheep.length).toBe(plainSheep.length + 1);
  });

  it('lets Aztec villagers carry five more', async () => {
    const { civCarryBonus } = await import('../../src/game/simulation/civBonusEffects');
    expect(civCarryBonus('Aztecs', 'berry-bush')).toBe(5);
    expect(civCarryBonus('Aztecs', 'tree')).toBe(5);
    expect(civCarryBonus('Goths', 'boar')).toBe(15);
    expect(civCarryBonus('Goths', 'tree')).toBe(0);
    expect(civCarryBonus('Britons', 'tree')).toBe(0);
  });
});

describe('building bonuses', () => {
  it('prices buildings by civilization at every charge site', async () => {
    const { effectiveConstructionCost } = await import('../../src/game/simulation/civBonusEffects');
    const { constructionCost } = await import('../../src/game/simulation/prototypeEconomyRules');
    const base = constructionCost('castle');
    expect(effectiveConstructionCost('Franks', 'castle'))
      .toEqual({ stone: Math.round((base.stone ?? 0) * 0.75) });
    expect(effectiveConstructionCost('Japanese', 'mill').wood)
      .toBe(Math.round((constructionCost('mill').wood ?? 0) * 0.5));
    expect(effectiveConstructionCost('Teutons', 'farm').wood)
      .toBe(Math.round((constructionCost('farm').wood ?? 0) * 0.67));
    expect(effectiveConstructionCost('Malians', 'barracks').wood)
      .toBe(Math.round((constructionCost('barracks').wood ?? 0) * 0.85));
    expect(effectiveConstructionCost('Incas', 'castle').stone)
      .toBe(Math.round((constructionCost('castle').stone ?? 0) * 0.85));
    // Unmatched civs read the shared base reference untouched.
    expect(effectiveConstructionCost('Britons', 'castle')).toBe(base);
  });

  it('doubles Persian Town Center hit points in a real match', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const persians = createSimulationBridge(undefined, {
      civilizationsByOwner: new Map([[1, 'Persians']]),
    });
    const plain = createSimulationBridge(undefined);
    const hpOf = (bridge: typeof plain) => {
      const townCenter = bridge.getEconomyState().buildings.find(
        (building) => building.owner === 1 && building.buildingType === 'town-center',
      )!;
      return bridge.getEntityHealth(townCenter.id)!.maxHp;
    };
    expect(hpOf(persians)).toBe(hpOf(plain) * 2);
  });

  it('opens the Huns at the full population cap, houseless', async () => {
    const { createSimulationBridge } = await import('../../src/game/simulation/createSimulationBridge');
    const huns = createSimulationBridge(undefined, {
      civilizationsByOwner: new Map([[1, 'Huns']]),
    });
    expect(huns.getPopulationState(1).cap).toBe(200);
    // And a custom pop cap is still the ceiling.
    const capped = createSimulationBridge(undefined, {
      civilizationsByOwner: new Map([[1, 'Huns']]),
      populationCap: 75,
    });
    expect(capped.getPopulationState(1).cap).toBe(75);
  });
});

describe('Ethiopian age-advance grant', () => {
  it('pays +100 food and +100 gold, and only to Ethiopians', () => {
    expect(civAgeAdvanceGrant('Ethiopians')).toEqual({ food: 100, gold: 100 });
    expect(civAgeAdvanceGrant('Britons')).toBeNull();
    expect(civAgeAdvanceGrant(undefined)).toBeNull();
  });

  it('lands in the stockpile the moment the advance completes', () => {
    // outpost-vision-fixture banks 700 food / 200 gold with the Feudal
    // prerequisites standing; the 500-food advance leaves 200/200 for a
    // generic civ and 300/300 for Ethiopians.
    for (const [civ, food, gold] of [
      ['Ethiopians', 300, 300],
      [undefined, 200, 200],
    ] as const) {
      const bridge = createSimulationBridge('outpost-vision-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
      expect(bridge.queueResearch('feudal-age')).toBe(true);
      expect(
        stepBridgeUntil(
          bridge,
          () => bridge.getEconomyState().playerResources[1]!.food === food
            && bridge.getEconomyState().playerResources[1]!.gold === gold,
          { maxSteps: 2600 },
        ),
      ).toBe(true);
    }
  });
});
