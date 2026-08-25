import { describe, expect, it } from 'vitest';

import { HUMAN_PLAYER_ID } from '../../src/game/simulation/prototypeScenario';
import {
  AGE_ADVANCE_REQUIRED_COUNT,
  agePrerequisiteBuildingTypes,
  buildingArrowCount,
  buildingBuildTimeTicks,
  buildingPopulationProvided,
  buildingsThatResearch,
  canGarrisonAt,
  canResearchAt,
  canTrainAt,
  isAgeUpTechnology,
} from '../../src/game/simulation/prototypeBuildingRules';
import {
  canAfford,
  constructionCost,
  describeMissingResources,
  gatherAmountFor,
  gatherTicksFor,
  isBuyMarketAction,
  marketCommodityForAction,
  researchCost,
  researchTimeTicks,
  resourceKindToEconomyResource,
  resourceTint,
  resourcesMissing,
  spendResources,
  trainingCost,
  trainingTimeTicks,
} from '../../src/game/simulation/prototypeEconomyRules';
import {
  attackBonusAgainstBuilding,
  attackBonusAgainstUnit,
  createWildlifeState,
  isArcherLineUnit,
  isStaticMemorableResourceType,
  unitAttackRange,
  unitMinAttackRange,
  unitTint,
  unitVisionRadius,
} from '../../src/game/simulation/prototypeUnitRules';

describe('prototype economy rules', () => {
  it('keeps market commodity and buy or sell mappings explicit', () => {
    expect(marketCommodityForAction('sell-stone')).toBe('stone');
    expect(isBuyMarketAction('buy-food')).toBe(true);
    expect(isBuyMarketAction('sell-food')).toBe(false);
  });

  it('maps resources and gather rates to the existing economy values', () => {
    expect(resourceKindToEconomyResource('gold-mine')).toBe('gold');
    expect(resourceKindToEconomyResource('wolf')).toBeNull();
    expect(gatherTicksFor('tree')).toBe(5);
    expect(gatherAmountFor('boar')).toBe(2);
  });

  it('keeps non-harvestable resources on the monk or wildlife paths', () => {
    expect(() => gatherTicksFor('wolf')).toThrow('Wolves are not harvestable resources.');
    expect(() => gatherAmountFor('relic')).toThrow(
      'Relics are not harvestable resources; use the Monk pickup flow.',
    );
  });

  it('keeps sheep tinting owner-aware', () => {
    expect(resourceTint('sheep', HUMAN_PLAYER_ID)).toBe(0x8fb8ff);
    expect(resourceTint('sheep', HUMAN_PLAYER_ID + 1)).toBe(0xd39191);
    expect(resourceTint('sheep', null)).toBe(0xe7ece6);
  });

  it('keeps core training, research, and construction values stable', () => {
    expect(trainingCost('bombard-cannon')).toEqual({ wood: 225, gold: 225 });
    expect(trainingTimeTicks('trebuchet')).toBe(500);
    expect(researchCost('chemistry')).toEqual({ food: 300, gold: 200 });
    expect(researchTimeTicks('imperial-age')).toBe(1900);
    expect(constructionCost('wonder')).toEqual({
      food: 1000,
      wood: 1000,
      gold: 1000,
      stone: 1000,
    });
  });

  it('preserves affordability helpers as a single source of truth', () => {
    const resources = { food: 60, wood: 50, gold: 40, stone: 0 };
    const cost = { food: 50, gold: 20 };

    expect(canAfford(resources, cost)).toBe(true);
    expect(resourcesMissing(resources, { food: 80 })).toBe('food');

    spendResources(resources, cost);
    expect(resources).toEqual({ food: 10, wood: 50, gold: 20, stone: 0 });
  });

  it('describes missing resources with need vs have (agent-affordances A2)', () => {
    const resources = { food: 320, wood: 10, gold: 0, stone: 0 };
    expect(describeMissingResources(resources, { food: 500 })).toBe('need 500 food (have 320)');
    expect(describeMissingResources(resources, { food: 500, wood: 175 })).toBe(
      'need 500 food (have 320), need 175 wood (have 10)',
    );
    expect(describeMissingResources(resources, { food: 100 })).toBeNull();
  });
});

