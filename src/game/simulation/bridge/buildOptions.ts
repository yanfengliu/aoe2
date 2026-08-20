// What a VILLAGER can place, by age and prerequisite. Extracted from
// ./optionsRules.ts to keep that file under the 500-LOC budget; it answers a
// different question from the rest of that module (which asks what a BUILDING
// can produce), so it is the clean seam.

import type {
  AgeType,
  BuildableBuildingType,
  BuildingType,
  ResearchableTechnologyType,
  UnitType,
} from '../types';

/**
 * The buildings this unit may place right now. Age and building prerequisites
 * are passed in as predicates so this stays pure; the bridge owns the maps.
 */
export function buildOptionsFor(
  owner: number,
  unitType: UnitType,
  getPlayerAge: (owner: number) => AgeType,
  hasCompletedBuilding: (owner: number, buildingType: BuildingType) => boolean,
  hasOwnedWonder: (owner: number) => boolean,
  hasTechnology: (owner: number, tech: ResearchableTechnologyType) => boolean,
): BuildableBuildingType[] {
  if (unitType !== 'villager') {
    return [];
  }

  const options: BuildableBuildingType[] = [
    'house',
    'mill',
    'lumber-camp',
    'mining-camp',
    'barracks',
    // Palisade Wall: Dark-Age defensive option (no prereq) — the early wall vs a Dark-Age rush (campaign-7).
    'palisade-wall',
    'farm', // M1 Farms: Dark-Age renewable food (60 wood, no prerequisite).
    // M5 naval: Dark Age, like AoE2. Placement still requires a shore, so on
    // a landlocked map it is offered but never placeable.
    'dock',
  ];

  if (getPlayerAge(owner) !== 'dark-age' && hasCompletedBuilding(owner, 'barracks')) {
    options.push('stable');
    options.push('archery-range');
    options.push('blacksmith');
    options.push('market');
    options.push('watch-tower');
  }

  if (getPlayerAge(owner) === 'castle-age' || getPlayerAge(owner) === 'imperial-age') {
    options.push('town-center');
    options.push('siege-workshop');
    options.push('monastery');
    options.push('university'); // Castle Age (structures.csv); researches Ballistics.
    options.push('castle');
    options.push('stone-wall');
  }

  if (getPlayerAge(owner) === 'imperial-age' && !hasOwnedWonder(owner)) {
    options.push('wonder');
  }

  // The Bombard Tower is UNLOCKED by research rather than by age alone, so it
  // is the one entry here that asks about a technology.
  if (hasTechnology(owner, 'bombard-tower-unlock')) {
    options.push('bombard-tower');
  }

  return options;
}
