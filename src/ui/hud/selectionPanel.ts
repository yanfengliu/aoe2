// Selection panel factory: signature-cached HTML render + per-tick
// command-button rebind. Render helpers live in `selectionPanel/render.ts`
// to keep this file under 500 LOC.

import type { UnitStance } from '../../game/simulation/unitStance';
import type { UnitFormation } from '../../game/simulation/unitFormation';
import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  SelectionState,
  TrainableUnitType,
} from '../../game/simulation/types';
import {
  canAfford,
  constructionCost,
} from '../../game/simulation/prototypeEconomyRules';
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
  formatResourceCost,
  formatTrainTooltip,
} from './tooltips';
import {
  renderFormationButtons,
  renderStanceButtons,
  renderSelectionActivity,
  renderSelectionDetails,
  renderSelectionIcons,
} from './selectionPanel/render';
import {
  actionGlyph,
  buildingGlyph,
  marketActionGlyph,
  researchGlyph,
  resourceGlyph,
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

function buildAvailabilitySignature(
  buildOptions: BuildableBuildingType[],
  resources: PlayerResources,
): string {
  return buildOptions
    .map((buildingType) => {
      const cost = constructionCost(buildingType);
      return BUILD_COST_ORDER
        .filter((resource) => (cost[resource] ?? 0) > 0)
        .map((resource) => `${resource}:${resources[resource] >= (cost[resource] ?? 0)}`)
        .join(',');
    })
    .join('|');
}

export function renderBuildButtons(
  buildOptions: BuildableBuildingType[],
  resources: PlayerResources,
  placementMode: BuildableBuildingType | null,
): string {
  return buildOptions
    .map((buildingType) => {
      const displayName = formatEntityName(buildingType);
      const cost = constructionCost(buildingType);
      const affordable = canAfford(resources, cost);
      const active = placementMode === buildingType;
      const readiness = affordable ? 'Ready' : 'Short';
      const missingResources = affordable ? '' : formatMissingBuildResources(cost, resources);
      const accessibleStatus = affordable ? 'ready' : `short on ${missingResources}`;
      return `
          <button
            class="hud-command-button hud-build-card"
            data-command="build-${buildingType}"
            data-command-affordable="${affordable}"
            data-command-active="${active}"
            data-tooltip="${formatBuildTooltip(buildingType, displayName)}"
            type="button"
            aria-label="Build ${displayName}. Cost: ${formatResourceCost(cost)}. ${accessibleStatus}."
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

type CommandGroupKind =
  | 'action'
  | 'stance'
  | 'formation'
  | 'train'
  | 'market'
  | 'research'
  | 'build';

function renderCommandGroup(
  kind: CommandGroupKind,
  label: string,
  content: string,
  count: number,
): string {
  if (!content) {
    return '';
  }
  const headingId = `hud-command-group-${kind}`;
  const listClass = kind === 'build' ? 'hud-build-menu' : 'hud-command-list';
  return `
    <section
      class="hud-command-group hud-command-group--${kind}"
      data-command-group="${kind}"
      data-command-group-count="${count}"
      aria-labelledby="${headingId}"
    >
      <div class="hud-command-group__heading">
        <span class="hud-command-group__title" id="${headingId}">${label}</span>
        <span class="hud-command-group__count" aria-hidden="true">${count}</span>
      </div>
      <div class="${listClass}">${content}</div>
    </section>`;
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
  setSelectionStance(stance: UnitStance): boolean;
  setSelectionFormation(formation: UnitFormation): boolean;
  queueTrainUnit(unitType: TrainableUnitType): boolean;
  queueResearch(technologyType: ResearchableTechnologyType): boolean;
  issueMarketAction(actionType: MarketActionType): boolean;
  beginBuildingPlacement(buildingType: BuildableBuildingType): boolean;
}

export interface SelectionPanelHandle {
  update(selectionState: SelectionState, playerResources: PlayerResources): void;
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

  function update(selectionState: SelectionState, playerResources: PlayerResources): void {
    const el = selectionPanel;
    if (!el) {
      return;
    }

    const signature = JSON.stringify([
      selectionState,
      selectionState.buildOptions.length > 0
        ? buildAvailabilitySignature(selectionState.buildOptions, playerResources)
        : null,
    ]);
    if (signature === lastSelectionSignature) {
      return;
    }
    lastSelectionSignature = signature;

    const focusedCommand = el.contains(document.activeElement)
      && document.activeElement instanceof HTMLElement
      ? document.activeElement.dataset.command ?? null
      : null;

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
      ? `<div class="hud-placement-status">
          <div class="hud-selection-meta" data-placement-mode>Placing: ${formatEntityName(selectionState.placementMode)}</div>
          <div class="hud-placement-status__hint">Choose a clear map tile</div>
        </div>`
      : '';

    const buildButtons = renderBuildButtons(
      selectionState.buildOptions,
      playerResources,
      selectionState.placementMode,
    );
    const actionButtons = renderActionButtons(selectionState.actionOptions);
    const trainButtons = renderTrainButtons(selectionState.trainOptions);
    const marketButtons = renderMarketButtons(selectionState.marketOptions);
    const researchButtons = renderResearchButtons(
      selectionState.visibleResearchOptions,
      selectionState.researchOptions,
    );

    const commandGroups = [
      renderCommandGroup('action', 'Orders', actionButtons, selectionState.actionOptions.length),
      renderCommandGroup(
        'stance',
        'Stance',
        renderStanceButtons(selectionState.stanceOptions, selectionState.stance),
        selectionState.stanceOptions.length,
      ),
      renderCommandGroup(
        'formation',
        'Formation',
        renderFormationButtons(selectionState.formationOptions, selectionState.formation),
        selectionState.formationOptions.length,
      ),
      renderCommandGroup('train', 'Train', trainButtons, selectionState.trainOptions.length),
      renderCommandGroup('market', 'Trade', marketButtons, selectionState.marketOptions.length),
      renderCommandGroup(
        'research',
        'Research',
        researchButtons,
        selectionState.visibleResearchOptions.length,
      ),
      renderCommandGroup('build', 'Build', buildButtons, selectionState.buildOptions.length),
    ].join('');

    // Who is selected and what they are — one block, so the command deck beside
    // it gets the rest of the bar. Grouping these three was what let the build
    // palette fit on screen at all once the panel became a bottom bar.
    el.innerHTML = `
      <div class="hud-selection-summary">
        <div class="hud-selection-heading">
          <div class="hud-label">Selection</div>
          <div class="hud-selection-name" data-selection-name>${formatSelectionName(selectionState)}</div>
          ${renderSelectionActivity(selectionState)}
        </div>
        ${selectionIcons}
        ${selectionDetails}
      </div>
      ${queueItems ? `<div class="hud-queue-list" data-selection-queue-list>${queueItems}</div>` : ''}
      ${placementMarkup}
      ${commandGroups ? `<div class="hud-command-deck" data-command-deck>${commandGroups}</div>` : ''}
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
    el.querySelectorAll<HTMLButtonElement>('[data-command^="stance-"]').forEach((button) => {
      const stance = button.dataset.command?.replace('stance-', '') as UnitStance | undefined;
      if (!stance) {
        return;
      }
      button.addEventListener('click', () => {
        deps.setSelectionStance(stance);
      });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-command^="formation-"]').forEach((button) => {
      const formation = button.dataset.command
        ?.replace('formation-', '') as UnitFormation | undefined;
      if (!formation) {
        return;
      }
      button.addEventListener('click', () => {
        deps.setSelectionFormation(formation);
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

    if (focusedCommand) {
      const replacement = [...el.querySelectorAll<HTMLButtonElement>('[data-command]')]
        .find((button) => button.dataset.command === focusedCommand);
      replacement?.focus({ preventScroll: true });
    }
  }

  return { update };
}
