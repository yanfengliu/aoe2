// DE's civilians, for the command card (work 142 M2b-1): the "civilians"
// group of the install's `resources/_common/dat/selection_group_def.json`
// holds the object groups CIVILIAN (4, the villager), FISHING_BOAT (21),
// TRADERS (19, the Trade Cart) and TRADING_BOAT (2, the Trade Cog). Its
// "all_military" group holds every other unit class this game has, the
// Transport Ship (TRANSPORT_BOAT, 20) and the Monk (PRIEST, 18) included.
// DE files the stances and formations under "Military Units"
// (`hotkeys.json`'s MILITARY_UNITS_HOTKEYS, string 20014), so a civilian's
// card has neither.
//
// Not the economy sets of `civBonusTable.ts` and `idleMilitaryOps.ts`, which
// also count the Transport Ship and answer other questions (which units a
// civilization bonus reaches, and which units the idle-military key cycles).

import type { UnitType } from './unitTypes';

const DE_CIVILIAN_UNITS: ReadonlySet<UnitType> = new Set<UnitType>([
  'villager',
  'fishing-ship',
  'trade-cart',
  'trade-cog',
]);

/** Whether DE groups this unit with its civilians, whose cards have no stance or formation. */
export function isDeCivilianUnit(unitType: UnitType): boolean {
  return DE_CIVILIAN_UNITS.has(unitType);
}
