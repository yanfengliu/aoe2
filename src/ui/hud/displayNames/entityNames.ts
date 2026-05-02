// Entity-name + plural-name + selection-name + isUnitType — every
// SelectionState['selectedEntityType'] case mapped to display string.
//
// Co-located because the singular and plural switches need to stay in
// lockstep (every new entity type ships in both); separating them would
// invite drift.

import type { SelectionState, UnitType } from '../../../game/simulation/types';

// Human-readable name for the entity selected in the HUD. The fallback
// returns the raw kebab-cased id so unknown future entity types stay
// legible until they're added here.
export function formatEntityName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) {
    return 'No selection';
  }

  switch (entityType) {
    case 'town-center':
      return 'Town Center';
    case 'house':
      return 'House';
    case 'mill':
      return 'Mill';
    case 'lumber-camp':
      return 'Lumber Camp';
    case 'mining-camp':
      return 'Mining Camp';
    case 'barracks':
      return 'Barracks';
    case 'watch-tower':
      return 'Watch Tower';
    case 'stable':
      return 'Stable';
    case 'archery-range':
      return 'Archery Range';
    case 'blacksmith':
      return 'Blacksmith';
    case 'market':
      return 'Market';
    case 'berry-bush':
      return 'Berry Bush';
    case 'gold-mine':
      return 'Gold Mine';
    case 'stone-mine':
      return 'Stone Mine';
    case 'boar':
      return 'Boar';
    case 'fish':
      return 'Fish';
    case 'sheep':
      return 'Sheep';
    case 'wolf':
      return 'Wolf';
    case 'tree':
      return 'Tree';
    case 'villager':
      return 'Villager';
    case 'militia':
      return 'Militia';
    case 'spearman':
      return 'Spearman';
    case 'archer':
      return 'Archer';
    case 'skirmisher':
      return 'Skirmisher';
    case 'knight':
      return 'Knight';
    case 'scout':
      return 'Scout Cavalry';
    case 'crossbowman':
      return 'Crossbowman';
    case 'pikeman':
      return 'Pikeman';
    case 'light-cavalry':
      return 'Light Cavalry';
    case 'camel':
      return 'Camel';
    case 'cavalry-archer':
      return 'Cavalry Archer';
    case 'mangonel':
      return 'Mangonel';
    case 'scorpion':
      return 'Scorpion';
    case 'battering-ram':
      return 'Battering Ram';
    case 'siege-workshop':
      return 'Siege Workshop';
    case 'monastery':
      return 'Monastery';
    case 'monk':
      return 'Monk';
    case 'relic':
      return 'Relic';
    case 'castle':
      return 'Castle';
    case 'wonder':
      return 'Wonder';
    case 'longbowman':
      return 'Longbowman';
    case 'arbalest':
      return 'Arbalest';
    case 'halberdier':
      return 'Halberdier';
    case 'hussar':
      return 'Hussar';
    case 'heavy-cavalry-archer':
      return 'Heavy Cavalry Archer';
    case 'cavalier':
      return 'Cavalier';
    case 'champion':
      return 'Champion';
    case 'elite-longbowman':
      return 'Elite Longbowman';
    case 'onager':
      return 'Onager';
    case 'heavy-scorpion':
      return 'Heavy Scorpion';
    case 'siege-ram':
      return 'Siege Ram';
    case 'bombard-cannon':
      return 'Bombard Cannon';
    case 'trebuchet':
      return 'Trebuchet';
    case 'man-at-arms':
      return 'Man-at-Arms';
    case 'long-swordsman':
      return 'Long Swordsman';
    case 'two-handed-swordsman':
      return 'Two-Handed Swordsman';
    case 'paladin':
      return 'Paladin';
    case 'heavy-camel':
      return 'Heavy Camel';
    case 'stone-wall':
      return 'Stone Wall';
    case 'palisade-wall':
      return 'Palisade Wall';
    default:
      return entityType;
  }
}

