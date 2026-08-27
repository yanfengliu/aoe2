import { describe, expect, it } from 'vitest';

import { createSimulationBridge } from '../../src/game/simulation/createSimulationBridge';
import {
  selectOwnedBuildingDirect,
  stepBridgeUntil,
} from './createSimulationBridge.helpers';
import {
  civAgeAdvanceGrant,
  civFishingShipRateMultiplier,
  civGatherRateMultiplier,
  civImperialPopulationBonus,
  koreanTowerRangeBonus,
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
    expect(civGatherRateMultiplier('Turks', 'gold-mine')).toBeCloseTo(1.25, 5); // DE: +25%.
    expect(civGatherRateMultiplier('Slavs', 'farm')).toBeCloseTo(1.15, 5);
    // The Hindustani fisherman bonus is DE-dead (sourced v0.3.144); the
    // Malian gold drop-off rides the same seam.
    expect(civGatherRateMultiplier('Indians', 'fish')).toBe(1);
    expect(civGatherRateMultiplier('Malians', 'gold-mine')).toBeCloseTo(1.1, 5);
    expect(civGatherRateMultiplier('Franks', 'berry-bush')).toBeCloseTo(1.15, 5); // DE: foragers +15%.
    // The originals hold, and a civ without the bonus reads 1.
    expect(civGatherRateMultiplier('Britons', 'sheep')).toBeCloseTo(1.25, 5);
    expect(civGatherRateMultiplier('Celts', 'gold-mine')).toBe(1);
    expect(civGatherRateMultiplier('Vikings', 'tree')).toBe(1);
  });
});

describe('unit-HP bonuses', () => {
  it('multiplies the named lines', () => {
    expect(civUnitHpMultiplier('Chinese', 'demolition-ship')).toBe(1); // DE-dead.
    expect(civUnitHpMultiplier('Saracens', 'camel')).toBeCloseTo(1.25, 5); // DE: camels +25%.
    expect(civUnitHpMultiplier('Japanese', 'fishing-ship')).toBeCloseTo(2, 5);
    expect(civUnitHpMultiplier('Saracens', 'transport-ship')).toBeCloseTo(2, 5);
    expect(civUnitHpMultiplier('Turks', 'hand-cannoneer')).toBeCloseTo(1.25, 5);
    expect(civUnitHpMultiplier('Turks', 'bombard-cannon')).toBeCloseTo(1.25, 5);
    // Portuguese ship HP rides the age ladder now (v0.3.148).
    expect(civUnitHpMultiplier('Portuguese', 'galley')).toBe(1);
    // Franks mounted HP rides the Feudal-gated ladder now (v0.3.148).
    expect(civUnitHpMultiplier('Franks', 'knight')).toBe(1);
    expect(civUnitHpMultiplier('Turks', 'knight')).toBe(1);
    expect(civUnitHpMultiplier('Portuguese', 'militia')).toBe(1);
  });
});

describe('anti-building bonuses', () => {
  it('drops the DE-dead Saracen cavalry-archer siege; the Goth infantry bonus stays', () => {
    expect(civBuildingAttackBonus('Saracens', 'cavalry-archer')).toBe(0);
    expect(civBuildingAttackBonus('Saracens', 'heavy-cavalry-archer')).toBe(0);
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
    // The Ethiopian archer bonus is ATTACK speed in DE, not movement — the
    // move-speed reading was a transcription error (sourced v0.3.144).
    expect(civSpeedMultiplier('Ethiopians', 'archer')).toBe(1);
    expect(civSpeedMultiplier('Slavs', 'monk')).toBeCloseTo(1.2, 5); // DE: monks +20%.
    expect(civSpeedMultiplier('Celts', 'archer')).toBe(1);
    expect(civSpeedMultiplier(undefined, 'militia')).toBe(1);
  });
});

