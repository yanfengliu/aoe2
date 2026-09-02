import { effectiveConstructionCost } from '../../game/simulation/civBonusEffects';
import type {
  ActionType,
  BuildableBuildingType,
  MarketActionType,
  PlayerResources,
  ResearchableTechnologyType,
  TrainableUnitType,
} from '../../game/simulation/types';
import {
  researchCost,
  researchTimeTicks,
  trainingCost,
} from '../../game/simulation/prototypeEconomyRules';

// A short, human-readable cost like "60 food, 20 gold" from a partial resource
// cost, listing only the non-zero resources in a stable food/wood/gold/stone
// order. "nothing" for an empty cost (defensive — no shippable content is free).
export function formatResourceCost(cost: Partial<PlayerResources>): string {
  const order: (keyof PlayerResources)[] = ['food', 'wood', 'gold', 'stone'];
  const parts = order
    .filter((key) => (cost[key] ?? 0) > 0)
    .map((key) => `${cost[key]} ${key}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

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
// render slots in the selection panel (health / attack / melee armor /
// pierce armor / faction / civ / inventory).
export const SELECTION_DETAIL_TOOLTIPS: Record<
  'health' | 'attack' | 'armor' | 'pierce-armor' | 'faction' | 'civ' | 'inventory',
  string
> = {
  health: 'Current hit points and maximum hit points.',
  attack: 'Attack damage per strike before bonuses and armor.',
  armor: 'Melee damage reduction (armor-upgrade bonus).',
  'pierce-armor': 'Pierce damage reduction (armor-upgrade bonus). Top-tier armor and Loom add +2.',
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
    case 'ring-town-bell':
      return 'Send every villager to the nearest shelter with room.';
    case 'back-to-work':
      return 'Release sheltering villagers back to their tasks.';
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
  return `Queue a ${unitDisplayName} at this building. Cost: ${formatResourceCost(trainingCost(unitType))}. Needs an open production queue slot.`;
}

export function formatResearchTooltip(
  technologyType: ResearchableTechnologyType,
  techDisplayName: string,
): string {
  const seconds = Math.round(researchTimeTicks(technologyType) / 10);
  if (technologyType === 'spies') {
    // The one dynamically-priced technology: the table's 200 gold is only the
    // floor, so a static figure here would under-quote every real charge.
    return `Research ${techDisplayName}. Cost: 200 gold per enemy villager (halved by Atheism); takes ${seconds}s.`;
  }
  return `Research ${techDisplayName}. Cost: ${formatResourceCost(researchCost(technologyType))}; takes ${seconds}s.`;
}

export function formatBuildTooltip(
  buildingType: BuildableBuildingType,
  buildingDisplayName: string,
  cost?: Partial<import('../../game/simulation/types').PlayerResources>,
): string {
  const shown = cost ?? effectiveConstructionCost(undefined, buildingType);
  return `Place a ${buildingDisplayName} foundation (cost: ${formatResourceCost(shown)}). The selected villager walks to the site and builds it.`;
}

export interface TooltipHandle {
  // Cleanup hook for tests and HUD teardown.
  destroy(): void;
}

let nextTooltipId = 0;

// Slice 11: lightweight tooltip mechanism. Any descendant of `root` with a
// `data-tooltip` attribute surfaces its copy in `tooltipElement` on
// pointerenter or keyboard focus and hides it on pointerleave/focusout.
// Event delegation on the root keeps us cheap even when the selection
// panel re-renders.
export function createTooltipController(
  root: HTMLElement,
  tooltipElement: HTMLElement | null,
): TooltipHandle {
  if (!tooltipElement) {
    return { destroy: () => {} };
  }

  const tooltipId = tooltipElement.id || `hud-tooltip-${nextTooltipId += 1}`;
  tooltipElement.id = tooltipId;
  let pointerHost: Element | null = null;
  let focusHost: Element | null = null;
  let describedHost: Element | null = null;
  // Whether the focus that is about to land was put there by a POINTER. A
  // click focuses the button it pressed, and a tooltip owned by that focus
  // outlives the pointer: "Place a House foundation…" stayed over the bar
  // while the player was already out on the map choosing the tile (play-test
  // finding F6, 2026-09-02). DE hides a tooltip when the cursor leaves the
  // button, and a keyboard user still needs one — so only a focus the player
  // reached with the KEYBOARD owns a tooltip. Sticky until the next key,
  // because the selection panel re-renders after a click and restores focus
  // programmatically a frame later.
  // Which CONTROL the pointer last pressed, by its logical id rather than by
  // element identity: the panel re-renders after a click and restores focus to
  // a NEW button carrying the same `data-command`, so an object comparison
  // suppresses the tooltip for one frame and hands it straight back.
  //
  // Deliberately NOT `:focus-visible`: that reads the element's live focus
  // state, and a synthetic `focusin` (the shape every unit test of this
  // controller has) does not focus anything, so the check would answer "not
  // keyboard" for every test and "keyboard" for nothing.
  //
  // Deliberately NOT cleared by a keystroke either: any key would do it, and
  // the panel's own re-render then re-focused the clicked card with the claim
  // released — so pressing a camera key after clicking a card put its tooltip
  // back over the world with the cursor 500px away. The claim is released when
  // focus lands on a DIFFERENT control, which is what a Tab does.
  let pointerPressedKey: string | null = null;

  function tooltipHostKey(host: Element): string {
    return host.getAttribute('data-command')
      ?? host.getAttribute('data-build-page')
      ?? host.getAttribute('data-tooltip')
      ?? '';
  }

  function clearTooltipDescription(): void {
    if (!describedHost) {
      return;
    }
    const remainingIds = (describedHost.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id.length > 0 && id !== tooltipId);
    if (remainingIds.length > 0) {
      describedHost.setAttribute('aria-describedby', remainingIds.join(' '));
    } else {
      describedHost.removeAttribute('aria-describedby');
    }
    describedHost = null;
  }

  function describeTooltipFor(target: Element): void {
    if (describedHost !== target) {
      clearTooltipDescription();
      describedHost = target;
    }
    const descriptionIds = (target.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id.length > 0);
    if (!descriptionIds.includes(tooltipId)) {
      target.setAttribute('aria-describedby', [...descriptionIds, tooltipId].join(' '));
    }
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
    const menuPanel = target.closest('.hud-game-menu__panel');
    let left: number;
    let top: number;
    if (menuPanel) {
      const panelRect = menuPanel.getBoundingClientRect();
      const rightSpace = viewportWidth - panelRect.right - margin;
      const leftSpace = panelRect.left - margin;
      if (rightSpace >= tooltipRect.width) {
        left = panelRect.right + margin;
        top = rect.top + rect.height * 0.5 - tooltipRect.height * 0.5;
      } else if (leftSpace >= tooltipRect.width) {
        left = panelRect.left - tooltipRect.width - margin;
        top = rect.top + rect.height * 0.5 - tooltipRect.height * 0.5;
      } else {
        left = panelRect.left + panelRect.width * 0.5 - tooltipRect.width * 0.5;
        top = panelRect.top - tooltipRect.height - margin;
        if (top < margin) {
          top = panelRect.bottom + margin;
        }
      }
    } else {
      left = rect.left + rect.width * 0.5 - tooltipRect.width * 0.5;
      // A control in the bottom command bar gets its tooltip above the BAR,
      // not above the control: the bar is a dense grid of cards under a
      // heading row, and a tooltip above a first-row card covered that row —
      // including the "Placing: …" status the click had just revealed.
      const commandBar = target.closest('.hud-panel--selection');
      const above = commandBar ? commandBar.getBoundingClientRect() : rect;
      top = above.top - tooltipRect.height - margin;
      if (top < margin) {
        top = rect.bottom + margin;
      }
    }
    left = Math.max(margin, Math.min(left, viewportWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, viewportHeight - tooltipRect.height - margin));
    // The minimap is the one HUD surface a tooltip must never cover: it is the
    // player's view of the whole map, and the build palette sits right beside
    // it, so a tooltip centred above a right-hand card ran over its frame
    // (defect register, 2026-09-02). Slide left of the frame; when there is no
    // room on that side, go above it. Not for a tooltip anchored in the game
    // menu: the modal's backdrop covers the minimap, and dodging a surface the
    // player cannot see pushed a menu tooltip onto the modal itself at 390px.
    const minimapPanel = menuPanel ? null : root.querySelector('.hud-panel--map');
    if (minimapPanel && !minimapPanel.contains(target)) {
      const avoid = minimapPanel.getBoundingClientRect();
      const overlapsMinimap = avoid.width > 0 && avoid.height > 0
        && left < avoid.right && avoid.left < left + tooltipRect.width
        && top < avoid.bottom && avoid.top < top + tooltipRect.height;
      if (overlapsMinimap) {
        const leftOfMinimap = avoid.left - tooltipRect.width - margin;
        if (leftOfMinimap >= margin) {
          left = Math.min(left, leftOfMinimap);
        } else {
          top = Math.max(margin, avoid.top - tooltipRect.height - margin);
        }
      }
    }
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
  }

  function showTooltipFor(target: Element, text: string): void {
    const tooltip = tooltipElement;
    if (!tooltip || text.trim().length === 0) {
      hideTooltip();
      return;
    }
    describeTooltipFor(target);
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
    clearTooltipDescription();
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
    pointerHost = host;
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
    if (pointerHost === host) {
      pointerHost = null;
    }
    if (focusHost && root.contains(focusHost)) {
      showTooltipFor(focusHost, focusHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  };

  const onFocusIn = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    if (!host) {
      return;
    }
    if (pointerPressedKey !== null && tooltipHostKey(host) === pointerPressedKey) {
      // A clicked control keeps focus — a player may act on it again from the
      // keyboard — but it does not keep a tooltip. Whatever the pointer is
      // hovering still owns one.
      focusHost = null;
      if (!pointerHost) {
        hideTooltip();
      }
      return;
    }
    // Focus reached a different control, so the keyboard owns tooltips again.
    pointerPressedKey = null;
    focusHost = host;
    const text = host.getAttribute('data-tooltip') ?? '';
    showTooltipFor(host, text);
  };

  const onFocusOut = (event: FocusEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    const related = event.relatedTarget instanceof Element ? event.relatedTarget : null;
    if (!host || (related && host.contains(related))) {
      return;
    }
    if (focusHost === host) {
      focusHost = null;
    }

    if (pointerHost && root.contains(pointerHost)) {
      showTooltipFor(pointerHost, pointerHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  };

  const ownerObserver = new MutationObserver((records) => {
    const changedOutsideTooltip = records.some(
      (record) => record.target !== tooltipElement && !tooltipElement.contains(record.target),
    );
    if (!changedOutsideTooltip) {
      return;
    }
    let ownerDisconnected = false;
    if (pointerHost && !root.contains(pointerHost)) {
      pointerHost = null;
      ownerDisconnected = true;
    }
    if (focusHost && !root.contains(focusHost)) {
      focusHost = null;
      ownerDisconnected = true;
    }
    if (describedHost && !root.contains(describedHost)) {
      ownerDisconnected = true;
    }
    if (!ownerDisconnected) {
      return;
    }
    if (describedHost && root.contains(describedHost)) {
      return;
    }
    if (focusHost) {
      showTooltipFor(focusHost, focusHost.getAttribute('data-tooltip') ?? '');
    } else if (pointerHost) {
      showTooltipFor(pointerHost, pointerHost.getAttribute('data-tooltip') ?? '');
    } else {
      hideTooltip();
    }
  });
  ownerObserver.observe(root, { childList: true, subtree: true });

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    const host = target?.closest('[data-tooltip]');
    // A press somewhere with no tooltip — the map, a panel's background — does
    // not release the claim: the click that ENDS placement is such a press, and
    // releasing it there would let the panel's next re-render hand the card
    // its tooltip back.
    // Touch is exempt: a finger has no hover, so a tap is the ONLY way a touch
    // user can ask what a tile is, and suppressing the focus tooltip there
    // would leave them with an icon and no name at all.
    if (host && event.pointerType !== 'touch') {
      pointerPressedKey = tooltipHostKey(host);
    }
  };

  root.addEventListener('pointerover', onPointerOver);
  root.addEventListener('pointerout', onPointerOut);
  // Watched on the document, not on the HUD: the press that decides whether a
  // focus is a pointer focus can land anywhere on the page.
  document.addEventListener('pointerdown', onPointerDown, true);
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);
  let resizeFrame: number | null = null;
  const repositionActiveTooltip = (): void => {
    if (describedHost && root.contains(describedHost)) {
      positionTooltip(describedHost);
    }
  };
  const repositionAfterResponsiveLayout = (): void => {
    repositionActiveTooltip();
    if (typeof window.requestAnimationFrame !== 'function') {
      return;
    }
    if (resizeFrame !== null) {
      window.cancelAnimationFrame(resizeFrame);
    }
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      repositionActiveTooltip();
    });
  };
  window.addEventListener('resize', repositionAfterResponsiveLayout);
  window.addEventListener('scroll', repositionActiveTooltip, true);

  return {
    destroy: () => {
      root.removeEventListener('pointerover', onPointerOver);
      root.removeEventListener('pointerout', onPointerOut);
      document.removeEventListener('pointerdown', onPointerDown, true);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('resize', repositionAfterResponsiveLayout);
      window.removeEventListener('scroll', repositionActiveTooltip, true);
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = null;
      }
      ownerObserver.disconnect();
      pointerHost = null;
      focusHost = null;
      pointerPressedKey = null;
      hideTooltip();
    },
  };
}
