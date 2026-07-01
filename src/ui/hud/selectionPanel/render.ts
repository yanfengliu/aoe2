// Selection-panel HTML render helpers extracted from selectionPanel.ts
// to keep both files under 500 LOC. The parent file consumes
// renderSelectionIcons, renderSelectionActivity, renderSelectionDetails;
// the rest is private to this module.

import type {
  EconomyState,
  ResearchableTechnologyType,
  SelectionState,
  UnitType,
} from '../../../game/simulation/types';
import {
  formatEntityIcon,
  formatEntityIconAccent,
  formatEntityName,
  formatTechnologyName,
  isUnitType,
} from '../displayNames';
import { selectionGlyph } from '../icons/unitGlyphs';
import { SELECTION_DETAIL_TOOLTIPS } from '../tooltips';

// Types that can appear as first-class entries in the multi-select icon
// grid. Owned sheep live in `economyState.resources`, not `.units`, but
// they share the player-commandable multi-selection contract with units,
// so the icon grid treats them as siblings.
type MultiSelectionIconKind = UnitType | 'sheep';

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
        ${selectionGlyph(entityType)}
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
  // Lazy-built lookup of sheep entity ids — only needed when a selected
  // id misses `unitsById`. `economyState.resources` can hold hundreds of
  // entries mid/late game, and this function runs on every HUD-affecting
  // update, so we avoid the unconditional filter+map pass when the
  // selection is unit-only.
  let sheepIdsCache: Set<number> | null = null;
  const sheepIds = (): Set<number> => {
    if (sheepIdsCache !== null) {
      return sheepIdsCache;
    }
    sheepIdsCache = new Set();
    for (const resource of economyState.resources) {
      if (resource.resourceType === 'sheep') {
        sheepIdsCache.add(resource.id);
      }
    }
    return sheepIdsCache;
  };
  const counts = new Map<MultiSelectionIconKind, number>();
  const orderedTypes: MultiSelectionIconKind[] = [];

  for (const id of selectionState.selectedEntityIds) {
    const unit = unitsById.get(id);
    const kind: MultiSelectionIconKind | null = unit
      ? unit.unitType
      : sheepIds().has(id)
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
          ${selectionGlyph(kind)}
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
          ${selectionGlyph(kind)}
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
  key: 'health' | 'attack' | 'armor' | 'pierce-armor' | 'faction' | 'civ' | 'inventory',
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

export function renderSelectionActivity(selectionState: SelectionState): string {
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

export function renderSelectionDetails(selectionState: SelectionState): string {
  const details: string[] = [];

  if (selectionState.health) {
    details.push(
      renderSelectionDetail(
        'health',
        'Health',
        `${Math.floor(selectionState.health.current)} / ${selectionState.health.max}`,
      ),
    );
  }

  if (selectionState.attack !== null) {
    details.push(renderSelectionDetail('attack', 'Attack', String(selectionState.attack)));
  }

  if (selectionState.armor !== null) {
    details.push(renderSelectionDetail('armor', 'Melee armor', String(selectionState.armor)));
  }
  if (selectionState.pierceArmor !== null) {
    details.push(
      renderSelectionDetail('pierce-armor', 'Pierce armor', String(selectionState.pierceArmor)),
    );
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
