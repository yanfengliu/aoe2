// What a unit, building or technology does, for its tooltip (work 148 M2). DE's
// help text says it for every one (the install's string table: 26xxx for units
// and buildings, 28xxx for technologies, each "<verb> <b>Name<b> (<cost>)\n" and
// then what it does); the copy is in this game's own words, one table per kind,
// with its sources and this game's departures from DE in each table's file.
//
// The two technology tables are joined here under one Record type, so a
// technology missing from both is a compile error, as a missing unit or
// building is in its own table.

import type { BuildingType, ResearchableTechnologyType, UnitType } from '../../../game/simulation/types';
import { isAgeUpTechnology } from '../../../game/simulation/prototypeBuildingRules';
import { BUILDING_HELP } from './buildingHelp';
import { GENERAL_TECHNOLOGY_HELP, GENERAL_UPGRADE_VERB } from './technologyHelp';
import { UNIT_HELP } from './unitHelp';
import { UPGRADE_TECHNOLOGY_HELP, UPGRADE_VERB } from './upgradeHelp';

const TECHNOLOGY_HELP: Readonly<Record<ResearchableTechnologyType, string>> = {
  ...GENERAL_TECHNOLOGY_HELP,
  ...UPGRADE_TECHNOLOGY_HELP,
};

const UPGRADE_TO: ReadonlySet<ResearchableTechnologyType> = new Set([...GENERAL_UPGRADE_VERB, ...UPGRADE_VERB]);

// DE says "Build" for a siege weapon, a ship and a trade unit, and "Create" for
// everyone else, the Petard and the War Wagon included: each of these units'
// own help string begins "Build <b>" (26381 the Trebuchet, 26439 the Heavy
// Scorpion, 26287 the Cannon Galleon, 26100 the Trade Cart, 26106 and 26457 the
// Longship, which is this game's Longboat).
const BUILT_UNITS: ReadonlySet<UnitType> = new Set<UnitType>([
  'battering-ram', 'capped-ram', 'siege-ram', 'mangonel', 'onager', 'siege-onager', 'scorpion', 'heavy-scorpion',
  'bombard-cannon', 'trebuchet', 'trade-cart', 'trade-cog', 'fishing-ship', 'transport-ship', 'galley', 'war-galley',
  'galleon', 'fire-ship', 'fast-fire-ship', 'demolition-ship', 'heavy-demolition-ship', 'cannon-galleon',
  'elite-cannon-galleon', 'turtle-ship', 'elite-turtle-ship', 'longboat', 'elite-longboat',
]);

export function unitHelp(unitType: UnitType): string {
  return UNIT_HELP[unitType];
}

/** DE's verb for a unit's tooltip: "Create" (26121, the Villager) or "Build". */
export function unitVerb(unitType: UnitType): 'Create' | 'Build' {
  return BUILT_UNITS.has(unitType) ? 'Build' : 'Create';
}

export function buildingHelp(buildingType: BuildingType): string {
  return BUILDING_HELP[buildingType];
}

export function technologyHelp(technologyType: ResearchableTechnologyType): string {
  return TECHNOLOGY_HELP[technologyType];
}

/** DE's verb for a technology's tooltip: "Advance to" an age (28101-28103),
 *  "Upgrade to" a unit-line, tower or wall upgrade (28100, 28186, 28163), and
 *  "Research" for the rest. */
export function technologyVerb(technologyType: ResearchableTechnologyType): 'Advance to' | 'Upgrade to' | 'Research' {
  if (isAgeUpTechnology(technologyType)) return 'Advance to';
  return UPGRADE_TO.has(technologyType) ? 'Upgrade to' : 'Research';
}
