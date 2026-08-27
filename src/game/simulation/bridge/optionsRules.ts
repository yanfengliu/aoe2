// Building option lookups (train/research/market/build menus, read by HUD + AI). Pure over the player's age/civ/researched set; the bridge passes predicates in.

import { buildOptionsFor } from './buildOptions';
import { dockResearchOptions } from './dockTechOptions';
import { createTrainOptions } from './trainOptions';
import { uniqueUnitsTrainedAt } from '../uniqueUnits';
import { castleResearchOptions } from './castleTechOptions';
import type {
  BuildableBuildingType,
  BuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
  UnitType,
} from '../types';
import type { UpgradeChainEntry } from '../upgradeChains';
import { economyTechResearchOptions } from './economyTechOptions';
import { towerTechResearchOptions } from '../towerTechOptions';
import { monasteryTechResearchOptions } from '../monasteryTechOptions';
import {
  barracksLosResearchOptions,
  townCenterLosResearchOptions,
  townCenterLosVisibleOptions,
} from './losTechOptions';
import { blacksmithResearchOptions } from './blacksmithTechOptions';
import { projectileTechOptions } from './projectileTechOptions';

export interface OptionsRulesDeps {
  /** Nomad (§5.4): true while this owner may place their FIRST TC in any age. */
  nomadFirstTownCenter: (owner: number) => boolean;
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
    nomadFirstTownCenter,
  } = deps;

  const getTrainOptions = createTrainOptions({
    getPlayerAge,
    isAtLeastAge,
    hasTechnology,
    latestResearchedInChain,
    getPlayerCivilization,
  });

  /** The elite upgrades this civilization may research at this building. */
  function eliteUpgradeOptions(
    civilization: string,
    trainedAt: 'castle' | 'dock',
    hasTechnology: (owner: number, tech: ResearchableTechnologyType) => boolean,
    owner: number,
  ): ResearchableTechnologyType[] {
    return uniqueUnitsTrainedAt(civilization, trainedAt)
      .filter((entry) => entry.elite && !hasTechnology(owner, entry.elite[1]))
      .map((entry) => entry.elite![1]);
  }

  function getResearchOptions(
    owner: number,
    buildingType: BuildingType,
  ): ResearchableTechnologyType[] {
    if (buildingType === 'town-center') {
      const options: ResearchableTechnologyType[] = [];
      // canAdvance* are mutually exclusive, so at most one age-up is offered.
      if (canAdvanceToFeudalAge(owner)) {
        options.push('feudal-age');
      }
      if (canAdvanceToCastleAge(owner)) {
        options.push('castle-age');
      }
      if (canAdvanceToImperialAge(owner)) {
        options.push('imperial-age');
      }
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'wheelbarrow')) { // Carry techs: Wheelbarrow Feudal, Hand Cart Castle.
        options.push('wheelbarrow');
      }
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'hand-cart')) {
        options.push('hand-cart');
      }
      options.push(...townCenterLosResearchOptions(owner, isAtLeastAge, hasTechnology));
      // Loom: Dark Age onward, no prereq; appended last so age-up + carry stay first.
      if (!hasTechnology(owner, 'loom')) {
        options.push('loom');
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'blacksmith') {
      const options = blacksmithResearchOptions(owner, getPlayerAge, isAtLeastAge, hasTechnology);
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'archery-range' && isAtLeastAge(owner, 'castle-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'crossbowman-upgrade')) {
        options.push('crossbowman-upgrade');
      }
      // The Skirmisher line's only upgrade. units.csv puts the Elite Skirmisher
      // in the Castle Age (spec §1 ranks the unit row above technologies.csv's
      // Imperial, since a technology cannot be later than the unit it unlocks),
      // so it is offered alongside the Crossbowman. Without this the line never
      // improved: v0.3.45 added the unit and its upgrade to every table but no
      // card ever offered the research.
      if (!hasTechnology(owner, 'elite-skirmisher-upgrade')) {
        options.push('elite-skirmisher-upgrade');
      }
      options.push(...projectileTechOptions('archery-range', owner, isAtLeastAge, hasTechnology));
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
        // Squires: +10% infantry speed. Castle Barracks tech; drops once researched.
        if (!hasTechnology(owner, 'squires')) {
          options.push('squires');
        }
      }
      // Tracking (+2 infantry LoS): Feudal onward (this branch is non-Dark).
      options.push(...barracksLosResearchOptions(owner, hasTechnology));
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
        // technologies.csv: Imperial, Barracks, applies to the Eagle Warrior.
        if (!hasTechnology(owner, 'elite-eagle-warrior-upgrade')) {
          options.push('elite-eagle-warrior-upgrade');
        }
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'stable' && isAtLeastAge(owner, 'feudal-age')) {
      const options: ResearchableTechnologyType[] = [];
      // Bloodlines: +20 HP to MOUNTED units. FEUDAL Stable tech per technologies.csv:78 (v0.1.67 conformance fix); drops once researched.
      if (!hasTechnology(owner, 'bloodlines')) {
        options.push('bloodlines');
      }
      if (isAtLeastAge(owner, 'castle-age')) {
        if (!hasTechnology(owner, 'light-cavalry-upgrade')) {
          options.push('light-cavalry-upgrade');
        }
        // Husbandry: +10% mounted speed (cavalry + cav archers). Castle Stable tech; drops once researched.
        if (!hasTechnology(owner, 'husbandry')) {
          options.push('husbandry');
        }
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

    if (buildingType === 'dock') {
      const options = dockResearchOptions(owner, isAtLeastAge, hasTechnology);
      if (isAtLeastAge(owner, 'imperial-age')) {
        options.push(...eliteUpgradeOptions(getPlayerCivilization(owner), 'dock', hasTechnology, owner));
      }
      return options;
    }

    if (buildingType === 'market') {
      const options: ResearchableTechnologyType[] = [];
      // Cartography: see what your allies see (technologies.csv, Feudal).
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'cartography')) {
        options.push('cartography');
      }
      // The tribute fee, 30% → 20% → 0: Coinage in Feudal, Banking in Castle
      // once Coinage is in — the CSV prices Banking's step FROM Coinage's.
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'coinage')) {
        options.push('coinage');
      }
      if (
        isAtLeastAge(owner, 'castle-age')
        && hasTechnology(owner, 'coinage')
        && !hasTechnology(owner, 'banking')
      ) {
        options.push('banking');
      }
      // Caravan: Trade Carts move 50% faster (Castle).
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'caravan')) {
        options.push('caravan');
      }
      // Guilds: the Market takes a smaller cut of every buy and sell.
      if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'guilds')) {
        options.push('guilds');
      }
      return options;
    }

    if (buildingType === 'university') {
      // v0.3.131: the tower upgrades AND Siege Engineers research here, as
      // technologies.csv places them (both had been parked elsewhere under a
      // "University does not exist yet" claim the absence audit retired).
      const universityOptions = [
        ...projectileTechOptions('university', owner, isAtLeastAge, hasTechnology),
        ...towerTechResearchOptions(buildingType, owner, isAtLeastAge, hasTechnology),
      ];
      if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'siege-engineers')) {
        universityOptions.push('siege-engineers');
      }
      // Chemistry (v0.3.133): Imperial University research, as the CSV says.
      if (isAtLeastAge(owner, 'imperial-age') && !hasTechnology(owner, 'chemistry')) {
        universityOptions.push('chemistry');
      }
      return universityOptions;
    }

    if (buildingType === 'castle' && isAtLeastAge(owner, 'castle-age')) {
      return castleResearchOptions({
        owner,
        civilization: getPlayerCivilization(owner),
        isAtLeastAge,
        hasTechnology,
        eliteUpgradeOptions: () => eliteUpgradeOptions(
          getPlayerCivilization(owner), 'castle', hasTechnology, owner,
        ),
      });
    }

    if (buildingType === 'siege-workshop' && isAtLeastAge(owner, 'imperial-age')) {
      const options: ResearchableTechnologyType[] = [];
      if (!hasTechnology(owner, 'onager-upgrade')) {
        options.push('onager-upgrade');
      }
      if (!hasTechnology(owner, 'heavy-scorpion-upgrade')) {
        options.push('heavy-scorpion-upgrade');
      }
      // The ram line is three tiers, so the Siege upgrade only appears once the
      // Capped one is in — otherwise the player is offered an upgrade whose
      // input unit they cannot have.
      if (!hasTechnology(owner, 'capped-ram-upgrade')) {
        options.push('capped-ram-upgrade');
      } else if (!hasTechnology(owner, 'siege-ram-upgrade')) {
        options.push('siege-ram-upgrade');
      }
      if (hasTechnology(owner, 'onager-upgrade') && !hasTechnology(owner, 'siege-onager-upgrade')) {
        options.push('siege-onager-upgrade');
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'monastery') {
      return monasteryTechResearchOptions(buildingType, owner, isAtLeastAge, hasTechnology);
    }

    return economyTechResearchOptions(buildingType, owner, isAtLeastAge, hasTechnology);
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
      if (isAtLeastAge(owner, 'feudal-age') && !hasTechnology(owner, 'wheelbarrow')) { // Carry techs shown from their age onward.
        options.push('wheelbarrow');
      }
      if (isAtLeastAge(owner, 'castle-age') && !hasTechnology(owner, 'hand-cart')) {
        options.push('hand-cart');
      }
      options.push(...townCenterLosVisibleOptions(owner, isAtLeastAge, hasTechnology));
      // Loom is visible from the Dark Age onward (no prereq) until researched.
      if (!hasTechnology(owner, 'loom')) {
        options.push('loom');
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
    return buildOptionsFor(
      owner,
      unitType,
      getPlayerAge,
      // Khmer: "...or unlock other buildings" — every building-standing
      // prerequisite reads satisfied; the age gates inside stay in force.
      getPlayerCivilization(owner) === 'Khmer'
        ? () => true
        : hasCompletedBuilding,
      hasOwnedWonder,
      hasTechnology,
      // Nomad: the FIRST Town Center builds in any age (computed by the
      // bridge, which owns the match settings and the building index).
      nomadFirstTownCenter(owner),
    );
  }

  return {
    getTrainOptions,
    getResearchOptions,
    getVisibleResearchOptions,
    getMarketOptions,
    getBuildOptions,
  };
}
