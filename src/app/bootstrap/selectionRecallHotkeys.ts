// Selection-recall hotkeys (extracted from createApp for the 500-line cap):
// the idle-villager '.' cycle, Delete, ',', DE's control groups
// (controlGroupHotkeys.ts), and H and the other go-to keys
// (goToBuildingHotkeys.ts).

import type { HotkeyHandler, HotkeySpec } from '../../game/control/HotkeyRegistry';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { registerControlGroupHotkeys } from './controlGroupHotkeys';
import { registerGoToBuildingHotkeys } from './goToBuildingHotkeys';
import { centreOnObject, type CentringViewLike } from './goToObject';

interface HotkeyRegistryLike {
  register(spec: HotkeySpec, handler: HotkeyHandler): void;
}

function centerOnPrimarySelection(bridge: SimulationBridge, view: CentringViewLike): void {
  centreOnObject(bridge, view, bridge.getSelectionState().selectedEntityId);
}

export function registerSelectionRecallHotkeys(
  hotkeyRegistry: HotkeyRegistryLike,
  // A GETTER, not the bridge: createApp swaps the bridge on save-load, and a
  // captured reference would leave every hotkey bound to the dead world.
  bridgeRef: () => SimulationBridge,
  view: CentringViewLike,
): () => void {
  // The idle villager bell (v0.3.103): '.' or the bottom-left button selects
  // the next standing-around villager (round-robin) and centres the camera.
  const selectNextIdleVillagerAndCenter = (): void => {
    if (!bridgeRef().selectNextIdleVillager()) return;
    centerOnPrimarySelection(bridgeRef(), view);
  };
  hotkeyRegistry.register({ key: '.' }, selectNextIdleVillagerAndCenter);
  // Control groups (v0.3.104; DE's twenty and their keys since work 142).
  registerControlGroupHotkeys(hotkeyRegistry, bridgeRef, view);
  // The Delete key (v0.3.114): remove the primary selected own entity —
  // AoE2's own affordance for freeing population or clearing a misbuild.
  hotkeyRegistry.register({ key: 'Delete' }, () => {
    bridgeRef().deleteSelectedEntity();
  });
  // Shift+Delete (work 142): DE's DELETE_UNITS (19036, "Delete All Selected
  // Units"), every selected entity of the player's; Delete is DELETE_UNIT.
  hotkeyRegistry.register({ key: 'Delete', shift: true }, () => {
    bridgeRef().deleteSelectedEntities();
  });
  // ',' (v0.3.155): the idle-MILITARY cycle, DE's companion to '.'.
  hotkeyRegistry.register({ key: ',' }, () => {
    if (!bridgeRef().selectNextIdleMilitary()) return;
    centerOnPrimarySelection(bridgeRef(), view);
  });
  // H and DE's go-to and select-all building keys (work 142).
  registerGoToBuildingHotkeys(hotkeyRegistry, bridgeRef, view);
  return selectNextIdleVillagerAndCenter;
}
