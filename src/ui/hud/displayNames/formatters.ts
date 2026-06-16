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
