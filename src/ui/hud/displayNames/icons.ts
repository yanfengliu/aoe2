// Unit + entity icon glyphs and accent colors. Co-located because the
// glyph and accent maps need to stay synchronized — when a new unit
// type is added, both maps gain a case.

import type { SelectionState, UnitType } from '../../../game/simulation/types';
import { isUnitType } from './entityNames';

export function formatUnitIcon(unitType: UnitType): string {
  switch (unitType) {
    case 'villager':
      return 'V';
    case 'scout':
      return 'SC';
    case 'militia':
      return 'M';
    case 'spearman':
      return 'SP';
    case 'archer':
      return 'A';
    case 'skirmisher':
      return 'SK';
    case 'knight':
      return 'K';
    case 'crossbowman':
      return 'CB';
    case 'pikeman':
      return 'PK';
    case 'light-cavalry':
      return 'LC';
    case 'camel':
      return 'Cm';
    case 'cavalry-archer':
      return 'CA';
    case 'mangonel':
      return 'Mg';
    case 'scorpion':
      return 'Sc';
    case 'battering-ram':
      return 'Rm';
    case 'monk':
      return 'Mn';
    case 'longbowman':
      return 'LB';
    case 'arbalest':
      return 'Ab';
    case 'halberdier':
      return 'Hb';
    case 'hussar':
      return 'Hs';
    case 'heavy-cavalry-archer':
      return 'HC';
    case 'cavalier':
      return 'Cv';
    case 'champion':
      return 'Ch';
    case 'elite-longbowman':
      return 'EL';
    case 'onager':
      return 'On';
    case 'heavy-scorpion':
      return 'HS';
    case 'siege-ram':
      return 'SR';
    case 'bombard-cannon':
      return 'BC';
    case 'trebuchet':
      return 'Tr';
    case 'man-at-arms':
      return 'MA';
    case 'long-swordsman':
      return 'LS';
    case 'two-handed-swordsman':
      return 'TH';
    case 'paladin':
      return 'Pl';
    case 'heavy-camel':
      return 'HCm';
  }
}

export function formatUnitIconAccent(unitType: UnitType): string {
  switch (unitType) {
    case 'villager':
      return '#8fc6a3';
    case 'scout':
      return '#c9a160';
    case 'militia':
      return '#d07a66';
    case 'spearman':
      return '#d2b16a';
    case 'archer':
      return '#7fb3d5';
    case 'skirmisher':
      return '#7ec7c0';
    case 'knight':
      return '#c4b0dc';
    case 'crossbowman':
      return '#6ba0cc';
    case 'pikeman':
      return '#a7c98a';
    case 'light-cavalry':
      return '#d7b87c';
    case 'camel':
      return '#d8c18a';
    case 'cavalry-archer':
      return '#8ca6c8';
    case 'mangonel':
      return '#a0805a';
    case 'scorpion':
      return '#b09862';
    case 'battering-ram':
      return '#8f6a4a';
    case 'monk':
      return '#e3d9b5';
    case 'longbowman':
      return '#6fa070';
    case 'arbalest':
      return '#4f8cc2';
    case 'halberdier':
      return '#8cba6f';
    case 'hussar':
      return '#c09960';
    case 'heavy-cavalry-archer':
      return '#7188b0';
    case 'cavalier':
      return '#ae9fcc';
    case 'champion':
      return '#cf8b52';
    case 'elite-longbowman':
      return '#4f8652';
    case 'onager':
      return '#7a5d3f';
    case 'heavy-scorpion':
      return '#957848';
    case 'siege-ram':
      return '#6e4e33';
    case 'bombard-cannon':
      return '#3a3a42';
    case 'trebuchet':
      return '#6a4f2e';
    case 'man-at-arms':
      return '#c78a5e';
    case 'long-swordsman':
      return '#b87548';
    case 'two-handed-swordsman':
      return '#b66b48';
    case 'paladin':
      return '#b8a78c';
    case 'heavy-camel':
      return '#ccb37d';
  }
}

export function formatEntityIcon(entityType: SelectionState['selectedEntityType']): string {
  switch (entityType) {
    case 'town-center':
      return 'TC';
    case 'house':
      return 'H';
    case 'mill':
      return 'ML';
    case 'lumber-camp':
      return 'LC';
    case 'mining-camp':
      return 'MC';
    case 'barracks':
      return 'BA';
    case 'watch-tower':
      return 'WT';
    case 'stable':
      return 'ST';
    case 'archery-range':
      return 'AR';
    case 'blacksmith':
      return 'BS';
    case 'market':
      return 'MK';
    case 'siege-workshop':
      return 'SW';
    case 'monastery':
      return 'My';
    case 'castle':
      return 'Ct';
    case 'wonder':
      return 'Wn';
    case 'stone-wall':
      return 'Wl';
    case 'palisade-wall':
      return 'Pl';
    case 'relic':
      return 'Rl';
    case 'berry-bush':
      return 'BB';
    case 'gold-mine':
      return 'G';
    case 'stone-mine':
      return 'S';
    case 'boar':
      return 'BO';
    case 'fish':
      return 'F';
    case 'sheep':
      return 'SH';
    case 'wolf':
      return 'WO';
    case 'tree':
      return 'T';
    default:
      return entityType ? formatUnitIcon(entityType) : '?';
  }
}

export function formatEntityIconAccent(entityType: SelectionState['selectedEntityType']): string {
  switch (entityType) {
    case 'town-center':
      return '#cfb56f';
    case 'house':
      return '#c39355';
    case 'mill':
      return '#b79a5f';
    case 'lumber-camp':
      return '#7ca46a';
    case 'mining-camp':
      return '#9daabd';
    case 'barracks':
      return '#b78363';
    case 'watch-tower':
      return '#b6a7be';
    case 'stable':
      return '#bf9463';
    case 'archery-range':
      return '#a6866f';
    case 'blacksmith':
      return '#8f98aa';
    case 'market':
      return '#c4a166';
    case 'siege-workshop':
      return '#98856a';
    case 'monastery':
      return '#cfc3a8';
    case 'castle':
      return '#a09f9c';
    case 'wonder':
      return '#e6c36a';
    case 'stone-wall':
      return '#9aa0a8';
    case 'palisade-wall':
      return '#a88555';
    case 'relic':
      return '#f5d680';
    case 'berry-bush':
      return '#a16a89';
    case 'gold-mine':
      return '#d7c46a';
    case 'stone-mine':
      return '#b8c0cf';
    case 'boar':
      return '#bf7d68';
    case 'fish':
      return '#73b9d6';
    case 'sheep':
      return '#d9e0e5';
    case 'wolf':
      return '#9ca6b2';
    case 'tree':
      return '#7fb07a';
    default:
      return entityType && isUnitType(entityType)
        ? formatUnitIconAccent(entityType)
        : '#c4ae7a';
  }
}
