import type {
  ActionType,
  BuildableBuildingType,
  EconomyState,
  MarketActionType,
  ResearchableTechnologyType,
  SelectionState,
  TrainableUnitType,
  UnitType,
} from '../../game/simulation/types';
import {
  formatActionName,
  formatEntityIcon,
  formatEntityIconAccent,
  formatEntityName,
  formatMarketActionName,
  formatQueueEntryName,
  formatQueueProgress,
  formatSelectionName,
  formatTechnologyName,
  isUnitType,
} from './displayNames';

// Types that can appear as first-class entries in the multi-select icon
// grid. Owned sheep live in `economyState.resources`, not `.units`, but
// they share the player-commandable multi-selection contract with units,
// so the icon grid treats them as siblings.
type MultiSelectionIconKind = UnitType | 'sheep';
import {
  SELECTION_DETAIL_TOOLTIPS,
  formatActionTooltip,
  formatBuildTooltip,
  formatMarketActionTooltip,
  formatResearchTooltip,
  formatTrainTooltip,
} from './tooltips';

function renderSingleSelectionIcon(
  entityType: SelectionState['selectedEntityType'],
): string {
  if (!entityType) {
    return '';
  }

  return `
    <div
      class="hud-selection-unit-list"
      data-selection-unit-icons
      style="--unit-icon-accent: ${formatEntityIconAccent(entityType)}"
    >
      <div class="hud-selection-unit-chip">
        <div class="hud-selection-unit-badge" data-selection-entity-icon="${entityType}">
          ${formatEntityIcon(entityType)}
        </div>
        <div class="hud-selection-unit-meta">
          <div class="hud-selection-unit-label">${formatEntityName(entityType)}</div>
        </div>
      </div>
    </div>
  `;
}

