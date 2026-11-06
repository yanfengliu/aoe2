// The DE play-feel hotkeys (v0.3.155-156; DE's own keys since work 142),
// extracted from createApp for the 500-line cap: F3 pause, the numpad's + and
// − for game speed, Ctrl+= / Ctrl+− / Ctrl+Backspace for zoom, Space to the
// selected object and Home to the last notification. Each is the `definitive`
// default of the install's `hotkeys.json` (`node scripts/dumpDeHotkeys.mjs`),
// cited in spec §14.2.

import type { HotkeyHandler, HotkeySpec } from '../../game/control/HotkeyRegistry';
import type { SimulationBridge } from '../../game/simulation/createSimulationBridge';
import { INITIAL_CAMERA_ZOOM } from '../../input/voxelCameraController';
import { centreOnObject } from './goToObject';

/** One wheel notch: the wheel zooms by deltaY x 0.001 and a notch is 100
 *  (`voxelPointerInputController.ts`), so Ctrl+= is one notch in. */
export const ZOOM_KEY_STEP = 0.1;

interface HotkeyRegistryLike {
  register(spec: HotkeySpec, handler: HotkeyHandler): void;
}
interface PauseControlLike {
  isPaused(): boolean;
  pause(): void;
  resume(): void;
}
interface ReplayControllerLike {
  readonly mode: string;
  isPlaying(): boolean;
  play(): void;
  pause(): void;
}
interface SpeedCameraViewLike {
  adjustSpeed(direction: 1 | -1): number;
  centerCameraOnWorldPosition(x: number, y: number): void;
  getCameraState(): { zoom: number } | null;
  setCameraZoom(zoom: number): number;
}

export function registerDePlayHotkeys(deps: {
  hotkeyRegistry: HotkeyRegistryLike;
  view: SpeedCameraViewLike;
  pauseControl: PauseControlLike;
  replayController: ReplayControllerLike;
  bridgeRef: () => SimulationBridge;
  getLastHomeAttackPosition: () => { x: number; y: number } | null;
  /** After each speed key: the Time chip shows the new speed (work 149). */
  onSpeedChange?: () => void;
}): void {
  const { hotkeyRegistry, view, pauseControl, replayController, getLastHomeAttackPosition } = deps;
  // F3 (v0.3.155, PAUSE_GAME): the same manual pause the menu preserves, so
  // opening the menu while F3-paused stays paused.
  hotkeyRegistry.register({ key: 'F3' }, () => {
    if (pauseControl.isPaused()) pauseControl.resume(); else pauseControl.pause();
  });
  // Game speed through DE's four §4.5 speeds on the numpad's keys alone
  // (SPEED_UP VK_ADD, SPEED_DOWN VK_SUBTRACT), held at Slow and Fast: the main
  // row's − and Shift+= are not DE's speed keys, and Ctrl+= and Ctrl+− are its zoom.
  hotkeyRegistry.register({ code: 'NumpadAdd' }, () => { view.adjustSpeed(1); deps.onSpeedChange?.(); });
  hotkeyRegistry.register({ code: 'NumpadSubtract' }, () => { view.adjustSpeed(-1); deps.onSpeedChange?.(); });
  // Zoom (ZOOM_IN2 Ctrl+VK_OEM_PLUS, ZOOM_OUT2 Ctrl+VK_OEM_MINUS, RESET_ZOOM
  // Ctrl+VK_BACK): a wheel notch each way, and back to the boot zoom. These
  // take the browser's page zoom keys, outside a text field (spec §14.2).
  const zoomBy = (step: number): void => {
    const zoom = view.getCameraState()?.zoom;
    if (zoom !== undefined) view.setCameraZoom(zoom + step);
  };
  hotkeyRegistry.register({ code: 'Equal', ctrl: true }, () => { zoomBy(ZOOM_KEY_STEP); });
  hotkeyRegistry.register({ code: 'Minus', ctrl: true }, () => { zoomBy(-ZOOM_KEY_STEP); });
  hotkeyRegistry.register({ key: 'Backspace', ctrl: true }, () => { view.setCameraZoom(INITIAL_CAMERA_ZOOM); });
  // Space (GOTO_SELECTED_OBJECT): the camera to the primary selected object.
  // The registry is first-match and this boot-time binding precedes
  // ReplayHotkeys' dynamic one, so it arbitrates like Esc: in replay mode
  // Space stays the replay play/pause toggle.
  hotkeyRegistry.register({ key: ' ' }, () => {
    if (replayController.mode === 'replay') {
      if (replayController.isPlaying()) replayController.pause();
      else replayController.play();
      return;
    }
    const bridge = deps.bridgeRef();
    centreOnObject(bridge, view, bridge.getSelectionState().selectedEntityId);
  });
  // Home (CYCLE_FOCUS_AREA, "Go to Last Notification"): the camera to the
  // last town-under-attack event, the horn's companion (Space until work
  // 142). In replay mode it passes Home on to the replay's jump to the start.
  hotkeyRegistry.register({ key: 'Home' }, () => {
    if (replayController.mode === 'replay') return false;
    const hit = getLastHomeAttackPosition();
    if (hit) view.centerCameraOnWorldPosition(hit.x + 0.5, hit.y + 0.5);
    return undefined;
  });
}
