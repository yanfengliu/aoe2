// Command-card button markup: research / action / market / train / tribute.
// One role — turn an option list into `data-command` buttons — split from
// selectionPanel.ts, which owns panel state and stays under the 500-LOC cap.
//
// Every button keeps the `data-command="<kind>-<id>"` hook and the text label:
// the click handler and the browser reachability suite both key on them.

import type {
  ActionType,
  EconomyResourceKind,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../../game/simulation/types';
import {
  formatActionName,
  formatEntityName,
  formatMarketActionName,
  formatTechnologyName,
} from '../displayNames';
import {
  formatActionTooltip,
  formatMarketActionTooltip,
  formatResearchTooltip,
  formatTrainTooltip,
} from '../tooltips';
import { actionGlyph, marketActionGlyph, researchGlyph, resourceGlyph } from '../icons/glyphs';
import { unitGlyphRole, unitRoleGlyph } from '../icons/unitGlyphs';
import { TRIBUTE_AMOUNT, tributeCost } from '../../../game/simulation/tributeRules';

export function renderResearchButtons(
  visibleResearchOptions: ResearchableTechnologyType[],
  availableResearchOptions: ResearchableTechnologyType[],
): string {
  return visibleResearchOptions
    .map((technologyType) => {
      const isAvailable = availableResearchOptions.includes(technologyType);
      return `
          <button
            class="hud-command-button"
            data-command="research-${technologyType}"
            data-tooltip="${formatResearchTooltip(technologyType, formatTechnologyName(technologyType))}"
            type="button"
            ${isAvailable ? '' : 'disabled aria-disabled="true" data-command-locked="true"'}
          >
            ${researchGlyph()}<span class="hud-command-label">Research ${formatTechnologyName(technologyType)}</span>
          </button>
        `;
    })
    .join('');
}

// M7 UI-icons (v0.1.76): the command-card "action" buttons (the Ungarrison
// order) get a per-action glyph before the label. Augment-not-replace: the
// `data-command="action-<type>"` hook + the action-name text are preserved.
export function renderActionButtons(actionOptions: ActionType[]): string {
  return actionOptions
    .map(
      (actionType) => `
          <button
            class="hud-command-button"
            data-command="action-${actionType}"
            data-tooltip="${formatActionTooltip(actionType)}"
            type="button"
          >
            ${actionGlyph(actionType)}<span class="hud-command-label">${formatActionName(actionType)}</span>
          </button>
        `,
    )
    .join('');
}

// M7 UI-icons (v0.1.75): the command-card Buy/Sell "market" buttons get the
// traded COMMODITY glyph (food/wood/stone) before the label, reusing the
// top-bar `resourceGlyph` art at the command size. Augment-not-replace: the
// `data-command="market-<action>"` hook + "Buy/Sell <Name>" text are preserved.
export function renderMarketButtons(marketOptions: MarketActionType[]): string {
  return marketOptions
    .map(
      (actionType) => `
          <button
            class="hud-command-button"
            data-command="market-${actionType}"
            data-tooltip="${formatMarketActionTooltip(actionType)}"
            type="button"
          >
            ${marketActionGlyph(actionType)}<span class="hud-command-label">${formatMarketActionName(actionType)}</span>
          </button>
        `,
    )
    .join('');
}

export function renderTrainButtons(trainOptions: TrainableUnitType[]): string {
  return trainOptions
    .map(
      (unitType) => `
          <button
            class="hud-command-button"
            data-command="train-${unitType}"
            data-tooltip="${formatTrainTooltip(unitType, formatEntityName(unitType))}"
            type="button"
          >
            ${unitRoleGlyph(unitGlyphRole(unitType), 'hud-command-glyph')}<span class="hud-command-label">Train ${formatEntityName(unitType)}</span>
          </button>
        `,
    )
    .join('');
}


// Tribute (spec §6.8): a 100-of-a-resource button per other player, hosted on
// the Market's card because tribute needs a Market. The tooltip carries the
// real price — amount plus the sender's CURRENT fee — so the button never
// costs more than it says.
const TRIBUTE_RESOURCES: readonly EconomyResourceKind[] = ['food', 'wood', 'gold', 'stone'];

export function renderTributeButtons(targets: readonly number[], feeRate: number): string {
  const cost = tributeCost(TRIBUTE_AMOUNT, feeRate);
  const feeLabel = feeRate > 0 ? `costs ${String(cost)} (${String(Math.round(feeRate * 100))}% fee)` : 'no fee';
  return targets
    .flatMap((toOwner) => TRIBUTE_RESOURCES.map(
      (resource) => `
          <button
            class="hud-command-button"
            data-command="tribute-${String(toOwner)}-${resource}"
            data-tooltip="Send ${String(TRIBUTE_AMOUNT)} ${resource} to Player ${String(toOwner)} — ${feeLabel}."
            type="button"
          >
            ${resourceGlyph(resource, 'hud-command-glyph')}<span class="hud-command-label">${String(TRIBUTE_AMOUNT)} ${resource} → P${String(toOwner)}</span>
          </button>
        `,
    ))
    .join('');
}
