// DE's villager command card has exactly TWO build pages — Economic Buildings
// and Military Buildings — with a toggle between them (spec §14.1). This module
// owns that split and nothing else: which page a building belongs to, how a
// palette is partitioned across the pages, and which page should be showing.
//
// The page and the slot are DE's own (work 142): `VILLAGER_BUILD_SLOTS` in
// `../commandCardKeys.ts`, read from the install's hotkeys.json. That map is
// typed `Record<BuildableBuildingType, …>`, so a building added to the union
// without a page fails `npm run typecheck`; the runtime list exported here is
// what `tests/ui/buildPages.test.ts` walks so the same guarantee holds for a
// build that skipped the typechecker.

import type { BuildableBuildingType } from '../../../game/simulation/types';
import { gridSlotOf, VILLAGER_BUILD_SLOTS } from '../commandCardKeys';

export type BuildPageId = 'economic' | 'military';

/** Every buildable building, in map order — the runtime mirror of the union. */
export const BUILDABLE_BUILDING_TYPES = Object.keys(
  VILLAGER_BUILD_SLOTS,
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
  return VILLAGER_BUILD_SLOTS[buildingType].page;
}

export function isBuildPageId(value: unknown): value is BuildPageId {
  return value === 'economic' || value === 'military';
}

export type BuildPageBuckets = Record<BuildPageId, BuildableBuildingType[]>;

/** Split a palette across the two pages, each page in DE's grid order: a
 *  building's slot is its key, Q W E R T, A S D F G, Z X C V B. */
export function partitionBuildOptions(
  buildOptions: readonly BuildableBuildingType[],
): BuildPageBuckets {
  const buckets: BuildPageBuckets = { economic: [], military: [] };
  for (const buildingType of buildOptions) {
    buckets[buildPageOf(buildingType)].push(buildingType);
  }
  const slot = (buildingType: BuildableBuildingType): number => gridSlotOf(VILLAGER_BUILD_SLOTS[buildingType].key);
  for (const page of Object.values(buckets)) page.sort((a, b) => slot(a) - slot(b));
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
