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
  const selectionKey = (): string => bridgeRef().getSelectionState().selectedEntityIds.join(',');
  // The villager's open build page, for the selection that opened it.
  let openPage: { page: BuildPageId; selection: string } | null = null;

  // A click on a page tab opens that page for the keys, as DE's button does,
  // and a click on a building closes it, as choosing one by key does.
  // Capture phase: a button's own handler redraws the panel, which detaches
  // the button from it before the click could bubble up here.
  const onTabClick = (event: MouseEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(`${SELECTION_PANEL} [data-command^="build-"]`)) openPage = null;
    const tab = target?.closest(`${SELECTION_PANEL} ${PAGE_TAB}`);
    const page = tab instanceof HTMLButtonElement ? tab.dataset.buildPage : undefined;
    if (isBuildPageId(page)) openPage = { page, selection: selectionKey() };
  };
  hudRoot.addEventListener('click', onTabClick, true);

  const pressVillagerKey = (panel: Element, key: GridKey): void => {
    const selection = selectionKey();
    // Another selection, or a panel no longer showing the page (it reopens a
    // reselected villager on its first page), closes it.
    const shownTab = openPage ? panel.querySelector(`button[data-build-page="${openPage.page}"]`) : null;
    if (openPage?.selection !== selection || shownTab?.getAttribute('aria-pressed') !== 'true') openPage = null;
    if (!openPage) {
      const page = (Object.keys(BUILD_PAGE_KEYS) as BuildPageId[]).find((id) => BUILD_PAGE_KEYS[id] === key);
      const tab = page ? panel.querySelector<HTMLButtonElement>(`button[data-build-page="${page}"]`) : null;
      if (!page || !tab || tab.disabled) return;
      if (tab.getAttribute('aria-pressed') !== 'true') tab.click();
      openPage = { page, selection };
      return;
    }
    const { page } = openPage;
    const card = [...panel.querySelectorAll<HTMLButtonElement>('[data-command^="build-"]')].find((button) => {
      const slot = VILLAGER_BUILD_SLOTS[button.dataset.command?.slice('build-'.length) as BuildableBuildingType];
      return slot?.page === page && slot.key === key;
    });
    // An empty slot leaves the page open, as an empty slot of DE's grid does.
    if (!card) return;
    openPage = null;
    card.click();
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
  return () => { hudRoot.removeEventListener('click', onTabClick, true); };
}
