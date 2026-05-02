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
// Test surfaces use renderSelectionIcons directly; preserve the export
// path for backward compatibility with existing test imports.
export { renderSelectionIcons } from './selectionPanel/render';

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

    const buildButtons = selectionState.buildOptions
      .map(
        (buildingType) => `
          <button
            class="hud-command-button"
            data-command="build-${buildingType}"
            data-tooltip="${formatBuildTooltip(buildingType, formatEntityName(buildingType))}"
            type="button"
          >
            Build ${formatEntityName(buildingType)}
          </button>
        `,
      )
      .join('');
    const actionButtons = selectionState.actionOptions
      .map(
        (actionType) => `
          <button
            class="hud-command-button"
            data-command="action-${actionType}"
            data-tooltip="${formatActionTooltip(actionType)}"
            type="button"
          >
            ${formatActionName(actionType)}
          </button>
        `,
      )
      .join('');
    const trainButtons = selectionState.trainOptions
      .map(
        (unitType) => `
          <button
            class="hud-command-button"
            data-command="train-${unitType}"
            data-tooltip="${formatTrainTooltip(unitType, formatEntityName(unitType))}"
            type="button"
          >
            Train ${formatEntityName(unitType)}
          </button>
        `,
      )
      .join('');
    const marketButtons = selectionState.marketOptions
      .map(
        (actionType) => `
          <button
            class="hud-command-button"
            data-command="market-${actionType}"
            data-tooltip="${formatMarketActionTooltip(actionType)}"
            type="button"
          >
            ${formatMarketActionName(actionType)}
          </button>
        `,
      )
      .join('');
    const researchButtons = selectionState.visibleResearchOptions
      .map((technologyType) => {
        const isAvailable = selectionState.researchOptions.includes(technologyType);
        return `
          <button
            class="hud-command-button"
            data-command="research-${technologyType}"
            data-tooltip="${formatResearchTooltip(technologyType, formatTechnologyName(technologyType))}"
            type="button"
            ${isAvailable ? '' : 'disabled aria-disabled="true" data-command-locked="true"'}
          >
            Research ${formatTechnologyName(technologyType)}
          </button>
        `;
      })
      .join('');

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