describe('cost bonuses', () => {
  it('scales Byzantine trash, Berber stables, and Magyar scouts', () => {
    expect(effectiveTrainingCost('Byzantines', 'feudal-age', 'spearman', NONE))
      .toEqual({ food: 26, wood: 19 });
    // Berbers (sourced v0.3.144): stable units -15% in Castle Age.
    expect(effectiveTrainingCost('Berbers', 'castle-age', 'knight', NONE))
      .toEqual({ food: 51, gold: 64 });
    // Incas (sourced v0.3.145): military units cost -15/20/25/30% FOOD only.
    expect(effectiveTrainingCost('Incas', 'castle-age', 'militia', NONE))
      .toEqual({ food: 45, gold: 20 });
    expect(effectiveTrainingCost('Incas', 'imperial-age', 'militia', NONE))
      .toEqual({ food: 42, gold: 20 });
    expect(effectiveTrainingCost('Incas', 'castle-age', 'villager', NONE))
      .toEqual({ food: 50 });
    // Not yet in Castle Age: full price at the stable.
    expect(effectiveTrainingCost('Berbers', 'feudal-age', 'knight', NONE))
      .toEqual({ food: 60, gold: 75 });
    expect(effectiveTrainingCost('Magyars', 'feudal-age', 'scout', NONE))
      .toEqual({ food: 68 });
  });

  it('scales by age where the CSV scales by age', () => {
    // Huns cavalry archers (sourced v0.3.144): -10% Castle, -20% Imperial.
    expect(effectiveTrainingCost('Huns', 'castle-age', 'cavalry-archer', NONE))
      .toEqual({ wood: 36, gold: 63 });
    expect(effectiveTrainingCost('Huns', 'imperial-age', 'cavalry-archer', NONE))
      .toEqual({ wood: 32, gold: 56 });
    // Mayans archers: -10/-20/-30 by age.
    expect(effectiveTrainingCost('Mayans', 'feudal-age', 'archer', NONE))
      .toEqual({ wood: 23, gold: 41 });
    // 45 × 0.7 is 31.499999999999996 in floats, so the round lands on 31 —
    // deterministic, and the figure the game actually charges.
    expect(effectiveTrainingCost('Mayans', 'imperial-age', 'archer', NONE))
      .toEqual({ wood: 18, gold: 31 });
    // Hindustani villagers (sourced v0.3.144): -8/13/18/23% by age.
    expect(effectiveTrainingCost('Indians', 'dark-age', 'villager', NONE))
      .toEqual({ food: 46 });
    expect(effectiveTrainingCost('Indians', 'imperial-age', 'villager', NONE))
      .toEqual({ food: 39 });
  });

  it('discounts the Portuguese gold component and Viking warships', () => {
    // Portuguese (sourced v0.3.144): every unit costs -20% GOLD.
    expect(effectiveTrainingCost('Portuguese', 'castle-age', 'knight', NONE))
      .toEqual({ food: 60, gold: 60 });
    // Vikings (sourced v0.3.144): warships -10/15/20% by age.
    expect(effectiveTrainingCost('Vikings', 'feudal-age', 'galley', NONE))
      .toEqual({ wood: 81, gold: 27 });
    expect(effectiveTrainingCost('Vikings', 'imperial-age', 'galley', NONE))
      .toEqual({ wood: 72, gold: 24 });
    expect(effectiveTrainingCost('Vikings', 'feudal-age', 'transport-ship', NONE))
      .toEqual({ wood: 125 });
    // Italians (sourced v0.3.144): gunpowder -20%, fishing ships -15 wood.
    expect(effectiveTrainingCost('Italians', 'imperial-age', 'hand-cannoneer', NONE))
      .toEqual({ food: 36, gold: 40 });
    expect(effectiveTrainingCost('Italians', 'dark-age', 'fishing-ship', NONE))
      .toEqual({ wood: 60 });
  });

  it('leaves the Goths discount and everyone unmatched exactly as before', () => {
    // Goths (sourced v0.3.146): -15/20/25/30% by age, Dark included.
    expect(effectiveTrainingCost('Goths', 'dark-age', 'militia', NONE))
      .toEqual({ food: 51, gold: 17 });
    expect(effectiveTrainingCost('Goths', 'feudal-age', 'militia', NONE))
      .toEqual({ food: 48, gold: 16 });
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
    // DE: Town Centers provide +15 population space — base cap 5 becomes 20.
    expect(bridge.getPopulationState(1).cap).toBe(20);
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

  it('lets Aztec villagers carry three more (sourced v0.3.144)', async () => {
    const { civCarryBonus } = await import('../../src/game/simulation/civBonusEffects');
    expect(civCarryBonus('Aztecs', 'berry-bush')).toBe(3);
    expect(civCarryBonus('Aztecs', 'tree')).toBe(3);
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
      .toBe(Math.round((constructionCost('farm').wood ?? 0) * 0.6)); // DE: -40%.
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

describe('Goth Imperial population limit', () => {
  it('adds 10 to the hard cap, only in Imperial, only for Goths', () => {
    expect(civImperialPopulationBonus('Goths', 'imperial-age')).toBe(10);
    expect(civImperialPopulationBonus('Goths', 'castle-age')).toBe(0);
    expect(civImperialPopulationBonus('Britons', 'imperial-age')).toBe(0);
    expect(civImperialPopulationBonus(undefined, 'imperial-age')).toBe(0);
  });

  it('moves the live cap from 200 to 210 the moment Imperial lands', () => {
    // The fixture banks 210 raw supply (TC + 41 houses), so the clamp is the
    // hard cap itself and the bonus is visible.
    const bridge = createSimulationBridge('civ-goths-pop-fixture', {
      civilizationsByOwner: new Map([[1, 'Goths']]),
    });
    expect(bridge.getPopulationState(1).rawSupply).toBe(210);
    expect(bridge.getPopulationState(1).cap).toBe(200);
    expect(selectOwnedBuildingDirect(bridge, 1, 'town-center')).toBe(true);
    expect(bridge.queueResearch('imperial-age')).toBe(true);
    expect(
      stepBridgeUntil(bridge, () => bridge.getPopulationState(1).cap === 210, {
        maxSteps: 4000,
      }),
    ).toBe(true);
  });

  it('a generic civ stays clamped at 200 with the same supply', () => {
    const bridge = createSimulationBridge('civ-goths-pop-fixture');
    expect(bridge.getPopulationState(1).rawSupply).toBe(210);
    expect(bridge.getPopulationState(1).cap).toBe(200);
  });
});

describe('Korean tower range by age', () => {
  it('reads +1 in Castle and +2 in Imperial, watch towers only', () => {
    expect(koreanTowerRangeBonus('Koreans', 'watch-tower', 'castle-age')).toBe(1);
    expect(koreanTowerRangeBonus('Koreans', 'watch-tower', 'imperial-age')).toBe(2);
    expect(koreanTowerRangeBonus('Koreans', 'watch-tower', 'feudal-age')).toBe(0);
    expect(koreanTowerRangeBonus('Koreans', 'bombard-tower', 'imperial-age')).toBe(0);
    expect(koreanTowerRangeBonus('Britons', 'watch-tower', 'imperial-age')).toBe(0);
  });

  it('a Castle-Age Korean tower reaches a militia one past base range; a generic one never fires', () => {
    // Enemy at manhattan 8 from the tower — base range 7, Korean Castle 8.
    // No University stands, so the free Korean Guard Tower cannot fire and
    // muddy the range with its own ladder.
    const hp = (bridge: ReturnType<typeof createSimulationBridge>): number => {
      const enemy = bridge
        .getEconomyState()
        .units.find((u) => u.owner === 2 && u.unitType === 'militia')!;
      return bridge.getEntityHealth(enemy.id)?.currentHp ?? -1;
    };
    const koreans = createSimulationBridge('civ-koreans-tower-fixture', {
      civilizationsByOwner: new Map([[1, 'Koreans']]),
    });
    expect(
      stepBridgeUntil(koreans, () => hp(koreans) < 35, { maxSteps: 400 }),
    ).toBe(true);

    const generic = createSimulationBridge('civ-koreans-tower-fixture');
    for (let index = 0; index < 400; index += 1) generic.step(100);
    expect(hp(generic)).toBe(35);
  });
});

describe('Japanese Fishing Ship work rate', () => {
  it('climbs 1.05 / 1.1 / 1.15 / 1.2 across the ages, Fishing Ships only', () => {
    expect(civFishingShipRateMultiplier('Japanese', 'fishing-ship', 'dark-age')).toBeCloseTo(1.05, 5);
    expect(civFishingShipRateMultiplier('Japanese', 'fishing-ship', 'feudal-age')).toBeCloseTo(1.1, 5);
    expect(civFishingShipRateMultiplier('Japanese', 'fishing-ship', 'castle-age')).toBeCloseTo(1.15, 5);
    expect(civFishingShipRateMultiplier('Japanese', 'fishing-ship', 'imperial-age')).toBeCloseTo(1.2, 5);
    // A villager shore-fishing is not a Fishing Ship; other civs read 1.
    expect(civFishingShipRateMultiplier('Japanese', 'villager', 'imperial-age')).toBe(1);
    expect(civFishingShipRateMultiplier('Britons', 'fishing-ship', 'imperial-age')).toBe(1);
  });

  it('a Japanese fishing ship makes its first deposit sooner than a generic one', () => {
    // Identical fixture, identical route — the only difference between the
    // two runs is the gather segment, where the Japanese ship works +5%.
    const ticksToFirstDeposit = (civ?: string): number => {
      const bridge = createSimulationBridge('naval-fixture', {
        ...(civ ? { civilizationsByOwner: new Map([[1, civ]]) } : {}),
      });
      expect(selectOwnedBuildingDirect(bridge, 1, 'dock')).toBe(true);
      expect(bridge.queueTrainUnit('fishing-ship')).toBe(true);
      const ship = (): { id: number; x: number; y: number } | undefined => bridge
        .getEconomyState()
        .units.find((u) => u.owner === 1 && u.unitType === 'fishing-ship');
      expect(
        stepBridgeUntil(bridge, () => ship() !== undefined, { maxSteps: 600 }),
      ).toBe(true);
      expect(bridge.selectEntityAtCell(ship()!.x, ship()!.y)).toBe(true);
      const fish = bridge
        .getEconomyState()
        .resources.find((r) => r.resourceType === 'fish')!;
      expect(bridge.issueContextCommand(fish.x, fish.y)).toBe(true);
      const start = bridge.getEconomyState().playerResources[1]!.food;
      for (let tick = 1; tick <= 5000; tick += 1) {
        bridge.step(100);
        if (bridge.getEconomyState().playerResources[1]!.food > start) return tick;
      }
      throw new Error('no deposit within 5000 ticks');
    };
    const generic = ticksToFirstDeposit();
    const japanese = ticksToFirstDeposit('Japanese');
    expect(japanese).toBeLessThan(generic);
  }, 120_000);
});

describe('round-six bonuses (sourced v0.3.149)', () => {
  it('Spanish builders work 30% faster, composing with Treadmill Crane', async () => {
    const { buildRateMultiplier } = await import('../../src/game/simulation/buildingTechEffects');
    expect(buildRateMultiplier(NONE, 'Spanish')).toBeCloseTo(1.3, 5);
    expect(buildRateMultiplier(new Set(['treadmill-crane']), 'Spanish')).toBeCloseTo(1.56, 5);
    expect(buildRateMultiplier(NONE, 'Britons')).toBe(1);
  });

  it('a completed Spanish research pays +20 gold into the stockpile', () => {
    const spanish = createSimulationBridge('feudal-blacksmith-fixture', {
      civilizationsByOwner: new Map([[1, 'Spanish'], [2, 'Spanish']]),
    });
    const goldBefore = spanish.getEconomyState().playerResources[1]!.gold;
    expect(selectOwnedBuildingDirect(spanish, 1, 'blacksmith')).toBe(true);
    expect(spanish.queueResearch('fletching')).toBe(true);
    expect(stepBridgeUntil(
      spanish,
      // Blacksmith upgrades cost the Spanish no gold, so the ONLY gold
      // movement is the +20 completion grant.
      () => spanish.getEconomyState().playerResources[1]!.gold === goldBefore + 20,
      { maxSteps: 600 },
    )).toBe(true);
  }, 30_000);

  it('the Inca villager-armor clause starts in the Castle Age', async () => {
    const { civVillagersTakeInfantryArmor } = await import('../../src/game/simulation/civBonusEffects');
    expect(civVillagersTakeInfantryArmor('Incas', 'feudal-age')).toBe(false);
    expect(civVillagersTakeInfantryArmor('Incas', 'castle-age')).toBe(true);
    expect(civVillagersTakeInfantryArmor('Britons', 'imperial-age')).toBe(false);
  });
});
