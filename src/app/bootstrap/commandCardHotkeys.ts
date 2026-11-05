// DE's command-card keys (work 142): a grid key presses the button of the
// selected card that DE puts on that key, so a key does exactly what a click on
// the button does, availability and refusals included. The keys and their
// sources are in `src/ui/hud/commandCardKeys.ts`.
//
// A villager's card is DE's two steps: on its first page Q opens the Economic
// Buildings page and W the Military Buildings page (a click on a page tab
// opens it too), and the next key builds that page's building in its slot.
// Choosing a building, or another selection, returns the card to its first
// page. A key on a card with DE keys that holds no button there does nothing.
//
// Cards without DE keys yet (work 142 M2b) keep this game's older keys: A arms
// attack-move, G attack-ground, and P (not a grid key) patrol everywhere.

import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import type { BuildableBuildingType } from '../../game/simulation/types';
import {
  BUILD_PAGE_KEYS,
  buildingCardKeyOf,
  GRID_KEYS,
  hasBuildingCardKeys,
  VILLAGER_BUILD_SLOTS,
  type GridKey,
} from '../../ui/hud/commandCardKeys';
import { isBuildPageId, type BuildPageId } from '../../ui/hud/selectionPanel/buildPages';

interface HotkeyRegistryLike {
  register(spec: { key: string }, handler: () => void): void;
}

interface GroundOrderViewLike {
  armAttackMove(): void;
  armPatrol(): void;
  armAttackGround(): void;
}

const SELECTION_PANEL = '.hud-panel--selection';
const PAGE_TAB = 'button[data-build-page]';

export function registerCommandCardHotkeys(deps: {
  hotkeyRegistry: HotkeyRegistryLike;
  view: GroundOrderViewLike;
  // A getter: createApp swaps the bridge on save-load.
  bridgeRef: () => SimulationBridge;
  hudRoot: HTMLElement;
  // Redraws the selection panel for the selection now: the HUD redraws it a
  // frame after a click, and a key pressed in between must find the new card.
  syncSelectionPanel: () => void;
}): () => void {
  const { hotkeyRegistry, view, bridgeRef, hudRoot, syncSelectionPanel } = deps;
  // The open page is the PANEL's: the page the player chose on this card
  // (`data-build-page-chosen`), which the panel itself forgets when the
  // selection changes, so a villager selected again opens on its first page.
  // The one thing the panel does not know is that a building was chosen from
  // the page since, which in DE closes it; that is this flag.
  let buildingChosen = false;

  // A click on a page tab opens that page for the keys, as DE's button does,
  // and a click on a building closes it, as choosing one by key does. Capture
  // phase, and the panel redrawn first: a click on a panel still drawn for
  // the selection before must land on the card of the selection now.
  const onPanelClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(SELECTION_PANEL)) return;
    syncSelectionPanel();
    if (target.closest('[data-command^="build-"]')) buildingChosen = true;
    if (target.closest(PAGE_TAB)) buildingChosen = false;
  };
  hudRoot.addEventListener('click', onPanelClick, true);

  const openPageOf = (panel: Element): BuildPageId | null => {
    const group = panel.querySelector<HTMLElement>('[data-command-group="build"]');
    const page = group?.dataset.buildPage;
    return !buildingChosen && group?.dataset.buildPageChosen === 'true' && isBuildPageId(page) ? page : null;
  };

  const pressVillagerKey = (panel: Element, key: GridKey): void => {
    const page = openPageOf(panel);
    if (!page) {
      const opening = (Object.keys(BUILD_PAGE_KEYS) as BuildPageId[]).find((id) => BUILD_PAGE_KEYS[id] === key);
      const tab = opening ? panel.querySelector<HTMLButtonElement>(`button[data-build-page="${opening}"]`) : null;
      // The tab's own click makes the page the chosen one, and the click
      // listener above clears `buildingChosen`.
      if (tab && !tab.disabled) tab.click();
      return;
    }
    const card = [...panel.querySelectorAll<HTMLButtonElement>('[data-command^="build-"]')].find((button) => {
      const slot = VILLAGER_BUILD_SLOTS[button.dataset.command?.slice('build-'.length) as BuildableBuildingType];
      return slot?.page === page && slot.key === key;
    });
    // An empty slot leaves the page open, as an empty slot of DE's grid does.
    card?.click();
  };

  const pressBuildingKey = (panel: Element, buildingType: string, key: GridKey): void => {
    [...panel.querySelectorAll<HTMLButtonElement>('[data-command]')]
      .find((button) => buildingCardKeyOf(buildingType, button.dataset.command ?? '') === key)
      ?.click();
  };

  const legacyKeys: Partial<Record<GridKey, () => void>> = {
    a: () => view.armAttackMove(),
    g: () => view.armAttackGround(),
  };

  for (const key of GRID_KEYS) {
    hotkeyRegistry.register({ key }, () => {
      // Which card answers is the SELECTION's, never the panel's: the panel
      // redraws a frame after a click, so a key pressed in between would
      // otherwise go to the card of the selection before.
      syncSelectionPanel();
      const state = bridgeRef().getSelectionState();
      const panel = hudRoot.querySelector(SELECTION_PANEL);
      // A villager's card: villagers, alone or with their sheep (no shared
      // type then). A Fishing Ship's palette is not a villager's card (M2b).
      const villagerCard = state.buildOptions.length > 0
        && (state.selectedEntityType === 'villager' || state.selectedEntityType === null);
      if (villagerCard) {
        if (panel) pressVillagerKey(panel, key);
        return;
      }
      const type = state.selectedEntityType;
      if (type && hasBuildingCardKeys(type)) {
        if (panel) pressBuildingKey(panel, type, key);
        return;
      }
      legacyKeys[key]?.();
    });
  }
  // M6 control: P arms patrol; the next left click is the far end of the route.
  hotkeyRegistry.register({ key: 'p' }, () => { view.armPatrol(); });
  // The registry's own dispose drops the keys; this drops the tab listener.
  return () => { hudRoot.removeEventListener('click', onPanelClick, true); };
}
