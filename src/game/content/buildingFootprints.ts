import type { BuildingType } from '../simulation/types';

export interface BuildingFootprint {
  width: number;
  height: number;
}

// Centralized gameplay footprints for the currently implemented DE buildings.
// Placement, occupancy, selection, construction, and building rendering all use
// this table so the player sees one consistent size model.
export const AUTHORITATIVE_BUILDING_FOOTPRINTS: Record<BuildingType, BuildingFootprint> = {
  'town-center': { width: 4, height: 4 },
  house: { width: 2, height: 2 },
  mill: { width: 2, height: 2 },
  'lumber-camp': { width: 2, height: 2 },
  'mining-camp': { width: 2, height: 2 },
  barracks: { width: 3, height: 3 },
  'watch-tower': { width: 1, height: 1 },
  stable: { width: 3, height: 3 },
  'archery-range': { width: 3, height: 3 },
  blacksmith: { width: 3, height: 3 },
  market: { width: 4, height: 4 },
  'siege-workshop': { width: 3, height: 3 },
  monastery: { width: 2, height: 2 },
  castle: { width: 4, height: 4 },
  wonder: { width: 4, height: 4 },
  'stone-wall': { width: 1, height: 1 },
  'palisade-wall': { width: 1, height: 1 },
};

export function getBuildingFootprint(buildingType: BuildingType): BuildingFootprint {
  return AUTHORITATIVE_BUILDING_FOOTPRINTS[buildingType];
}
