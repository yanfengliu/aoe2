// The CIVILIZATIONS compendium (spec §11.14): what separates the thirty
// civilizations, side by side, in the middle of a match.
//
// It answers a comparison rather than a lookup, so the default view is ALL of
// them at once — one row each, archetype and unique unit and team bonus — and a
// row expands in place for its full bonus list. The alternative, a picker that
// shows one civilization at a time, makes the player hold the other twenty-nine
// in their head, which is the thing they opened this to avoid.
//
// The search box reads every line, bonuses included, because "how do they
// differ" is usually asked as "which of them do X".
//
// Model in `civCompendiumModel.ts`; this file is the panel only.

import {
  buildCivCompendium,
  filterCivCompendium,
  type CivCompendiumEntry,
  type CivFeature,
} from './civCompendiumModel';
import { escapeHtml } from '../utils/escapeHtml';

function renderFeatures(features: readonly CivFeature[]): string {
  if (features.length === 0) return '<span class="civ-compendium__none">—</span>';
  return features.map((feature) => `<span
      class="civ-compendium__feature${feature.live ? '' : ' civ-compendium__feature--absent'}"
      ${feature.live ? '' : 'data-civ-absent="true"'}
      title="${escapeHtml(feature.name)}${feature.live ? '' : ' — not in the game yet'}"
    >${escapeHtml(feature.name)}</span>`).join('');
}

function renderBonusList(lines: readonly string[]): string {
  if (lines.length === 0) return '';
  return `<ul class="civ-compendium__bonuses">${lines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join('')}</ul>`;
}

function renderRow(entry: CivCompendiumEntry, yours: boolean, expanded: boolean): string {
  const classes = ['civ-compendium__row'];
  if (yours) classes.push('civ-compendium__row--yours');
  if (expanded) classes.push('civ-compendium__row--expanded');
  return `<div
      class="${classes.join(' ')}"
      data-civ-row="${escapeHtml(entry.name)}"
      ${entry.fullyImplemented ? '' : 'data-civ-partial="true"'}
    >
      <button type="button" class="civ-compendium__summary" data-civ-toggle="${escapeHtml(entry.name)}"
        aria-expanded="${expanded ? 'true' : 'false'}">
        <span class="civ-compendium__name">${escapeHtml(entry.name)}${
  yours ? '<span class="civ-compendium__yours">yours</span>' : ''
}${
  entry.fullyImplemented ? '' : '<span class="civ-compendium__partial" title="Some of this civilization is not in the game yet">partial</span>'
}</span>
        <span class="civ-compendium__army">${escapeHtml(entry.armyType)}</span>
        <span class="civ-compendium__uniques">${renderFeatures(entry.uniqueUnits)}</span>
        <span class="civ-compendium__team">${escapeHtml(entry.teamBonuses.join(' · '))}</span>
      </button>
      ${expanded ? `<div class="civ-compendium__detail">
        <div class="civ-compendium__detail-row"><span class="civ-compendium__label">Expansion</span><span>${escapeHtml(entry.expansion)}</span></div>
        <div class="civ-compendium__detail-row"><span class="civ-compendium__label">Unique tech</span><span>${renderFeatures(entry.uniqueTechnologies)}</span></div>
        <div class="civ-compendium__detail-row"><span class="civ-compendium__label">Civ bonuses</span><span>${renderBonusList(entry.civilizationBonuses)}</span></div>
      </div>` : ''}
    </div>`;
}

export interface CivCompendiumHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function createCivCompendium(
  hudRoot: HTMLElement,
  deps: { getCivilization: () => string },
): CivCompendiumHandle {
  const host = document.createElement('div');
  host.className = 'civ-compendium';
  host.dataset.hud = 'civ-compendium';
  host.hidden = true;
  hudRoot.appendChild(host);

  const entries = buildCivCompendium();
  let open = false;
  let query = '';
  let expanded: string | null = null;

  function renderRows(): string {
    const yours = deps.getCivilization();
    const shown = filterCivCompendium(entries, query);
    if (shown.length === 0) {
      return `<div class="civ-compendium__empty">No civilization matches “${escapeHtml(query.trim())}”. The search reads names, army types, unique units and technologies, and every bonus line.</div>`;
    }
    return shown.map((entry) => renderRow(entry, entry.name === yours, entry.name === expanded)).join('');
  }

  function paintRows(): void {
    const list = host.querySelector('[data-hud="civ-compendium-list"]');
    if (list) list.innerHTML = renderRows();
  }

  function render(): void {
    const yours = deps.getCivilization();
    host.innerHTML = `
      <div class="civ-compendium__backdrop" data-hud="civ-compendium-backdrop"></div>
      <div class="civ-compendium__panel" role="dialog" aria-label="Civilizations">
        <div class="civ-compendium__header">
          <span class="civ-compendium__title">Civilizations</span>
          <input type="search" class="civ-compendium__search" data-hud="civ-compendium-search"
            placeholder="Search bonuses, units, army types…" aria-label="Search civilizations"
            value="${escapeHtml(query)}" />
          <button type="button" class="civ-compendium__close" data-hud="civ-compendium-close"
            aria-label="Close civilizations">✕</button>
        </div>
        <div class="civ-compendium__legend">You are playing <strong>${escapeHtml(yours)}</strong>. Pick a row for its full bonuses. A struck-through name is <em>not in the game yet</em>.</div>
        <div class="civ-compendium__head">
          <span>Civilization</span><span>Army</span><span>Unique unit</span><span>Team bonus</span>
        </div>
        <div class="civ-compendium__list" data-hud="civ-compendium-list">${renderRows()}</div>
      </div>`;
    host.querySelector('[data-hud="civ-compendium-close"]')?.addEventListener('click', closePanel);
    host.querySelector('[data-hud="civ-compendium-backdrop"]')?.addEventListener('click', closePanel);
    const search = host.querySelector<HTMLInputElement>('[data-hud="civ-compendium-search"]');
    search?.addEventListener('input', () => {
      query = search.value;
      // Only the list is repainted, so the caret and the focus stay where the
      // player put them — re-rendering the whole panel on every keystroke
      // would take the focus off the box they are still typing in.
      paintRows();
    });
    host.addEventListener('click', (event) => {
      const target = (event.target as HTMLElement | null)?.closest('[data-civ-toggle]');
      if (!(target instanceof HTMLElement)) return;
      const name = target.dataset.civToggle ?? null;
      expanded = expanded === name ? null : name;
      paintRows();
    });
  }

  function openPanel(): void {
    if (open) return;
    open = true;
    render();
    host.hidden = false;
    host.querySelector<HTMLInputElement>('[data-hud="civ-compendium-search"]')?.focus();
  }
  function closePanel(): void {
    if (!open) return;
    open = false;
    host.hidden = true;
  }
  return {
    open: openPanel,
    close: closePanel,
    toggle: () => (open ? closePanel() : openPanel()),
    isOpen: () => open,
    destroy: () => { host.remove(); },
  };
}
