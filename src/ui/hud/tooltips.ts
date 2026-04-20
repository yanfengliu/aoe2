import type {
  ActionType,
  BuildableBuildingType,
  MarketActionType,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../game/simulation/types';

// Slice 11: tooltip copy lives next to the chip definition so the HUD renders
// a single source of truth. The data-tooltip attribute is read on hover and
// reflected into the single shared tooltip element.
export const HUD_CHIP_TOOLTIPS: Record<string, string> = {
  food: 'Food stockpile. Farms, hunting, sheep, and berries feed villagers and soldiers.',
  wood: 'Wood stockpile. Cut by villagers at forests and returned to Lumber Camps.',
  gold: 'Gold stockpile. Mined from gold deposits and earned through trade and relics.',
  stone: 'Stone stockpile. Mined from stone deposits; required for Town Centers, walls, and Castles.',
  age: 'Current age. Research the next age at a Town Center to unlock new units and buildings.',
  pop: 'Population used out of the current cap. Build Houses or Town Centers to raise the cap.',
  time: 'Elapsed match time (minutes:seconds).',
  countdown: 'A victory countdown is active. If it finishes without interruption the holder wins.',
};

// Slice 11: per-selection-detail hover copy. The detail row keys are the
// six render slots in the selection panel (health / attack / armor /
// faction / civ / inventory).
export const SELECTION_DETAIL_TOOLTIPS: Record<
  'health' | 'attack' | 'armor' | 'faction' | 'civ' | 'inventory',
  string
> = {
  health: 'Current hit points and maximum hit points.',
  attack: 'Attack damage per strike before bonuses and armor.',
  armor: 'Damage reduction from incoming attacks.',
  faction: 'Group the entity belongs to (player, enemy, neutral).',
  civ: 'Civilization bonuses and unique units that apply.',
  inventory: 'Resources currently carried by the unit.',
};

// Slice 11: command-button tooltip factories. Each returns a short hover
// blurb suitable for rendering via data-tooltip on the corresponding
// command button. The HUD renders one <button> per option and surfaces
// the tooltip copy through the shared tooltip element on hover.
export function formatActionTooltip(actionType: ActionType): string {
  switch (actionType) {
    case 'ungarrison':
      return 'Empty the building of all garrisoned units.';
  }
}

export function formatMarketActionTooltip(actionType: MarketActionType): string {
  switch (actionType) {
    case 'buy-food':
      return 'Buy food with gold at the current market rate.';
    case 'sell-food':
      return 'Sell food for gold at the current market rate.';
    case 'buy-wood':
      return 'Buy wood with gold at the current market rate.';
    case 'sell-wood':
      return 'Sell wood for gold at the current market rate.';
    case 'buy-stone':
      return 'Buy stone with gold at the current market rate.';
    case 'sell-stone':
      return 'Sell stone for gold at the current market rate.';
  }
}

export function formatTrainTooltip(
  unitType: TrainableUnitType,
  unitDisplayName: string,
): string {
  return `Queue a ${unitDisplayName} at this building. Requires the unit's cost and an open production queue slot.`;
}

export function formatResearchTooltip(
  technologyType: ResearchableTechnologyType,
  techDisplayName: string,
): string {
  return `Research ${techDisplayName}. Consumes its resource cost while the research ticks down.`;
}

export function formatBuildTooltip(
  buildingType: BuildableBuildingType,
  buildingDisplayName: string,
): string {
  return `Place a ${buildingDisplayName} foundation. The selected villager walks to the site and begins construction.`;
}

export interface TooltipHandle {
  // Cleanup hook for tests / future teardown. Currently a no-op because
  // the event listeners live on the root element, which the HUD owns.
  destroy(): void;
}

// Slice 11: lightweight tooltip mechanism. Any descendant of `root` with a
// `data-tooltip` attribute surfaces its copy in `tooltipElement` on
// pointerenter and hides it on pointerleave. Event delegation on the
// root keeps us cheap even when the selection panel re-renders.
export function createTooltipController(
  root: HTMLElement,
  tooltipElement: HTMLElement | null,
): TooltipHandle {
  if (!tooltipElement) {
    return { destroy: () => {} };
  }

  function positionTooltip(target: Element): void {
    const tooltip = tooltipElement;
    if (!tooltip) {
      return;
    }
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let left = rect.left + rect.width * 0.5 - tooltipRect.width * 0.5;
    let top = rect.top - tooltipRect.height - margin;
    if (top < margin) {
      top = rect.bottom + margin;
    }
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltipFor(target: Element, text: string): void {
    const tooltip = tooltipElement;
    if (!tooltip || text.trim().length === 0) {
      return;
    }
    tooltip.textContent = text;
    tooltip.dataset.hudTooltipActive = 'true';
    tooltip.setAttribute('aria-hidden', 'false');
    positionTooltip(target);
  }

  function hideTooltip(): void {
    const tooltip = tooltipElement;
    if (!tooltip) {
      return;
    }
    tooltip.dataset.hudTooltipActive = 'false';
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.textContent = '';
  }

  const onPointerOver = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    const text = host.getAttribute('data-tooltip') ?? '';
    showTooltipFor(host, text);
  };

  const onPointerOut = (event: PointerEvent): void => {
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    if (related && host.contains(related)) {
      return;
    }
    hideTooltip();
  };

  const onFocusOut = (): void => {
    hideTooltip();
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerout', onPointerOut);
  root.addEventListener('focusout', onFocusOut);

  return {
    destroy: () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      root.removeEventListener('focusout', onFocusOut);
    },
  };
}
