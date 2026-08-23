import type { BuildingType } from '../../game/simulation/types';

// M7 building-visuals slice 1 (north star: an AoE2-HD-quality look from
// ORIGINAL/procedural art only): buildings used to render as ONE generic
// rounded-rect body + roof triangle regardless of type, so a Town Center, a
// House, a Castle, and a Wonder were indistinguishable except by footprint size
// and owner colour. This module is the render-OWNED mapping from a concrete
// `BuildingType` to a READABLE base-silhouette ROLE — the building analogue
// of `unitRole`. The shared role establishes the large readable mass at RTS
// zoom; aoeVoxelBuildingDetails then distinguishes every concrete type with
// smaller facade, equipment, stockpile, or landmark props.

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
  | 'gate' // a wall opening framed by two towers
  | 'wall' // low battlement segment (stone / palisade)
  | 'dock' // M5 naval: a pier and boathouse at the waterline
  | 'outpost' // a ladder, a platform and a lookout — no walls, no arrows
  | 'fish-trap'; // stakes and netting standing in the water

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
  // A lecture hall reads as the same chapel-scale mass; its own tint and
  // detail props distinguish it from the monastery.
  university: 'monastery',
  dock: 'dock',
  outpost: 'outpost',
  'fish-trap': 'fish-trap',
  'watch-tower': 'tower',
  'bombard-tower': 'tower',
  'stone-wall': 'wall',
  'palisade-wall': 'wall',
  // A gate needs its own mass: the point of the building is that you can
  // SEE where the wall opens, which a wall silhouette cannot say.
  'stone-gate': 'gate',
  'palisade-gate': 'gate',
} as const satisfies Record<BuildingType, BuildingRole>;

export function buildingRole(buildingType: BuildingType): BuildingRole {
  return BUILDING_ROLES[buildingType];
}
