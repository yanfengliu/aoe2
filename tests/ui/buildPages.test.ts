// DE's villager command card has exactly two build pages, and EVERY buildable
// building has to be on one of them: a building that is on neither is a
// building no player can ever place, and the palette would look complete while
// missing it.
//
// The `Record<BuildableBuildingType, BuildPageId>` in `buildPages.ts` makes
// that a typecheck error. This is the runtime half of the same guarantee, and
// it is anchored to a SECOND exhaustive record — the glyph map, which is keyed
// by the same union — so the two can only agree if both are complete.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { BuildableBuildingType } from '../../src/game/simulation/types';
import {
  BUILDABLE_BUILDING_TYPES,
  BUILD_PAGES,
  buildPageOf,
  partitionBuildOptions,
  resolveActiveBuildPage,
} from '../../src/ui/hud/selectionPanel/buildPages';
import { isBuildableBuildingType } from '../../src/ui/hud/icons/glyphs';

/** The union's members, read from the type declaration itself — the one source
 *  that cannot be kept in step by copying it. */
function unionMembersFromSource(): string[] {
  const source = readFileSync(
    join(process.cwd(), 'src/game/simulation/types.ts'),
    'utf8',
  );
  const start = source.indexOf('export type BuildableBuildingType =');
  expect(start, 'BuildableBuildingType is declared in types.ts').toBeGreaterThan(-1);
  const end = source.indexOf(';', start);
  const body = source.slice(start, end);
  return [...body.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]!);
}

describe('build pages', () => {
  it('puts every BuildableBuildingType on exactly one page', () => {
    const members = unionMembersFromSource();
    expect(members.length, 'the union parsed out of types.ts').toBeGreaterThan(20);

    const onPages = new Map<string, string[]>();
    for (const page of BUILD_PAGES) {
      for (const buildingType of BUILDABLE_BUILDING_TYPES) {
        if (buildPageOf(buildingType) === page.id) {
          onPages.set(buildingType, [...(onPages.get(buildingType) ?? []), page.id]);
        }
      }
    }

    const pageless = members.filter((member) => !onPages.has(member));
    expect(pageless, 'buildings on no page').toEqual([]);
    const doubled = [...onPages].filter(([, pages]) => pages.length !== 1);
    expect(doubled, 'buildings on more than one page').toEqual([]);
    const unknown = [...onPages.keys()].filter((key) => !members.includes(key));
    expect(unknown, 'pages naming a building the union does not have').toEqual([]);
  });

  it('keeps its runtime list in step with the glyph map, the other exhaustive record', () => {
    for (const buildingType of BUILDABLE_BUILDING_TYPES) {
      expect(
        isBuildableBuildingType(buildingType),
        `${buildingType} has a building glyph`,
      ).toBe(true);
    }
    expect(BUILDABLE_BUILDING_TYPES.length).toBe(unionMembersFromSource().length);
  });

  // DE's own split, not a guess at it (work 142 M2a): each VILLAGER_HOTKEYS
  // entry of the install's `resources/_common/dat/hotkeys.json` names its page
  // in `context`, and Blacksmith, Monastery and University are "economic".
  // Until work 142 this test held them on the Military page. The Fish Trap
  // has no context there (a Fishing Ship builds it), and stays Economic.
  it('follows DE\'s hotkeys.json: each building on the page its context names', () => {
    const economic: BuildableBuildingType[] = [
      'house', 'mill', 'farm', 'lumber-camp', 'mining-camp',
      'market', 'dock', 'fish-trap', 'town-center', 'wonder',
      'blacksmith', 'monastery', 'university',
    ];
    const military: BuildableBuildingType[] = [
      'barracks', 'archery-range', 'stable', 'siege-workshop',
      'castle', 'outpost', 'watch-tower',
      'bombard-tower', 'palisade-wall', 'stone-wall', 'palisade-gate', 'stone-gate',
    ];
    for (const buildingType of economic) {
      expect(buildPageOf(buildingType), buildingType).toBe('economic');
    }
    for (const buildingType of military) {
      expect(buildPageOf(buildingType), buildingType).toBe('military');
    }
    expect(economic.length + military.length).toBe(BUILDABLE_BUILDING_TYPES.length);
  });

  it('splits a palette into pages in DE\'s grid order, Q W E R T, A S D F G, Z X C V B', () => {
    // The palette's own order is not the page's: DE's card is a grid whose
    // slot is the building's key (VILLAGER_HOTKEYS), so a page lists its
    // buildings by that key's place in the grid.
    const buckets = partitionBuildOptions([
      'farm', 'palisade-wall', 'mill', 'outpost', 'house', 'barracks', 'lumber-camp', 'mining-camp', 'dock',
    ]);
    expect(buckets.economic).toEqual(['house', 'mill', 'mining-camp', 'lumber-camp', 'dock', 'farm']);
    expect(buckets.military).toEqual(['barracks', 'outpost', 'palisade-wall']);
  });

  it('shows the chosen page, then the page a placement is on, then any page with options', () => {
    const both = partitionBuildOptions(['house', 'barracks']);
    // Nothing chosen yet: placement seeds the page, because the "Placing: …"
    // pill lives in the Build heading and the card it names has to be under it.
    expect(resolveActiveBuildPage(null, both, 'barracks')).toBe('military');
    expect(resolveActiveBuildPage(null, both, null)).toBe('economic');

    // A CHOICE made since outranks it. Every build click enters placement, so a
    // toggle placement always won would be a dead control in the commonest
    // state — and it recorded the press anyway, so the palette flipped pages
    // the moment placement was cancelled.
    expect(resolveActiveBuildPage('economic', both, 'barracks')).toBe('economic');
    expect(resolveActiveBuildPage('military', both, null)).toBe('military');

    // A Fishing Ship has no military buildings; an empty page would read as a
    // broken palette, so neither a choice nor a placement can land on one.
    const economicOnly = partitionBuildOptions(['fish-trap']);
    expect(resolveActiveBuildPage('military', economicOnly, null)).toBe('economic');
    expect(resolveActiveBuildPage(null, economicOnly, 'fish-trap')).toBe('economic');
  });
});
