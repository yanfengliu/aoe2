// Building option lookups: train / research / market / build menus that the
// HUD and the AI both read. These are pure functions over the player's age,
// civ, and researched-tech set — the bridge owns those side maps and passes
// them in as collaborator predicates.

import type {
  BuildableBuildingType,
  BuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from '../types';
import type { UpgradeChainEntry } from '../upgradeChains';

export interface OptionsRulesDeps {
  latestResearchedInChain: (owner: number, chain: UpgradeChainEntry) => TrainableUnitType;
  hasTechnology: (owner: number, tech: ResearchableTechnologyType) => boolean;
  getPlayerAge: (owner: number) => 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age';
  isAtLeastAge: (
    owner: number,
    minAge: 'dark-age' | 'feudal-age' | 'castle-age' | 'imperial-age',
  ) => boolean;
  getPlayerCivilization: (owner: number) => string;
  canAdvanceToFeudalAge: (owner: number) => boolean;
  canAdvanceToCastleAge: (owner: number) => boolean;
  canAdvanceToImperialAge: (owner: number) => boolean;
  hasCompletedBuilding: (owner: number, buildingType: BuildingType) => boolean;
  hasOwnedWonder: (owner: number) => boolean;
}

export interface OptionsRulesOps {
  getTrainOptions(owner: number, buildingType: BuildingType): TrainableUnitType[];
  getResearchOptions(owner: number, buildingType: BuildingType): ResearchableTechnologyType[];
  getVisibleResearchOptions(
    owner: number,
    buildingType: BuildingType,
  ): ResearchableTechnologyType[];
  getMarketOptions(owner: number, buildingType: BuildingType): MarketActionType[];
  getBuildOptions(owner: number, unitType: UnitType): BuildableBuildingType[];
}

export function createOptionsRules(deps: OptionsRulesDeps): OptionsRulesOps {
  const {
    latestResearchedInChain,
    hasTechnology,
    getPlayerAge,
    isAtLeastAge,
    getPlayerCivilization,
    canAdvanceToFeudalAge,
    canAdvanceToCastleAge,
    canAdvanceToImperialAge,
    hasCompletedBuilding,
    hasOwnedWonder,
  } = deps;

  function getTrainOptions(owner: number, buildingType: BuildingType): TrainableUnitType[] {
    switch (buildingType) {
      case 'town-center':
        return ['villager'];
      case 'barracks': {
        const militiaLine = latestResearchedInChain(owner, [
          'militia',
          ['man-at-arms', 'man-at-arms-upgrade'],
          ['long-swordsman', 'long-swordsman-upgrade'],
          ['two-handed-swordsman', 'two-handed-swordsman-upgrade'],
          ['champion', 'champion-upgrade'],
        ]);
        const options: TrainableUnitType[] = [militiaLine];
        if (getPlayerAge(owner) !== 'dark-age') {
          const spearmanLine = latestResearchedInChain(owner, [
            'spearman',
            ['pikeman', 'pikeman-upgrade'],
            ['halberdier', 'halberdier-upgrade'],
          ]);
          options.push(spearmanLine);
        }
        return options;
      }
      case 'stable': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        const scoutLine = latestResearchedInChain(owner, [
          'scout',
          ['light-cavalry', 'light-cavalry-upgrade'],
          ['hussar', 'hussar-upgrade'],
        ]);
        if (isAtLeastAge(owner, 'castle-age')) {
          const knightLine = latestResearchedInChain(owner, [
            'knight',
            ['cavalier', 'cavalier-upgrade'],
            ['paladin', 'paladin-upgrade'],
          ]);
          const camelLine = latestResearchedInChain(owner, [
            'camel',
            ['heavy-camel', 'heavy-camel-upgrade'],
          ]);
          return [scoutLine, knightLine, camelLine];
        }
        return [scoutLine];
      }
      case 'archery-range': {
        if (getPlayerAge(owner) === 'dark-age') {
          return [];
        }
        const archerLine = latestResearchedInChain(owner, [
          'archer',
          ['crossbowman', 'crossbowman-upgrade'],
          ['arbalest', 'arbalest-upgrade'],
        ]);
        const options: TrainableUnitType[] = [archerLine, 'skirmisher'];
        if (isAtLeastAge(owner, 'castle-age')) {
          const cavArcherLine = latestResearchedInChain(owner, [
            'cavalry-archer',
            ['heavy-cavalry-archer', 'heavy-cavalry-archer-upgrade'],
          ]);
          options.push(cavArcherLine);
        }
        return options;
      }
      case 'siege-workshop': {
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        const mangonelLine = latestResearchedInChain(owner, [
          'mangonel',
          ['onager', 'onager-upgrade'],
        ]);
        const scorpionLine = latestResearchedInChain(owner, [
          'scorpion',
          ['heavy-scorpion', 'heavy-scorpion-upgrade'],
        ]);
        const ramLine = latestResearchedInChain(owner, [
          'battering-ram',
          ['siege-ram', 'siege-ram-upgrade'],
        ]);
        const options: TrainableUnitType[] = [mangonelLine, scorpionLine, ramLine];
        if (isAtLeastAge(owner, 'imperial-age') && hasTechnology(owner, 'chemistry')) {
          options.push('bombard-cannon');
        }
        return options;
      }
      case 'monastery': {
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        return ['monk'];
      }
      case 'castle': {
        if (!isAtLeastAge(owner, 'castle-age')) {
          return [];
        }
        const options: TrainableUnitType[] = [];
        if (getPlayerCivilization(owner) === 'Britons') {
          options.push(
            latestResearchedInChain(owner, [
              'longbowman',
              ['elite-longbowman', 'elite-longbowman-upgrade'],
            ]),
          );
        }
        if (isAtLeastAge(owner, 'imperial-age')) {
          options.push('trebuchet');
        }
        return options;
      }
      default:
        return [];
    }
  }

  function getResearchOptions(
    owner: number,
    buildingType: BuildingType,
  ): ResearchableTechnologyType[] {
    if (buildingType === 'town-center') {
      const options: ResearchableTechnologyType[] = [];
      // The canAdvance* predicates are mutually exclusive, so at most one
      // age-up is offered; carry techs are offered alongside it.
      if (canAdvanceToFeudalAge(owner)) {
        options.push('feudal-age');
      }
      if (canAdvanceToCastleAge(owner)) {
        options.push('castle-age');
      }
      if (canAdvanceToImperialAge(owner)) {
        options.push('imperial-age');
      }
      // Economy carry-capacity techs (Wheelbarrow Feudal, Hand Cart Castle).
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'wheelbarrow')) {
        options.push('wheelbarrow');
      }
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'hand-cart')) {
        options.push('hand-cart');
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'blacksmith' && getPlayerAge(owner) !== 'dark-age') {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'fletching')) {
        options.push('fletching');
      }
      if (!hasTechnology(owner, 'forging')) {
        options.push('forging');
      }
      if (!hasTechnology(owner, 'scale-mail-armor')) {
        options.push('scale-mail-armor');
      }
      if (!hasTechnology(owner, 'scale-barding-armor')) {
        options.push('scale-barding-armor');
      }
      if (!hasTechnology(owner, 'padded-archer-armor')) {
        options.push('padded-archer-armor');
      }
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'iron-casting')) {
          options.push('iron-casting');
        }
        if (!hasTechnology(owner, 'chain-mail-armor')) {
          options.push('chain-mail-armor');
        }
        if (!hasTechnology(owner, 'chain-barding-armor')) {
          options.push('chain-barding-armor');
        }
        if (!hasTechnology(owner, 'leather-archer-armor')) {
          options.push('leather-archer-armor');
        }
        if (!hasTechnology(owner, 'bodkin-arrow')) {
          options.push('bodkin-arrow');
        }
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'bracer')) {
          options.push('bracer');
        }
        if (!hasTechnology(owner, 'blast-furnace')) {
          options.push('blast-furnace');
        }
        if (!hasTechnology(owner, 'plate-mail-armor')) {
          options.push('plate-mail-armor');
        }
        if (!hasTechnology(owner, 'plate-barding')) {
          options.push('plate-barding');
        }
        if (!hasTechnology(owner, 'ring-archer-armor')) {
          options.push('ring-archer-armor');
        }
        if (!hasTechnology(owner, 'chemistry')) {
          options.push('chemistry');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'archery-range' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'crossbowman-upgrade')) {
        options.push('crossbowman-upgrade');
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'arbalest-upgrade')) {
          options.push('arbalest-upgrade');
        }
        if (!hasTechnology(owner, 'heavy-cavalry-archer-upgrade')) {
          options.push('heavy-cavalry-archer-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'barracks' && getPlayerAge(owner) !== 'dark-age') {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'man-at-arms-upgrade')) {
        options.push('man-at-arms-upgrade');
      }
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'pikeman-upgrade')) {
          options.push('pikeman-upgrade');
        }
        if (!hasTechnology(owner, 'long-swordsman-upgrade')) {
          options.push('long-swordsman-upgrade');
        }
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'halberdier-upgrade')) {
          options.push('halberdier-upgrade');
        }
        if (!hasTechnology(owner, 'two-handed-swordsman-upgrade')) {
          options.push('two-handed-swordsman-upgrade');
        }
        if (!hasTechnology(owner, 'champion-upgrade')) {
          options.push('champion-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'stable' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'light-cavalry-upgrade')) {
        options.push('light-cavalry-upgrade');
      }
      if (isAtLeastAge(owner, 'imperial-age')) {
        if (!hasTechnology(owner, 'hussar-upgrade')) {
          options.push('hussar-upgrade');
        }
        if (!hasTechnology(owner, 'cavalier-upgrade')) {
          options.push('cavalier-upgrade');
        }
        if (
          hasTechnology(owner, 'cavalier-upgrade')
          && !hasTechnology(owner, 'paladin-upgrade')
        ) {
          options.push('paladin-upgrade');
        }
        if (!hasTechnology(owner, 'heavy-camel-upgrade')) {
          options.push('heavy-camel-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (
      buildingType === 'castle'
      && isAtLeastAge(owner, 'imperial-age')
      && getPlayerCivilization(owner) === 'Britons'
      && !hasTechnology(owner, 'elite-longbowman-upgrade')
    ) {
      return ['elite-longbowman-upgrade'];
    }

    if (buildingType === 'siege-workshop' && isAtLeastAge(owner, 'imperial-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'onager-upgrade')) {
        options.push('onager-upgrade');
      }
      if (!hasTechnology(owner, 'heavy-scorpion-upgrade')) {
        options.push('heavy-scorpion-upgrade');
      }
      if (!hasTechnology(owner, 'siege-ram-upgrade')) {
        options.push('siege-ram-upgrade');
      }
      if (options.length > 0) {
        return options;
      }
    }

    // Economy gather-rate techs. Lumber Camp (wood) from Feudal; Bow Saw +
    // Two-Man Saw add in Castle / Imperial. Each is offered once and drops out
    // of the list once researched.
    if (buildingType === 'lumber-camp' && isAtLeastAge(owner, 'feudal-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'double-bit-axe')) {
        options.push('double-bit-axe');
      }
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'bow-saw')) {
        options.push('bow-saw');
      }
      if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'two-man-saw')) {
        options.push('two-man-saw');
      }
      if (options.length > 0) {
        return options;
      }
    }

    // Mining Camp (gold + stone) from Feudal; the Shaft upgrades add in Castle.
    // Per the dataset (technologies.csv) these stack but carry no base-tech
    // prerequisite, so — like the Lumber Camp — age is the only gate. (AoE2's
    // linear prerequisite chains would need a prereq column in the dataset; a
    // deferred fidelity refinement, see the thread REVIEW.)
    if (buildingType === 'mining-camp' && isAtLeastAge(owner, 'feudal-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'gold-mining')) {
        options.push('gold-mining');
      }
      if (!hasTechnology(owner, 'stone-mining')) {
        options.push('stone-mining');
      }
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'gold-shaft-mining')) {
          options.push('gold-shaft-mining');
        }
        if (!hasTechnology(owner, 'stone-shaft-mining')) {
          options.push('stone-shaft-mining');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    return [];
  }

  function getVisibleResearchOptions(
    owner: number,
    buildingType: BuildingType,
  ): ResearchableTechnologyType[] {
    if (buildingType === 'town-center') {
      const age = getPlayerAge(owner);
      const options: ResearchableTechnologyType[] = [];
      if (age === 'dark-age') {
        options.push('feudal-age');
      } else if (age === 'feudal-age') {
        options.push('castle-age');
      } else if (age === 'castle-age') {
        options.push('imperial-age');
      }
      // Carry techs are shown from their age onward (until researched), so the
      // agent/HUD can see them alongside the next age-up.
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'wheelbarrow')) {
        options.push('wheelbarrow');
      }
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'hand-cart')) {
        options.push('hand-cart');
      }
      return options;
    }

    return getResearchOptions(owner, buildingType);
  }

  function getMarketOptions(owner: number, buildingType: BuildingType): MarketActionType[] {
    if (buildingType !== 'market' || getPlayerAge(owner) === 'dark-age') {
      return [];
    }

    return [
      'buy-food',
      'sell-food',
      'buy-wood',
      'sell-wood',
      'buy-stone',
      'sell-stone',
    ];
  }

  function getBuildOptions(owner: number, unitType: UnitType): BuildableBuildingType[] {
    if (unitType !== 'villager') {
      return [];
    }

    const options: BuildableBuildingType[] = [
      'house',
      'mill',
      'lumber-camp',
      'mining-camp',
      'barracks',
    ];

    if (getPlayerAge(owner) !== 'dark-age' && hasCompletedBuilding(owner, 'barracks')) {
      options.push('stable');
      options.push('archery-range');
      options.push('blacksmith');
      options.push('market');
      options.push('watch-tower');
      options.push('palisade-wall');
    }

    if (getPlayerAge(owner) === 'castle-age' || getPlayerAge(owner) === 'imperial-age') {
      options.push('town-center');
      options.push('siege-workshop');
      options.push('monastery');
      options.push('castle');
      options.push('stone-wall');
    }

    if (getPlayerAge(owner) === 'imperial-age' && !hasOwnedWonder(owner)) {
      options.push('wonder');
    }

    return options;
  }

  return {
    getTrainOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    getMarketOptions,
    getBuildOptions,
  };
}
