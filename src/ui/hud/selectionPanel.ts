// Selection panel factory: signature-cached HTML render + per-tick
// command-button rebind. Render helpers live in `selectionPanel/render.ts`
// to keep this file under 500 LOC.

import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  MarketActionType,
  ResearchableTechnologyType,
  SelectionState,
  TrainableUnitType,
} from '../../game/simulation/types';
import {
  formatActionName,
  formatEntityName,
  formatMarketActionName,
  formatQueueEntryName,
  formatQueueProgress,
  formatSelectionName,
  formatTechnologyName,
} from './displayNames';
import {
  formatActionTooltip,
  formatBuildTooltip,
  formatMarketActionTooltip,
  formatResearchTooltip,
  formatTrainTooltip,
} from './tooltips';
import {
  renderSelectionActivity,
  renderSelectionDetails,
  renderSelectionIcons,
} from './selectionPanel/render';
import {
  actionGlyph,
  buildingGlyph,
  marketActionGlyph,
  researchGlyph,
} from './icons/glyphs';
import { unitGlyphRole, unitRoleGlyph } from './icons/unitGlyphs';
// Test surfaces use renderSelectionIcons directly; preserve the export
// path for backward compatibility with existing test imports.
export { renderSelectionIcons } from './selectionPanel/render';

// M7 UI-icons slice 1 (v0.1.39): build a build-command button with an
// original procedural glyph BEFORE its text label (icons augment, do not
// replace — the "Build <Name>" text + the `data-command="build-<type>"`
// hook the click handler and the browser tests rely on are preserved).
// Exported so it is unit-testable in isolation.
export function renderBuildButtons(buildOptions: BuildableBuildingType[]): string {
  return buildOptions
    .map(
      (buildingType) => `
          <button
            class="hud-command-button"
            data-command="build-${buildingType}"
            data-tooltip="${formatBuildTooltip(buildingType, formatEntityName(buildingType))}"
            type="button"
          >
            ${buildingGlyph(buildingType)}<span class="hud-command-label">Build ${formatEntityName(buildingType)}</span>
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

export interface SelectionPanelDeps {
  getEconomyState(): EconomyState;
  issueAction(actionType: ActionType): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
}

export interface SelectionPanelHandle {
  update(selectionState: SelectionState): void;
}

// Renders the left-side selection panel: icons, detail rows, production
// queue items, active placement-mode hint, and the per-command button
// grid (train / action / market / research / build). Skips re-render
// when the `selectionState` signature is unchanged across frames so the
// HUD stays cheap in the common no-change case.
export function createSelectionPanel(
  selectionPanel: HTMLElement | null,
  deps: SelectionPanelDeps,
): SelectionPanelHandle {
  if (!selectionPanel) {
    return { update: () => {} };
  }

  let lastSelectionSignature = '';

  function update(selectionState: SelectionState): void {
    const el = selectionPanel;
    if (!el) {
      return;
    }

    const signature = JSON.stringify(selectionState);
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;

    const economyState = deps.getEconomyState();
    const selectionIcons = renderSelectionIcons(selectionState, economyState);
    const selectionDetails = renderSelectionDetails(selectionState);

    const queueItems = selectionState.queue.length > 0
      ? selectionState.queue
        .map((entry, index) => {
          const progress = entry.totalTicks <= 0
            ? 100
            : Math.max(
              0,
              Math.min(
                100,
                Math.round(((entry.totalTicks - entry.remainingTicks) / entry.totalTicks) * 100),
              ),
            );
          return `
            <div class="hud-queue-item" data-selection-queue-item="${index}">
              <div class="hud-queue-name">${formatQueueEntryName(entry)}</div>
              <div class="hud-queue-meta">${formatQueueProgress(progress)}</div>
              <div class="hud-queue-progress">
                <div class="hud-queue-progress-fill" style="width: ${progress}%"></div>
              </div>
            </div>
          `;
        })
        .join('')
      : '';
    const placementMarkup = selectionState.placementMode
      ? `<div class="hud-selection-meta" data-placement-mode>Placing: ${formatEntityName(selectionState.placementMode)}</div>`
      : '';

    const buildButtons = renderBuildButtons(selectionState.buildOptions);
    const actionButtons = renderActionButtons(selectionState.actionOptions);
    const trainButtons = renderTrainButtons(selectionState.trainOptions);
    const marketButtons = renderMarketButtons(selectionState.marketOptions);
    const researchButtons = renderResearchButtons(
      selectionState.visibleResearchOptions,
      selectionState.researchOptions,
    );

    el.innerHTML = `
      <div class="hud-label">Selection</div>
      <div class="hud-selection-name" data-selection-name>${formatSelectionName(selectionState)}</div>
      ${renderSelectionActivity(selectionState)}
      ${selectionIcons}
      ${selectionDetails}
      ${queueItems ? `<div class="hud-queue-list" data-selection-queue-list>${queueItems}</div>` : ''}
      ${placementMarkup}
      <div class="hud-command-list">
        ${actionButtons}
        ${trainButtons}
        ${marketButtons}
        ${researchButtons}
        ${buildButtons}
      </div>
    `;

    el.querySelectorAll<HTMLButtonElement>('[data-command^="train-"]').forEach((button) => {
      const unitType = button.dataset.command?.replace('train-', '') as TrainableUnitType | undefined;
      if (!unitType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.queueTrainUnit(unitType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="action-"]').forEach((button) => {
      const actionType = button.dataset.command?.replace('action-', '') as ActionType | undefined;
      if (!actionType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.issueAction(actionType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="market-"]').forEach((button) => {
      const actionType = button.dataset.command?.replace('market-', '') as MarketActionType | undefined;
      if (!actionType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.issueMarketAction(actionType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="research-"]').forEach((button) => {
      const technologyType = button.dataset.command?.replace(
        'research-',
        '',
      ) as ResearchableTechnologyType | undefined;
      if (!technologyType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.queueResearch(technologyType);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="build-"]').forEach((button) => {
      const buildingType = button.dataset.command?.replace('build-', '') as BuildableBuildingType | undefined;
      if (!buildingType) {
        return;
      }
      button.addEventListener('click', () => {
        deps.beginBuildingPlacement(buildingType);
      });
    });
  }

  return { update };
}
