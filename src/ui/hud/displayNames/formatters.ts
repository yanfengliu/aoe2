// Tech / action / queue / age / time formatters. Smaller/varied
// formatters that don't share the unit/entity dispatch surface.

import type {
  ActionType,
  AgeType,
  MarketActionType,
  ProductionQueueEntry,
  ResearchableTechnologyType,
} from '../../../game/simulation/types';
import { formatEntityName } from './entityNames';

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
    case 'garland-wars':
      return 'Garland Wars';
    case 'yeomen':
      return 'Yeomen';
    case 'logistica':
      return 'Logistica';
    case 'furor-celtica':
      return 'Furor Celtica';
    case 'rocketry':
      return 'Rocketry';
    case 'bearded-axe':
      return 'Bearded Axe';
    case 'anarchy':
      return 'Anarchy';
    case 'perfusion':
      return 'Perfusion';
    case 'kataparuto':
      return 'Kataparuto';
    case 'shinkichon':
      return 'Shinkichon';
    case 'drill':
      return 'Drill';
    case 'mahouts':
      return 'Mahouts';
    case 'zealotry':
      return 'Zealotry';
    case 'supremacy':
      return 'Supremacy';
    case 'crenellations':
      return 'Crenellations';
    case 'artillery':
      return 'Artillery';
    case 'masonry':
      return 'Masonry';
    case 'architecture':
      return 'Architecture';
    case 'treadmill-crane':
      return 'Treadmill Crane';
    case 'heated-shot':
      return 'Heated Shot';
    case 'elite-jaguar-warrior-upgrade':
      return 'Elite Jaguar Warrior';
    case 'elite-cataphract-upgrade':
      return 'Elite Cataphract';
    case 'elite-woad-raider-upgrade':
      return 'Elite Woad Raider';
    case 'elite-chu-ko-nu-upgrade':
      return 'Elite Chu Ko Nu';
    case 'elite-throwing-axeman-upgrade':
      return 'Elite Throwing Axeman';
    case 'elite-huskarl-upgrade':
      return 'Elite Huskarl';
    case 'elite-tarkan-upgrade':
      return 'Elite Tarkan';
    case 'elite-samurai-upgrade':
      return 'Elite Samurai';
    case 'elite-war-wagon-upgrade':
      return 'Elite War Wagon';
    case 'elite-plumed-archer-upgrade':
      return 'Elite Plumed Archer';
    case 'elite-mangudai-upgrade':
      return 'Elite Mangudai';
    case 'elite-war-elephant-upgrade':
      return 'Elite War Elephant';
    case 'elite-mameluke-upgrade':
      return 'Elite Mameluke';
    case 'elite-conquistador-upgrade':
      return 'Elite Conquistador';
    case 'elite-teutonic-knight-upgrade':
      return 'Elite Teutonic Knight';
    case 'elite-janissary-upgrade':
      return 'Elite Janissary';
    case 'elite-berserk-upgrade':
      return 'Elite Berserk';
    case 'elite-turtle-ship-upgrade':
      return 'Elite Turtle Ship';
    case 'elite-longboat-upgrade':
      return 'Elite Longboat';
    case 'war-galley-upgrade':
      return 'War Galley';
    case 'galleon-upgrade':
      return 'Galleon';
    case 'fast-fire-ship-upgrade':
      return 'Fast Fire Ship';
    case 'heavy-demolition-ship-upgrade':
      return 'Heavy Demolition Ship';
    case 'cannon-galleon-unlock':
      return 'Cannon Galleon';
    case 'elite-cannon-galleon-upgrade':
      return 'Elite Cannon Galleon';
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
    case 'siege-engineers':
      return 'Siege Engineers';
    case 'sappers':
      return 'Sappers';
    case 'bloodlines':
      return 'Bloodlines';
    case 'husbandry':
      return 'Husbandry';
    case 'squires':
      return 'Squires';
    case 'herbal-medicine':
      return 'Herbal Medicine';
    case 'heresy':
      return 'Heresy';
    case 'town-watch':
      return 'Town Watch';
    case 'town-patrol':
      return 'Town Patrol';
    case 'tracking':
      return 'Tracking';
    case 'conscription':
      return 'Conscription';
    case 'ballistics':
      return 'Ballistics';
    case 'thumb-ring':
      return 'Thumb Ring';
    case 'bracer':
      return 'Bracer';
    case 'blast-furnace':
      return 'Blast Furnace';
    case 'plate-mail-armor':
      return 'Plate Mail Armor';
    case 'plate-barding':
      return 'Plate Barding';
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
    case 'double-bit-axe':
      return 'Double-Bit Axe';
    case 'bow-saw':
      return 'Bow Saw';
    case 'two-man-saw':
      return 'Two-Man Saw';
    case 'gold-mining':
      return 'Gold Mining';
    case 'gold-shaft-mining':
      return 'Gold Shaft Mining';
    case 'stone-mining':
      return 'Stone Mining';
    case 'stone-shaft-mining':
      return 'Stone Shaft Mining';
    case 'wheelbarrow':
      return 'Wheelbarrow';
    case 'hand-cart':
      return 'Hand Cart';
    case 'loom':
      return 'Loom';
    case 'horse-collar':
      return 'Horse Collar';
    case 'heavy-plow':
      return 'Heavy Plow';
    case 'crop-rotation':
      return 'Crop Rotation';
    case 'guard-tower':
      return 'Guard Tower';
    case 'keep':
      return 'Keep';
    case 'block-printing':
      return 'Block Printing';
    case 'sanctity':
      return 'Sanctity';
    case 'faith':
      return 'Faith';
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

export function formatCountdownTicks(ticks: number, ticksPerSecond: number): string {
  if (ticksPerSecond <= 0) {
    return '00:00';
  }

  const totalSeconds = Math.max(0, Math.ceil(ticks / ticksPerSecond));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