describe('prototype building rules', () => {
  it('keeps existing build, population, and train or research eligibility rules', () => {
    expect(buildingPopulationProvided('house')).toBe(5);
    expect(buildingBuildTimeTicks('castle')).toBe(560);
    expect(canTrainAt('castle', 'trebuchet')).toBe(true);
    expect(canTrainAt('town-center', 'trebuchet')).toBe(false);
    expect(canResearchAt('blacksmith', 'chemistry')).toBe(true);
    expect(canResearchAt('stable', 'chemistry')).toBe(false);
  });

  it('exposes reverse research lookup + age-up prerequisite tables (agent-affordances A1)', () => {
    expect(buildingsThatResearch('feudal-age')).toEqual(['town-center']);
    expect(buildingsThatResearch('chemistry')).toEqual(['blacksmith']);
    expect(agePrerequisiteBuildingTypes('feudal-age')).toEqual([
      'mill',
      'lumber-camp',
      'mining-camp',
      'barracks',
    ]);
    expect(agePrerequisiteBuildingTypes('castle-age')).toContain('blacksmith');
    expect(AGE_ADVANCE_REQUIRED_COUNT).toBe(2);
    expect(isAgeUpTechnology('feudal-age')).toBe(true);
    expect(isAgeUpTechnology('fletching')).toBe(false);
  });

  it('preserves garrison and arrow-count behavior', () => {
    expect(canGarrisonAt('castle', 'elite-longbowman')).toBe(true);
    expect(canGarrisonAt('castle', 'crossbowman')).toBe(true);
    // v0.3.84 widened garrison eligibility to the AoE2 DE rules: foot
    // soldiers fit towers and Town Centers; mounted units only fit a Castle;
    // siege and ships fit nothing.
    expect(canGarrisonAt('watch-tower', 'elite-longbowman')).toBe(true);
    expect(canGarrisonAt('watch-tower', 'militia')).toBe(true);
    expect(canGarrisonAt('town-center', 'monk')).toBe(true);
    expect(canGarrisonAt('watch-tower', 'knight')).toBe(false);
    expect(canGarrisonAt('castle', 'knight')).toBe(true);
    expect(canGarrisonAt('castle', 'battering-ram')).toBe(false);
    expect(canGarrisonAt('watch-tower', 'trade-cart')).toBe(false);
    // Spec §10.8: an empty completed Town Center fires its base arrow (1),
    // like the Castle; garrisoned units add one each up to 4.
    expect(buildingArrowCount('town-center', 0, 0)).toBe(1);
    expect(buildingArrowCount('town-center', 3, 0)).toBe(4);
    expect(buildingArrowCount('castle', 8, 3)).toBe(4);
  });
});

describe('prototype unit rules', () => {
  it('keeps key combat and vision values stable', () => {
    expect(unitAttackRange('trebuchet')).toBe(16);
    expect(unitMinAttackRange('bombard-cannon')).toBe(5);
    expect(unitVisionRadius('hussar')).toBe(11);
    expect(attackBonusAgainstUnit('halberdier', 'paladin')).toBe(32);
    expect(attackBonusAgainstBuilding('bombard-cannon')).toBe(200);
  });

  it('keeps wildlife and static-resource classification behavior stable', () => {
    expect(isArcherLineUnit('arbalest')).toBe(true);
    expect(isStaticMemorableResourceType('tree')).toBe(true);
    expect(isStaticMemorableResourceType('fish')).toBe(false);
    expect(createWildlifeState('wolf')).toMatchObject({
      autoAggro: true,
      corpsePersists: false,
      aggroRange: 5,
      currentHp: 25,
      maxHp: 25,
    });
  });

  it('keeps unit tint ownership-sensitive', () => {
    expect(unitTint('villager', HUMAN_PLAYER_ID)).toBe(0xf3e2b7);
    expect(unitTint('villager', HUMAN_PLAYER_ID + 1)).toBe(0xf0b8b8);
  });
});
