// What each building can TRAIN, split out of `optionsRules` for the 500-line
// budget. Every entry is a LINE rather than a unit: `latestResearchedInChain`
// walks the upgrade chain and returns the tier the owner has actually
// researched, so the menu shows one entry per line and it is always the right
// tier — which is also why adding a tier to a line (v0.3.45) is one more entry
// in a chain rather than a new menu case.

import type {
  BuildingType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../types';
import type { UpgradeChainEntry } from '../upgradeChains';
import { uniqueUnitsTrainedAt } from '../uniqueUnits';
import { unlockedTrainingFor } from '../uniqueTechnologyUnlocks';

export interface TrainOptionsDeps {
  getPlayerAge: (owner: number) => import('../types').AgeType;
  isAtLeastAge: (owner: number, age: import('../types').AgeType) => boolean;
  hasTechnology: (owner: number, tech: ResearchableTechnologyType) => boolean;
  latestResearchedInChain: (owner: number, chain: UpgradeChainEntry) => TrainableUnitType;
  getPlayerCivilization: (owner: number) => string;
}

export function createTrainOptions(deps: TrainOptionsDeps) {
  const {
    getPlayerAge,
    isAtLeastAge,
    hasTechnology,
    latestResearchedInChain,
    getPlayerCivilization,
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
        // units.csv: the Transport Ship is Feudal, and it is the only way a
        // land army crosses water — so it comes before the warships.
        options.push('transport-ship');
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
        const skirmisherLine = latestResearchedInChain(owner, [
          'skirmisher',
          ['elite-skirmisher', 'elite-skirmisher-upgrade'],
        ]);
        const options: TrainableUnitType[] = [archerLine, skirmisherLine];
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
          ['siege-onager', 'siege-onager-upgrade'],
        ]);
        const scorpionLine = latestResearchedInChain(owner, [
          'scorpion',
          ['heavy-scorpion', 'heavy-scorpion-upgrade'],
        ]);
        const ramLine = latestResearchedInChain(owner, [
          'battering-ram',
          ['capped-ram', 'capped-ram-upgrade'],
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

  return getTrainOptions;
}
