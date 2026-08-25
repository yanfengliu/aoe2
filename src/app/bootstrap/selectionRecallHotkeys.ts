// Selection-recall hotkeys (extracted from createApp for the 500-line cap):
// the idle-villager '.' cycle and the v0.3.104 control-group trio — Ctrl+digit
// binds, digit recalls survivors, a quick second tap centres the camera.

import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';

interface HotkeyRegistryLike {
  register(spec: { key: string; ctrl?: boolean }, handler: () => void): void;
}

interface CameraViewLike {
  centerCameraOnWorldPosition(x: number, y: number): void;
}

function centerOnPrimarySelection(bridge: SimulationBridge, view: CameraViewLike): void {
  const id = bridge.getSelectionState().selectedEntityId;
  const unit = id === null
    ? undefined
    : bridge.getEconomyState().units.find((candidate) => candidate.id === id);
  if (unit) view.centerCameraOnWorldPosition(unit.x + 0.5, unit.y + 0.5);
}

export function registerSelectionRecallHotkeys(
  hotkeyRegistry: HotkeyRegistryLike,
  // A GETTER, not the bridge: createApp swaps the bridge on save-load, and a
  // captured reference would leave every hotkey bound to the dead world.
  bridgeRef: () => SimulationBridge,
  view: CameraViewLike,
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
    hotkeyRegistry.register({ key: String(digit) }, () => {
      if (!bridgeRef().recallControlGroup(digit)) return;
      const now = performance.now();
      if (lastRecall.digit === digit && now - lastRecall.atMs < 450) {
        centerOnPrimarySelection(bridgeRef(), view);
      }
      lastRecall = { digit, atMs: now };
    });
  }
  // The Delete key (v0.3.114): remove the primary selected own entity —
  // AoE2's own affordance for freeing population or clearing a misbuild.
  hotkeyRegistry.register({ key: 'Delete' }, () => {
    bridgeRef().deleteSelectedEntity();
  });
  return selectNextIdleVillagerAndCenter;
}
