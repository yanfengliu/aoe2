import type {
  ActionType,
  AgeType,
  MarketActionType,
  ProductionQueueEntry,
  ResearchableTechnologyType,
  SelectionState,
  UnitType,
} from '../../game/simulation/types';

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
    // FU2: militia-line intermediates + Paladin + Heavy Camel.
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
    // FU3: real wall buildings.
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
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
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
    // FU3: real wall buildings.
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
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
    || entityType === 'man-at-arms'
    || entityType === 'long-swordsman'
    || entityType === 'two-handed-swordsman'
    || entityType === 'paladin'
    || entityType === 'heavy-camel'
  );
}

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
    // Slice 7A Imperial icons.
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
    // FU2: short icons that don't collide with Slice 7A codes. `HC` is
    // already taken by Heavy Cavalry Archer, so Heavy Camel uses `HCm`.
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
    // Slice 7A Imperial accents — one step deeper than the predecessor so
    // the Imperial unit reads as the same family on the HUD.
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
    // FU2: accent colors sit between their predecessor and successor.
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

export function formatTechnologyName(technologyType: ResearchableTechnologyType): string {
  switch (technologyType) {
    case 'feudal-age':
      return 'Feudal Age';
    case 'castle-age':
      return 'Castle Age';
    case 'imperial-age':
      return 'Imperial Age';
    case 'fletching':
      return 'Fletching';
    case 'crossbowman-upgrade':
      return 'Crossbowman';
    case 'pikeman-upgrade':
      return 'Pikeman';
    case 'light-cavalry-upgrade':
      return 'Light Cavalry';
    case 'arbalest-upgrade':
      return 'Arbalest';
    case 'halberdier-upgrade':
      return 'Halberdier';
    case 'hussar-upgrade':
      return 'Hussar';
    case 'heavy-cavalry-archer-upgrade':
      return 'Heavy Cavalry Archer';
    case 'cavalier-upgrade':
      return 'Cavalier';
    case 'champion-upgrade':
      return 'Champion';
    case 'elite-longbowman-upgrade':
      return 'Elite Longbowman';
    case 'onager-upgrade':
      return 'Onager';
    case 'heavy-scorpion-upgrade':
      return 'Heavy Scorpion';
    case 'siege-ram-upgrade':
      return 'Siege Ram';
    case 'bracer':
      return 'Bracer';
    case 'blast-furnace':
      return 'Blast Furnace';
    case 'plate-mail-armor':
      return 'Plate Mail Armor';
    case 'plate-barding':
      return 'Plate Barding';
    // FU1: Feudal / Castle / Imperial Blacksmith tier names.
    case 'forging':
      return 'Forging';
    case 'scale-mail-armor':
      return 'Scale Mail Armor';
    case 'scale-barding-armor':
      return 'Scale Barding Armor';
    case 'padded-archer-armor':
      return 'Padded Archer Armor';
    case 'iron-casting':
      return 'Iron Casting';
    case 'chain-mail-armor':
      return 'Chain Mail Armor';
    case 'chain-barding-armor':
      return 'Chain Barding Armor';
    case 'leather-archer-armor':
      return 'Leather Archer Armor';
    case 'bodkin-arrow':
      return 'Bodkin Arrow';
    case 'ring-archer-armor':
      return 'Ring Archer Armor';
    case 'chemistry':
      return 'Chemistry';
    // FU2: militia-line intermediate tiers + Paladin + Heavy Camel.
    case 'man-at-arms-upgrade':
      return 'Man-at-Arms';
    case 'long-swordsman-upgrade':
      return 'Long Swordsman';
    case 'two-handed-swordsman-upgrade':
      return 'Two-Handed Swordsman';
    case 'paladin-upgrade':
      return 'Paladin';
    case 'heavy-camel-upgrade':
      return 'Heavy Camel';
  }
}

export function formatActionName(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Ungarrison';
  }
}

export function formatMarketActionName(actionType: MarketActionType): string {
  switch (actionType) {
    case 'buy-food':
      return 'Buy Food';
    case 'sell-food':
      return 'Sell Food';
    case 'buy-wood':
      return 'Buy Wood';
    case 'sell-wood':
      return 'Sell Wood';
    case 'buy-stone':
      return 'Buy Stone';
    case 'sell-stone':
      return 'Sell Stone';
  }
}

export function formatQueueEntryName(entry: ProductionQueueEntry): string {
  if (entry.kind === 'unit' && entry.unitType) {
    return `Training: ${formatEntityName(entry.unitType)}`;
  }

  if (entry.kind === 'technology' && entry.technologyType) {
    return `Researching: ${formatTechnologyName(entry.technologyType)}`;
  }

  return entry.label;
}

export function formatQueueProgress(progressPercent: number): string {
  return `${progressPercent}% complete`;
}

export function formatAgeName(age: AgeType): string {
  switch (age) {
    case 'dark-age':
      return 'Dark Age';
    case 'feudal-age':
      return 'Feudal Age';
    case 'castle-age':
      return 'Castle Age';
    case 'imperial-age':
      return 'Imperial Age';
  }
}

export function formatMatchTime(tick: number, ticksPerSecond: number): string {
  if (ticksPerSecond <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.floor(tick / ticksPerSecond));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Slice 8: MM:SS countdown format shared by the Wonder and Relic chip.
// Mirrors formatMatchTime but expects a ticks-remaining value, not a
// cumulative tick count.
export function formatCountdownTicks(ticks: number, ticksPerSecond: number): string {
  if (ticksPerSecond <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.ceil(ticks / ticksPerSecond));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
