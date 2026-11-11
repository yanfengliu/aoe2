// Command-card button markup: research / action / market / train / tribute.
// One role — turn an option list into `data-command` buttons — split from
// selectionPanel.ts, which owns panel state and stays under the 500-LOC cap.
//
// Every button keeps the `data-command="<kind>-<id>"` hook and the text label:
// the click handler and the browser reachability suite both key on them.

import type {
  ActionType,
  CommandCost,
  EconomyResourceKind,
  MarketActionType,
  PlayerResources,
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
  withRefusal,
} from '../tooltips';
import { escapeHtml } from '../../utils/escapeHtml';
import { actionGlyph, marketActionGlyph, researchGlyph, resourceGlyph } from '../icons/glyphs';
import { unitGlyphRole, unitRoleGlyph } from '../icons/unitGlyphs';
import { TRIBUTE_AMOUNT, tributeCost } from '../../../game/simulation/tributeRules';

/**
 * Why each drawn command refuses, keyed by its `data-command` hook. Built
 * by the panel from `selectionState.unavailableCommands`; the reasons
 * themselves are the bridge's, so a tooltip cannot disagree with the
 * validator that would reject the click.
 */
export type CommandReasons = ReadonlyMap<string, string>;

const NO_REASONS: CommandReasons = new Map();

/**
 * What each drawn command costs, keyed by its `data-command` hook. Built by
 * the panel from `selectionState.commandCosts`: the simulation prices every
 * command from the seam its charge reads, so the figure a tooltip quotes is
 * the figure the click takes (spec §14.2). The HUD never prices one itself.
 */
export type CommandCosts = ReadonlyMap<string, Partial<PlayerResources>>;

const NO_COSTS: CommandCosts = new Map();

export function commandCostsByHook(costs: readonly CommandCost[]): CommandCosts {
  return new Map(costs.map((entry) => [`${entry.kind}-${entry.id}`, entry.cost]));
}

/**
 * The reason goes in two places, for two readers. `data-tooltip` is what
 * the player sees on hover — the only channel a DISABLED control has,
 * since it can never be clicked into a rejection toast. `data-command-reason`
 * is the same text as a stable DOM hook, so a check (and the play-test
 * panel reader) can read it without parsing tooltip prose.
 */
function reasonMarkup(reason: string | undefined, tooltip: string): string {
  const hook = reason ? ` data-command-reason="${escapeHtml(reason)}"` : '';
  return `data-tooltip="${escapeHtml(tooltip)}"${hook}`;
}

// M7 UI-icons (v0.1.74): the command-card "Research <Name>" buttons get the
// generic procedural RESEARCH glyph before the label. Augment-not-replace:
// the `data-command="research-<tech>"` hook, the "Research <Name>" text, and
// the visible-but-locked disabled state (a tech shown greyed until its
// prerequisites are met) are all preserved. `visibleResearchOptions` is the
// full set of buttons to draw; `availableResearchOptions` is the subset that
// is researchable right now (the rest render locked).
export function renderResearchButtons(
  visibleResearchOptions: ResearchableTechnologyType[],
  availableResearchOptions: ResearchableTechnologyType[],
  reasons: CommandReasons = NO_REASONS,
  costs: CommandCosts = NO_COSTS,
): string {
  return visibleResearchOptions
    .map((technologyType) => {
      const isAvailable = availableResearchOptions.includes(technologyType);
      const reason = reasons.get(`research-${technologyType}`);
      const tooltip = formatResearchTooltip(technologyType, costs.get(`research-${technologyType}`), reason);
      return `
          <button
            class="hud-command-button"
            data-command="research-${technologyType}"
            ${reasonMarkup(reason, tooltip)}
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
// order) get a per-action glyph before the label. v0.3.187: the Orders group
// became an ICON grid like DE's command card, so the label is visually hidden
// (CSS) and the button carries an `aria-label` instead. The
// `data-command="action-<type>"` hook and the action-name text in the DOM are
// both preserved.
export function renderActionButtons(actionOptions: ActionType[]): string {
  return actionOptions
    .map(
      (actionType) => `
          <button
            class="hud-command-button hud-command-button--icon"
            data-command="action-${actionType}"
            data-tooltip="${formatActionTooltip(actionType)}"
            aria-label="${formatActionName(actionType)}"
            type="button"
          >
            ${actionGlyph(actionType)}<span class="hud-command-label">${formatActionName(actionType)}</span>
          </button>
        `,
    )
    .join('');
}

// A Market button's tooltip is one sentence, not a help text with a title, so
// its refusal follows on the same line, as it always has.
function marketTooltip(actionType: MarketActionType, reason: string | undefined): string {
  const base = formatMarketActionTooltip(actionType);
  return reason ? `${base} ${reason}` : base;
}

// M7 UI-icons (v0.1.75): the command-card Buy/Sell "market" buttons get the
// traded COMMODITY glyph (food/wood/stone) before the label, reusing the
// top-bar `resourceGlyph` art at the command size. Augment-not-replace: the
// `data-command="market-<action>"` hook + "Buy/Sell <Name>" text are preserved.
export function renderMarketButtons(
  marketOptions: MarketActionType[],
  reasons: CommandReasons = NO_REASONS,
): string {
  return marketOptions
    .map(
      (actionType) => `
          <button
            class="hud-command-button"
            data-command="market-${actionType}"
            ${reasonMarkup(reasons.get(`market-${actionType}`), marketTooltip(actionType, reasons.get(`market-${actionType}`)))}
            type="button"
          >
            ${marketActionGlyph(actionType)}<span class="hud-command-label">${formatMarketActionName(actionType)}</span>
          </button>
        `,
    )
    .join('');
}

// M7 UI-icons (v0.1.72): the command-card "Train <Name>" buttons get a per-role
// procedural UNIT glyph before the label (reusing the v0.1.44 selection-panel
// art), mirroring renderBuildButtons. Augment-not-replace: the
// `data-command="train-<type>"` hook and the "Train <Name>" text are preserved
// (the text sits in a `hud-command-label` span so textContent is unchanged).
// Exported so it is unit-testable in isolation.
export function renderTrainButtons(
  trainOptions: TrainableUnitType[],
  reasons: CommandReasons = NO_REASONS,
  costs: CommandCosts = NO_COSTS,
): string {
  return trainOptions
    .map(
      (unitType) => {
        const reason = reasons.get(`train-${unitType}`);
        const tooltip = withRefusal(formatTrainTooltip(unitType, costs.get(`train-${unitType}`)), reason);
        return `
          <button
            class="hud-command-button"
            data-command="train-${unitType}"
            ${reasonMarkup(reason, tooltip)}
            type="button"
          >
            ${unitRoleGlyph(unitGlyphRole(unitType), 'hud-command-glyph')}<span class="hud-command-label">Train ${formatEntityName(unitType)}</span>
          </button>
        `;
      },
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