export function formatEntityPluralName(entityType: SelectionState['selectedEntityType']): string {
  if (!entityType) {
    return 'Units';
  }

  switch (entityType) {
    case 'town-center':
      return 'Town Centers';
    case 'house':
      return 'Houses';
    case 'mill':
      return 'Mills';
    case 'lumber-camp':
      return 'Lumber Camps';
    case 'mining-camp':
      return 'Mining Camps';
    case 'barracks':
      return 'Barracks';
    case 'watch-tower':
      return 'Watch Towers';
    case 'stable':
      return 'Stables';
    case 'archery-range':
      return 'Archery Ranges';
    case 'blacksmith':
      return 'Blacksmiths';
    case 'market':
      return 'Markets';
    case 'berry-bush':
      return 'Berry Bushes';
    case 'gold-mine':
      return 'Gold Mines';
    case 'stone-mine':
      return 'Stone Mines';
    case 'boar':
      return 'Boars';
    case 'fish':
      return 'Fish';
    case 'sheep':
      return 'Sheep';
    case 'wolf':
      return 'Wolves';
    case 'tree':
      return 'Trees';
    case 'villager':
      return 'Villagers';
    case 'militia':
      return 'Militia';
    case 'spearman':
      return 'Spearmen';
    case 'archer':
      return 'Archers';
    case 'skirmisher':
      return 'Skirmishers';
    case 'knight':
      return 'Knights';
    case 'scout':
      return 'Scout Cavalry';
    case 'crossbowman':
      return 'Crossbowmen';
    case 'pikeman':
      return 'Pikemen';
    case 'light-cavalry':
      return 'Light Cavalry';
    case 'camel':
      return 'Camels';
    case 'cavalry-archer':
      return 'Cavalry Archers';
    case 'mangonel':
      return 'Mangonels';
    case 'scorpion':
      return 'Scorpions';
    case 'battering-ram':
      return 'Battering Rams';
    case 'siege-workshop':
      return 'Siege Workshops';
    case 'monastery':
      return 'Monasteries';
    case 'monk':
      return 'Monks';
    case 'relic':
      return 'Relics';
    case 'castle':
      return 'Castles';
    case 'wonder':
      return 'Wonders';
    case 'longbowman':
      return 'Longbowmen';
    case 'arbalest':
      return 'Arbalests';
    case 'halberdier':
      return 'Halberdiers';
    case 'hussar':
      return 'Hussars';
    case 'heavy-cavalry-archer':
      return 'Heavy Cavalry Archers';
    case 'cavalier':
      return 'Cavaliers';
    case 'champion':
      return 'Champions';
    case 'elite-longbowman':
      return 'Elite Longbowmen';
    case 'onager':
      return 'Onagers';
    case 'heavy-scorpion':
      return 'Heavy Scorpions';
    case 'siege-ram':
      return 'Siege Rams';
    case 'bombard-cannon':
      return 'Bombard Cannons';
    case 'trebuchet':
      return 'Trebuchets';
    case 'man-at-arms':
      return 'Men-at-Arms';
    case 'long-swordsman':
      return 'Long Swordsmen';
    case 'two-handed-swordsman':
      return 'Two-Handed Swordsmen';
    case 'paladin':
      return 'Paladins';
    case 'heavy-camel':
      return 'Heavy Camels';
    case 'stone-wall':
      return 'Stone Walls';
    case 'palisade-wall':
      return 'Palisade Walls';
    default:
      return `${entityType}s`;
  }
}

export function formatSelectionName(selectionState: SelectionState): string {
  if (selectionState.selectedCount <= 1) {
    return formatEntityName(selectionState.selectedEntityType);
  }

  const label =
    selectionState.selectedEntityType === null
      ? 'Units'
      : formatEntityPluralName(selectionState.selectedEntityType);
  return `${selectionState.selectedCount} ${label} Selected`;
}

export function isUnitType(entityType: SelectionState['selectedEntityType']): entityType is UnitType {
  return (
    entityType === 'villager'
    || entityType === 'scout'
    || entityType === 'militia'
    || entityType === 'spearman'
    || entityType === 'archer'
    || entityType === 'skirmisher'
    || entityType === 'knight'
    || entityType === 'crossbowman'
    || entityType === 'pikeman'
    || entityType === 'light-cavalry'
    || entityType === 'camel'
    || entityType === 'cavalry-archer'
    || entityType === 'mangonel'
    || entityType === 'scorpion'
    || entityType === 'battering-ram'
    || entityType === 'monk'
    || entityType === 'longbowman'
    || entityType === 'arbalest'
    || entityType === 'halberdier'
    || entityType === 'hussar'
    || entityType === 'heavy-cavalry-archer'
    || entityType === 'cavalier'
    || entityType === 'champion'
    || entityType === 'elite-longbowman'
    || entityType === 'onager'
    || entityType === 'heavy-scorpion'
    || entityType === 'siege-ram'
    || entityType === 'bombard-cannon'
    || entityType === 'trebuchet'
    || entityType === 'man-at-arms'
    || entityType === 'long-swordsman'
    || entityType === 'two-handed-swordsman'
    || entityType === 'paladin'
    || entityType === 'heavy-camel'
  );
}
