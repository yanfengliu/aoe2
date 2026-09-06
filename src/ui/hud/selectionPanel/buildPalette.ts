// The villager build palette: DE's two-page command card.
//
// Split out of `selectionPanel.ts` (which owns panel state and stays under the
// 500-LOC cap). Two roles live here and nothing else: turning a page of build
// options into `data-command="build-<type>"` cards, and drawing the page
// toggle that chooses which page is on screen.
//
// The card is an ICON TILE, as DE's is: the glyph is what the player reads,
// and the name, readiness and per-resource costs stay in the DOM (screen
// readers, the reachability suite, the play-test panel reader) with the CSS
// hiding them visually. The cost a card no longer prints is in its tooltip and
// its `aria-label`, and an unaffordable card is dimmed the way DE dims one.

import type {
  BuildableBuildingType,
  PlayerResources,
} from '../../../game/simulation/types';
import { canAfford } from '../../../game/simulation/prototypeEconomyRules';
import { effectiveConstructionCost } from '../../../game/simulation/civBonusEffects';
import { formatEntityName } from '../displayNames';
import { formatBuildTooltip, formatResourceCost } from '../tooltips';
import type { CommandReasons } from './buttons';
import { buildingGlyph, resourceGlyph } from '../icons/glyphs';
import { buildPageGlyph } from '../icons/commandGlyphs';
import {
  BUILD_PAGES,
  type BuildPageBuckets,
  type BuildPageId,
} from './buildPages';

const NO_BUILD_REASONS: CommandReasons = new Map();

const BUILD_COST_ORDER: readonly (keyof PlayerResources)[] = [
  'food',
  'wood',
  'gold',
  'stone',
];

function buildCostMarkup(
  cost: Partial<PlayerResources>,
  resources: PlayerResources,
): string {
  return BUILD_COST_ORDER
    .filter((resource) => (cost[resource] ?? 0) > 0)
    .map((resource) => {
      const amount = cost[resource]!;
      const covered = resources[resource] >= amount;
      return `
        <span
          class="hud-build-cost"
          data-build-cost-resource="${resource}"
          data-build-cost-covered="${covered}"
        >
          ${resourceGlyph(resource, 'hud-build-cost__glyph')}
          <span class="hud-build-cost__value">${amount}</span>
        </span>`;
    })
    .join('');
}

function formatMissingBuildResources(
  cost: Partial<PlayerResources>,
  resources: PlayerResources,
): string {
  return BUILD_COST_ORDER
    .filter((resource) => resources[resource] < (cost[resource] ?? 0))
    .join(' and ');
}

/** The affordability half of the panel's render signature: a price the player
 *  can now (or no longer) pay has to redraw the palette even when the
 *  selection itself has not changed. */
export function buildAvailabilitySignature(
  buildOptions: readonly BuildableBuildingType[],
  resources: PlayerResources,
  costOf: (buildingType: BuildableBuildingType) => Partial<PlayerResources>,
): string {
  return buildOptions
    .map((buildingType) => {
      const cost = costOf(buildingType);
      return BUILD_COST_ORDER
        .filter((resource) => (cost[resource] ?? 0) > 0)
        .map((resource) => `${resource}:${resources[resource] >= (cost[resource] ?? 0)}`)
        .join(',');
    })
    .join('|');
}

