import type { BuildingType } from '../../../game/simulation/types';

// M7 building-visuals slice 1 (north star: an AoE2-HD-quality look from
// ORIGINAL/procedural art only): buildings used to render as ONE generic
// rounded-rect body + roof triangle regardless of type, so a Town Center, a
// House, a Castle, and a Wonder were indistinguishable except by footprint size
// and owner colour. This module is the render-OWNED mapping from a concrete
// `BuildingType` to a READABLE silhouette ROLE — the building analogue of
// `unitRole`. 18 distinct silhouettes would be unreadable at this zoom, so we
// group by the AoE2-meaningful glance distinction (landmark vs home vs
// production hall vs drop-site vs defensive vs wall vs farm, …).

export type BuildingRole =
  | 'town-center' // the player's iconic landmark hall
  | 'fortress' // castle: crenellated keep
  | 'wonder' // grand domed monument
  | 'house' // simple home
  | 'mill' // windmill (food drop-site)
  | 'farm' // tilled field plot (no roof)
  | 'drop-site' // lumber-camp / mining-camp: open resource camp
  | 'military' // barracks / stable / archery-range / siege-workshop: training hall
  | 'blacksmith' // forge with an anvil
  | 'market' // open-air stall with an awning
  | 'monastery' // chapel with a cross
  | 'tower' // tall narrow watch tower
  | 'wall'; // low battlement segment (stone / palisade)

// Exhaustive, render-OWNED mapping. The `satisfies Record<BuildingType,
// BuildingRole>` makes a newly-added BuildingType a compile error here (same
// guard style as unitTypeMap.ts / unitRole). Grouping is independent of any sim
// classification — it is purely a visual readability choice.
const BUILDING_ROLES = {
  'town-center': 'town-center',
  castle: 'fortress',
  wonder: 'wonder',
  house: 'house',
  mill: 'mill',
  farm: 'farm',
  'lumber-camp': 'drop-site',
  'mining-camp': 'drop-site',
  barracks: 'military',
  stable: 'military',
  'archery-range': 'military',
  'siege-workshop': 'military',
  blacksmith: 'blacksmith',
  market: 'market',
  monastery: 'monastery',
  'watch-tower': 'tower',
  'stone-wall': 'wall',
  'palisade-wall': 'wall',
} as const satisfies Record<BuildingType, BuildingRole>;

export function buildingRole(buildingType: BuildingType): BuildingRole {
  return BUILDING_ROLES[buildingType];
}