export function renderSelectionIcons(
  selectionState: SelectionState,
  economyState: EconomyState,
): string {
  if (selectionState.selectedEntityIds.length === 0) {
    return '';
  }

  // Single non-unit selections (buildings, lone owned sheep, relics, ...)
  // keep using the entity-icon big-chip path for HUD consistency; this
  // preserves the `data-selection-entity-icon` contract that existing
  // browser tests rely on.
  if (
    selectionState.selectedEntityIds.length === 1
    && selectionState.selectedEntityType !== null
    && !isUnitType(selectionState.selectedEntityType)
  ) {
    return renderSingleSelectionIcon(selectionState.selectedEntityType);
  }

  const unitsById = new Map(economyState.units.map((unit) => [unit.id, unit]));
  const sheepById = new Map(
    economyState.resources
      .filter((resource) => resource.resourceType === 'sheep')
      .map((resource) => [resource.id, resource] as const),
  );
  const counts = new Map<MultiSelectionIconKind, number>();
  const orderedTypes: MultiSelectionIconKind[] = [];

  for (const id of selectionState.selectedEntityIds) {
    const unit = unitsById.get(id);
    const kind: MultiSelectionIconKind | null = unit
      ? unit.unitType
      : sheepById.has(id)
        ? 'sheep'
        : null;
    if (!kind) {
      continue;
    }

    if (!counts.has(kind)) {
      orderedTypes.push(kind);
      counts.set(kind, 0);
    }

    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }

  if (orderedTypes.length === 0) {
    if (selectionState.selectedCount === 1) {
      return renderSingleSelectionIcon(selectionState.selectedEntityType);
    }

    const fallbackKind: MultiSelectionIconKind | null = isUnitType(selectionState.selectedEntityType)
      ? selectionState.selectedEntityType
      : selectionState.selectedEntityType === 'sheep'
        ? 'sheep'
        : null;
    if (!fallbackKind) {
      return '';
    }

    orderedTypes.push(fallbackKind);
    counts.set(fallbackKind, Math.max(selectionState.selectedCount, 1));
  }

  const isSingleEntrySelection =
    selectionState.selectedEntityIds.length === 1
    && orderedTypes.length === 1
    && (counts.get(orderedTypes[0]) ?? 0) === 1;

  if (isSingleEntrySelection) {
    const kind = orderedTypes[0];
    return `
      <div
        class="hud-selection-unit-list"
        data-selection-unit-icons
        style="--unit-icon-accent: ${formatEntityIconAccent(kind)}"
      >
        <div
          class="hud-selection-unit-chip"
          data-selection-unit-chip="${kind}"
          style="--unit-icon-accent: ${formatEntityIconAccent(kind)}"
        >
          <div class="hud-selection-unit-badge" data-selection-unit-icon="${kind}">
            ${formatEntityIcon(kind)}
          </div>
          <div class="hud-selection-unit-meta">
            <div class="hud-selection-unit-label" data-selection-unit-label="${kind}">
              ${formatEntityName(kind)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  const chips = orderedTypes
    .map((kind) => {
      const count = counts.get(kind) ?? 1;
      const label = formatEntityName(kind);
      const countMarkup =
        count > 1
          ? `<div class="hud-selection-unit-count" data-selection-unit-count="${kind}">x${count}</div>`
          : '';
      return `
        <div
          class="hud-selection-unit-chip hud-selection-unit-chip--compact"
          data-selection-unit-chip="${kind}"
          data-tooltip="${label}"
          style="--unit-icon-accent: ${formatEntityIconAccent(kind)}"
        >
          <div class="hud-selection-unit-badge" data-selection-unit-icon="${kind}">
            ${formatEntityIcon(kind)}
          </div>
          ${countMarkup}
        </div>
      `;
    })
    .join('');

  return `<div class="hud-selection-unit-list hud-selection-unit-list--compact" data-selection-unit-icons>${chips}</div>`;
}

function renderSelectionDetail(
  key: 'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  label: string,
  value: string,
): string {
  const tooltip = SELECTION_DETAIL_TOOLTIPS[key];
  return `
    <div class="hud-selection-detail" data-selection-detail="${key}" data-tooltip="${tooltip}">
      <div class="hud-selection-detail-label">${label}</div>
      <div class="hud-selection-detail-value" data-selection-detail-value="${key}">${value}</div>
    </div>
  `;
}

function formatActivityLabel(activity: NonNullable<SelectionState['activity']>): string {
  const verbDisplay: Record<string, string> = {
    'gathering': 'Gathering',
    'dropping off': 'Dropping off',
    'moving': 'Moving',
    'attacking': 'Attacking',
    'building': 'Building',
    'healing': 'Healing',
    'converting': 'Converting',
    'retrieving': 'Retrieving relic',
    'carrying': 'Carrying relic',
    'packing': 'Packing',
    'unpacking': 'Unpacking',
    'training': 'Training',
    'researching': 'Researching',
    'under construction': 'Under construction',
    'idle': 'Idle',
  };
  const verbDisplay_ = verbDisplay[activity.verb] ?? 'Idle';
  if (!activity.target) return verbDisplay_;
  if (activity.target.kind === 'economy-resource') {
    return `${verbDisplay_} ${activity.target.type}`;
  }
  if (activity.target.kind === 'technology') {
    return `${verbDisplay_} ${formatTechnologyName(activity.target.type as ResearchableTechnologyType)}`;
  }
  return `${verbDisplay_} ${formatEntityName(activity.target.type as SelectionState['selectedEntityType'])}`;
}

function renderSelectionActivity(selectionState: SelectionState): string {
  const a = selectionState.activity;
  if (a) {
    const text = formatActivityLabel(a);
    return `<div class="hud-selection-activity" data-selection-activity>${text}</div>`;
  }
  const breakdown = selectionState.activityBreakdown;
  if (breakdown && breakdown.entries.length > 0) {
    const tokens = breakdown.entries.map((e) => `${e.count} ${e.label}`);
    if (breakdown.overflow > 0) tokens.push('…');
    return `<div class="hud-selection-activity" data-selection-activity-multi>${tokens.join(' · ')}</div>`;
  }
  return '';
}

function renderSelectionDetails(selectionState: SelectionState): string {
  const details: string[] = [];

  if (selectionState.health) {
    details.push(
      renderSelectionDetail(
        'health',
        'Health',
        `${selectionState.health.current} / ${selectionState.health.max}`,
      ),
    );
  }

  if (selectionState.attack !== null) {
    details.push(renderSelectionDetail('attack', 'Attack', String(selectionState.attack)));
  }

  if (selectionState.armor !== null) {
    details.push(renderSelectionDetail('armor', 'Armor', String(selectionState.armor)));
  }

  if (selectionState.faction) {
    details.push(renderSelectionDetail('faction', 'Faction', selectionState.faction));
  }

  if (selectionState.civ) {
    details.push(renderSelectionDetail('civ', 'Civ', selectionState.civ));
  }

  if (selectionState.inventory) {
    details.push(renderSelectionDetail('inventory', 'Inventory', selectionState.inventory));
  }

  if (details.length === 0) {
    return '';
  }

  return `<div class="hud-selection-details" data-selection-details>${details.join('')}</div>`;
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
