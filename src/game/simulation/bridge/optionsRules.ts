// Building option lookups (train/research/market/build menus, read by HUD + AI). Pure over the player's age/civ/researched set; the bridge passes predicates in.

import { buildOptionsFor } from './buildOptions';
import { dockResearchOptions } from './dockTechOptions';
import { uniqueUnitsTrainedAt } from '../uniqueUnits';
import { unlockedTrainingFor } from '../uniqueTechnologyUnlocks';
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
        // A unique technology can open a unit somewhere it is not normally
        // trained — the Goths' Anarchy puts the Huskarl in the Barracks. Read
        // from the same table the research menu uses, so the two cannot drift.
        options.push(...unlockedTrainingFor(
          getPlayerCivilization(owner),
          'barracks',
          (technology) => hasTechnology(owner, technology),
        ));
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
      // M5 naval: the Dock trains ships from the Dark Age. v0.3.20 wired the
      // warship LINES in — until then the ships existed and fought but the menu
      // still only offered the Fishing Ship, so no player could build one.
      case 'dock': {
        const options: TrainableUnitType[] = ['fishing-ship'];
        if (getPlayerAge(owner) === 'dark-age') {
          return options;
        }
        options.push(latestResearchedInChain(owner, [
          'galley',
          ['war-galley', 'war-galley-upgrade'],
          ['galleon', 'galleon-upgrade'],
        ]));
        if (isAtLeastAge(owner, 'castle-age')) {
          options.push(latestResearchedInChain(owner, [
            'fire-ship',
            ['fast-fire-ship', 'fast-fire-ship-upgrade'],
          ]));
          options.push(latestResearchedInChain(owner, [
            'demolition-ship',
            ['heavy-demolition-ship', 'heavy-demolition-ship-upgrade'],
          ]));
          for (const entry of uniqueUnitsTrainedAt(getPlayerCivilization(owner), 'dock')) {
            options.push(entry.elite
              ? latestResearchedInChain(owner, [entry.unitType, entry.elite])
              : entry.unitType);
          }
        }
        // The Cannon Galleon is UNLOCKED by research rather than upgraded into,
        // so it only joins the menu once that technology is done.
        if (hasTechnology(owner, 'cannon-galleon-unlock')) {
          options.push(latestResearchedInChain(owner, [
            'cannon-galleon',
            ['elite-cannon-galleon', 'elite-cannon-galleon-upgrade'],
          ]));
        }
        return options;
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
        // M4: the civ gate lives entirely in uniqueUnits.ts, so a Castle offers
        // exactly the unique units its owner's civilization has — nothing here
        // knows any civilization by name.
        for (const entry of uniqueUnitsTrainedAt(getPlayerCivilization(owner), 'castle')) {
          options.push(entry.elite
            ? latestResearchedInChain(owner, [entry.unitType, entry.elite])
            : entry.unitType);
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

    if (buildingType === 'university') {
      return projectileTechOptions('university', owner, isAtLeastAge, hasTechnology);
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
      if (!hasTechnology(owner, 'siege-ram-upgrade')) {
        options.push('siege-ram-upgrade');
      }
      // Siege Engineers: +1 range to every siege unit. Imperial, drops once researched.
      if (!hasTechnology(owner, 'siege-engineers')) {
        options.push('siege-engineers');
      }
      if (options.length > 0) {
        return options;
      }
    }

    if (buildingType === 'watch-tower') {
      return towerTechResearchOptions(buildingType, owner, isAtLeastAge, hasTechnology);
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
      hasCompletedBuilding,
      hasOwnedWonder,
      hasTechnology,
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
