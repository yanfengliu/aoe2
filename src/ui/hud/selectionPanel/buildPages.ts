// DE's villager command card has exactly TWO build pages — Economic Buildings
// and Military Buildings — with a toggle between them (spec §14.1). This module
// owns that split and nothing else: which page a building belongs to, how a
// palette is partitioned across the pages, and which page should be showing.
//
// The map below is typed `Record<BuildableBuildingType, BuildPageId>`, so a
// building added to the union without a page fails `npm run typecheck`; the
// runtime list it exports is what `tests/ui/buildPages.test.ts` walks so the
// same guarantee holds for a build that skipped the typechecker.

import type { BuildableBuildingType } from '../../../game/simulation/types';

export type BuildPageId = 'economic' | 'military';

// The DE split. Towers and walls are MILITARY in DE (they sit on the military
// page beside the Barracks), the Town Center and the Wonder are ECONOMIC.
const BUILD_PAGE_BY_BUILDING: Record<BuildableBuildingType, BuildPageId> = {
  // Economic Buildings
  house: 'economic',
  mill: 'economic',
  farm: 'economic',
  'lumber-camp': 'economic',
  'mining-camp': 'economic',
  market: 'economic',
  dock: 'economic',
  'fish-trap': 'economic',
  'town-center': 'economic',
  wonder: 'economic',
  // Military Buildings
  barracks: 'military',
  'archery-range': 'military',
  stable: 'military',
  'siege-workshop': 'military',
  blacksmith: 'military',
  monastery: 'military',
  university: 'military',
  castle: 'military',
  outpost: 'military',
  'watch-tower': 'military',
  'bombard-tower': 'military',
  'palisade-wall': 'military',
  'stone-wall': 'military',
  'palisade-gate': 'military',
  'stone-gate': 'military',
};

/** Every buildable building, in map order — the runtime mirror of the union. */
export const BUILDABLE_BUILDING_TYPES = Object.keys(
  BUILD_PAGE_BY_BUILDING,
) as BuildableBuildingType[];

export interface BuildPage {
  id: BuildPageId;
  /** The page's full DE name — the tab's accessible name and tooltip subject. */
  label: string;
  /** The short tab caption. */
  short: string;
}

export const BUILD_PAGES: readonly BuildPage[] = [
  { id: 'economic', label: 'Economic Buildings', short: 'Eco' },
  { id: 'military', label: 'Military Buildings', short: 'Mil' },
];

export const DEFAULT_BUILD_PAGE: BuildPageId = 'economic';

export function buildPageOf(buildingType: BuildableBuildingType): BuildPageId {
  return BUILD_PAGE_BY_BUILDING[buildingType];
}

export function isBuildPageId(value: unknown): value is BuildPageId {
  return value === 'economic' || value === 'military';
}

export type BuildPageBuckets = Record<BuildPageId, BuildableBuildingType[]>;

/** Split a palette across the two pages, each page keeping the palette order. */
export function partitionBuildOptions(
  buildOptions: readonly BuildableBuildingType[],
): BuildPageBuckets {
  const buckets: BuildPageBuckets = { economic: [], military: [] };
  for (const buildingType of buildOptions) {
    buckets[buildPageOf(buildingType)].push(buildingType);
  }
  return buckets;
}

/**
 * Which page to draw. The page the player chose wins whenever they have chosen
 * one; otherwise placement seeds it — the "Placing: …" pill lives in the Build
 * heading, so the card it names has to be on the page under it — and otherwise
 * the first page with anything on it (a Fishing Ship's palette is
 * Economic-only, and an empty page would read as a broken palette rather than
 * as a page with nothing on it).
 *
 * `chosen` is null until the player presses a tab. Placement cannot outrank a
 * choice made after it started: every build click enters placement, so a
 * toggle that placement always won was a dead control in the commonest state,
 * and it recorded the press anyway — the palette then flipped pages the moment
 * placement was cancelled.
 */
export function resolveActiveBuildPage(
  chosen: BuildPageId | null,
  buckets: BuildPageBuckets,
  placementMode: BuildableBuildingType | null,
): BuildPageId {
  if (chosen && buckets[chosen].length > 0) {
    return chosen;
  }
  if (placementMode && buckets[buildPageOf(placementMode)].length > 0) {
    return buildPageOf(placementMode);
  }
  // A chosen or placed page with nothing on it falls through to the first page
  // that has something: an empty palette reads as a broken one.
  return BUILD_PAGES.find((page) => buckets[page.id].length > 0)?.id
    ?? chosen ?? DEFAULT_BUILD_PAGE;
}
