// Barrel re-export for the displayNames/* split. Pre-iter-3 this was a
// 763-LOC monolith; split into entityNames + icons + formatters per the
// 500-LOC hard-limit rule. Imports from `./displayNames` keep working.

export {
  formatEntityName,
  formatEntityPluralName,
  formatSelectionName,
  isUnitType,
} from './displayNames/entityNames';

export {
  formatEntityIcon,
  formatEntityIconAccent,
} from './displayNames/icons';

export {
  formatTechnologyName,
  formatActionName,
  formatMarketActionName,
  formatQueueEntryName,
  formatQueueProgress,
  formatAgeName,
  formatMatchTime,
  formatCountdownTicks,
} from './displayNames/formatters';
