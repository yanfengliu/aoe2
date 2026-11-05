// Selection-recall hotkeys (extracted from createApp for the 500-line cap):
// the idle-villager '.' cycle and the v0.3.104 control-group trio — Ctrl+digit
// binds, digit recalls survivors, a quick second tap centres the camera.

import type { HotkeyHandler, HotkeySpec } from '../../game/control/HotkeyRegistry';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { centreOnObject, type CentringViewLike } from './goToObject';

/** A second tap of the same group key inside this window centres the camera.
 *  Measured between the two keydowns' own `timeStamp`s, never on a clock read
 *  in the handler: a slow frame between two quick taps delays the second one's
 *  handling, and the game used to read that as a slow second tap (2026-09-23,
 *  tests/browser/control-group-double-tap.spec.ts). */
export const CONTROL_GROUP_DOUBLE_TAP_MS = 450;

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
  // Control groups (v0.3.104): AoE2's own three-part gesture.
  let lastRecall = { digit: -1, atMs: 0 };
  for (let digit = 1; digit <= 9; digit += 1) {
    hotkeyRegistry.register({ key: String(digit), ctrl: true }, () => {
      bridgeRef().assignControlGroup(digit);
    });
    hotkeyRegistry.register({ key: String(digit) }, (event) => {
      if (!bridgeRef().recallControlGroup(digit)) return;
      const tappedAt = event.timeStamp;
      if (lastRecall.digit === digit && tappedAt - lastRecall.atMs < CONTROL_GROUP_DOUBLE_TAP_MS) {
        centerOnPrimarySelection(bridgeRef(), view);
      }
      lastRecall = { digit, atMs: tappedAt };
    });
  }
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
  // 'H' (v0.3.155): select the Town Center and centre on it — DE's most-used
  // economy key. Repeated presses cycle multiple TCs round-robin.
  let lastTownCenterId = -1;
  hotkeyRegistry.register({ key: 'h' }, () => {
    const bridge = bridgeRef();
    const centers = bridge.getEconomyState().buildings
      .filter((b) => b.owner === 1 && b.buildingType === 'town-center')
      .sort((a, b) => a.id - b.id);
    if (centers.length === 0) return;
    const next = centers.find((c) => c.id > lastTownCenterId) ?? centers[0]!;
    lastTownCenterId = next.id;
    if (bridge.selectEntityById(next.id)) centreOnObject(bridge, view, next.id);
  });
  return selectNextIdleVillagerAndCenter;
}
