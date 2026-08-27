// The TECHNOLOGY TREE viewer (spec §11.3, v0.3.157): DE's browse-the-tree
// mental model — buildings section the view, each revealing its trainable
// units and researchable technologies for YOUR civilization, with denied
// content shown as UNAVAILABLE rather than hidden (a hole is information).
// Pure model + a modal panel; the model derives from the same hosting tables
// and `civDenies` the game plays by, so the view can never disagree with the
// validators.

import {
  RESEARCHES_BY_BUILDING,
  TRAINABLE_UNITS_BY_BUILDING,
} from '../../game/simulation/buildingProductionTables';
import { civDenies } from '../../game/simulation/civTechTree';
import { UNIQUE_UNITS_BY_CIVILIZATION, uniqueUnitsFor } from '../../game/simulation/uniqueUnits';
import { uniqueTechnologiesFor, UNIQUE_TECHNOLOGIES } from '../../game/simulation/uniqueTechnologies';
import type { BuildingType, ResearchableTechnologyType, TrainableUnitType } from '../../game/simulation/types';
import { formatTechnologyName } from './displayNames/formatters';
import { formatEntityName } from './displayNames/entityNames';
import { escapeHtml } from '../utils/escapeHtml';

export interface TechTreeItem {
  id: string;
  name: string;
  denied: boolean;
}

export interface TechTreeSection {
  building: BuildingType;
  name: string;
  units: TechTreeItem[];
  technologies: TechTreeItem[];
}

const SECTION_ORDER: readonly BuildingType[] = [
  'town-center', 'barracks', 'archery-range', 'stable', 'siege-workshop',
  'blacksmith', 'market', 'dock', 'university', 'monastery', 'castle',
];

const ALL_UNIQUE_UNIT_IDS = new Set<string>(
  UNIQUE_UNITS_BY_CIVILIZATION.flatMap((entry) => [
    entry.unitType, ...(entry.elite ? [entry.elite[0]] : []),
  ]),
);
const ALL_UNIQUE_TECH_IDS = new Set<string>(
  UNIQUE_TECHNOLOGIES.map((tech) => tech.id as string).concat(
    UNIQUE_UNITS_BY_CIVILIZATION.flatMap((entry) => (entry.elite ? [entry.elite[1] as string] : [])),
  ),
);

export function buildTechTreeModel(civilization: string): TechTreeSection[] {
  const ownUniques = uniqueUnitsFor(civilization);
  const ownUniqueUnitIds = new Set<string>(
    ownUniques.flatMap((entry) => [entry.unitType, ...(entry.elite ? [entry.elite[0]] : [])]),
  );
  const ownUniqueTechIds = new Set<string>(
    uniqueTechnologiesFor(civilization).map((tech) => tech.id as string).concat(
      ownUniques.flatMap((entry) => (entry.elite ? [entry.elite[1] as string] : [])),
    ),
  );
  const showsUnit = (id: string): boolean =>
    !ALL_UNIQUE_UNIT_IDS.has(id) || ownUniqueUnitIds.has(id);
  const showsTech = (id: string): boolean =>
    !ALL_UNIQUE_TECH_IDS.has(id) || ownUniqueTechIds.has(id);

  return SECTION_ORDER.map((building) => {
    const units: TechTreeItem[] = (TRAINABLE_UNITS_BY_BUILDING.get(building) ?? [])
      .filter((unit) => showsUnit(unit))
      .map((unit: TrainableUnitType) => ({
        id: unit,
        name: formatEntityName(unit),
        denied: civDenies(civilization, unit),
      }));
    // The civ's own castle-trained (or monastery-trained) uniques that the
    // static table cannot carry per civ.
    for (const entry of ownUniques) {
      if (entry.trainedAt !== building) continue;
      for (const id of [entry.unitType, ...(entry.elite ? [entry.elite[0]] : [])]) {
        if (!units.some((u) => u.id === id)) {
          units.push({ id, name: formatEntityName(id), denied: false });
        }
      }
    }
    const technologies: TechTreeItem[] = (RESEARCHES_BY_BUILDING.get(building) ?? [])
      .filter((tech) => showsTech(tech))
      .map((tech: ResearchableTechnologyType) => ({
        id: tech,
        name: formatTechnologyName(tech),
        denied: civDenies(civilization, tech),
      }));
    return {
      building,
      name: formatEntityName(building),
      units,
      technologies,
    };
  }).filter((section) => section.units.length > 0 || section.technologies.length > 0);
}

function renderItems(items: TechTreeItem[], kind: 'unit' | 'tech'): string {
  return items.map((item) => `<span
      class="tech-tree__item${item.denied ? ' tech-tree__item--denied' : ''}"
      data-tech-tree-item="${escapeHtml(item.id)}"
      data-tech-tree-kind="${kind}"
      ${item.denied ? 'data-tech-tree-denied="true"' : ''}
      title="${escapeHtml(item.name)}${item.denied ? ' — not available to this civilization' : ''}"
    >${escapeHtml(item.name)}</span>`).join('');
}

export interface TechTreePanelHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  destroy(): void;
}

export function createTechTreePanel(
  hudRoot: HTMLElement,
  deps: { getCivilization: () => string },
): TechTreePanelHandle {
  const host = document.createElement('div');
  host.className = 'tech-tree';
  host.dataset.hud = 'tech-tree-panel';
  host.hidden = true;
  hudRoot.appendChild(host);

  let open = false;
  const render = (): void => {
    const civilization = deps.getCivilization();
    const sections = buildTechTreeModel(civilization);
    host.innerHTML = `
      <div class="tech-tree__backdrop" data-hud="tech-tree-backdrop"></div>
      <div class="tech-tree__panel" role="dialog" aria-label="Technology tree">
        <div class="tech-tree__header">
          <span class="tech-tree__title">Technology Tree — ${escapeHtml(civilization)}</span>
          <button type="button" class="tech-tree__close" data-hud="tech-tree-close" aria-label="Close technology tree">✕</button>
        </div>
        <div class="tech-tree__legend">Dimmed entries are not available to ${escapeHtml(civilization)} — the holes are part of the civilization.</div>
        <div class="tech-tree__sections">
          ${sections.map((section) => `
            <section class="tech-tree__section" data-tech-tree-section="${escapeHtml(section.building)}">
              <h3 class="tech-tree__section-name">${escapeHtml(section.name)}</h3>
              ${section.units.length > 0 ? `<div class="tech-tree__row"><span class="tech-tree__row-label">Units</span>${renderItems(section.units, 'unit')}</div>` : ''}
              ${section.technologies.length > 0 ? `<div class="tech-tree__row"><span class="tech-tree__row-label">Technologies</span>${renderItems(section.technologies, 'tech')}</div>` : ''}
            </section>`).join('')}
        </div>
      </div>`;
    host.querySelector('[data-hud="tech-tree-close"]')?.addEventListener('click', closePanel);
    host.querySelector('[data-hud="tech-tree-backdrop"]')?.addEventListener('click', closePanel);
  };

  function openPanel(): void {
    if (open) return;
    open = true;
    render();
    host.hidden = false;
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