export function renderBuildButtons(
  buildOptions: readonly BuildableBuildingType[],
  resources: PlayerResources,
  placementMode: BuildableBuildingType | null,
  costOf: (buildingType: BuildableBuildingType) => Partial<PlayerResources>
    = (buildingType) => effectiveConstructionCost(undefined, buildingType),
  reasons: CommandReasons = NO_BUILD_REASONS,
): string {
  return buildOptions
    .map((buildingType) => {
      const displayName = formatEntityName(buildingType);
      // The OWNER's price (Franks castles, Mayan walls…): display = charge.
      const cost = costOf(buildingType);
      const affordable = canAfford(resources, cost);
      const active = placementMode === buildingType;
      const readiness = affordable ? 'Ready' : 'Short';
      const missingResources = affordable ? '' : formatMissingBuildResources(cost, resources);
      // §14.2 keeps a Short card DIMMED rather than annotated, so the
      // reason rides the tooltip and the accessible name — the two places
      // a player and a screen reader ask — and not the tile's face.
      //
      // The sentence is the BRIDGE's, never assembled here: a second copy
      // of "Not enough <resources>." in the UI is a copy that drifts (this
      // file joins with " and ", the bridge with commas past two), and a
      // local copy also made the A/B's before arm answer with a reason the
      // base revision never had, so the build card's pixel diff read 0.00%
      // and measured nothing. With no reasons supplied — the exported
      // helper's older signature, which the UI unit tests use — the card
      // keeps exactly the accessible status it had before this change.
      const refusal = reasons.get(`build-${buildingType}`) ?? '';
      const accessibleStatus = refusal || (affordable ? 'ready.' : `short on ${missingResources}.`);
      const baseTooltip = formatBuildTooltip(buildingType, displayName, cost);
      return `
          <button
            class="hud-command-button hud-build-card"
            data-command="build-${buildingType}"
            data-command-affordable="${affordable}"
            data-command-active="${active}"
            data-tooltip="${refusal ? `${baseTooltip} ${refusal}` : baseTooltip}"
            ${refusal ? `data-command-reason="${refusal}"` : ''}
            type="button"
            aria-label="Build ${displayName}. Cost: ${formatResourceCost(cost)}. ${accessibleStatus}"
            aria-pressed="${active}"
          >
            <span class="hud-build-card__visual">${buildingGlyph(buildingType)}</span>
            <span class="hud-command-label hud-build-card__name"><span class="hud-build-card__verb">Build </span>${displayName}</span>
            <span class="hud-build-card__readiness" data-build-readiness>${readiness}</span>
            <span class="hud-build-card__costs" aria-hidden="true">
              ${buildCostMarkup(cost, resources)}
            </span>
          </button>
        `;
    })
    .join('');
}

/**
 * DE's command card is a fixed grid of slots, and a page with fewer buildings
 * on it simply leaves the rest of the slots empty. We do the same, for a
 * concrete reason: both pages then occupy the same number of rows, so the
 * palette — and the page toggle sitting above it — do not move when the player
 * switches pages. The slots are inert spacers: no `data-command`, no tooltip,
 * nothing for a pointer or a screen reader.
 */
export function renderBuildSlots(count: number): string {
  return count > 0
    ? `<span class="hud-build-slot" aria-hidden="true"></span>`.repeat(count)
    : '';
}

/**
 * The page toggle, as a pair of tabs in the Build heading row. It lives in the
 * heading rather than as a row of its own for the same reason the placement
 * pill does: a control added beside the palette takes its height (or its
 * width) out of the palette, and the bar is not allowed to reshape.
 *
 * A page with nothing on it still renders its tab, disabled — a Fishing Ship
 * has no military buildings, and a tab that vanishes is a control that moved.
 */
export function renderBuildPageTabs(
  buckets: BuildPageBuckets,
  activePage: BuildPageId,
): string {
  return `
    <div class="hud-build-pages" role="group" aria-label="Build pages">
      ${BUILD_PAGES.map((page) => {
        const count = buckets[page.id].length;
        const isActive = page.id === activePage;
        return `
          <button
            class="hud-build-page-tab"
            data-build-page="${page.id}"
            data-tooltip="${page.label} — ${count === 0 ? 'nothing this unit can build' : `${count} available`}."
            type="button"
            aria-label="${page.label}"
            aria-pressed="${isActive}"
            ${count === 0 ? 'disabled aria-disabled="true"' : ''}
          >
            ${buildPageGlyph(page.id)}
            <span class="hud-build-page-tab__label">${page.short}</span>
          </button>`;
      }).join('')}
    </div>`;
}
