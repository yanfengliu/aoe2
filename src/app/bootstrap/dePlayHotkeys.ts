// The DE play-feel hotkeys (v0.3.155-156), extracted from createApp for the
// 500-line cap: F3 pause, +/- game speed, and Space's jump-to-last-event.

interface HotkeyRegistryLike {
  register(spec: { key: string }, handler: () => void): void;
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
}

export function registerDePlayHotkeys(deps: {
  hotkeyRegistry: HotkeyRegistryLike;
  view: SpeedCameraViewLike;
  pauseControl: PauseControlLike;
  replayController: ReplayControllerLike;
  getLastHomeAttackPosition: () => { x: number; y: number } | null;
}): void {
  const { hotkeyRegistry, view, pauseControl, replayController, getLastHomeAttackPosition } = deps;
  // F3 (v0.3.155): the DE pause key — the same manual pause the menu
  // preserves, so opening the menu while F3-paused stays paused.
  hotkeyRegistry.register({ key: 'F3' }, () => {
    if (pauseControl.isPaused()) pauseControl.resume(); else pauseControl.pause();
  });
  // Numpad +/- (v0.3.155): in-match game speed through the §4.5 ladder.
  hotkeyRegistry.register({ key: '+' }, () => { view.adjustSpeed(1); });
  hotkeyRegistry.register({ key: '-' }, () => { view.adjustSpeed(-1); });
  // Space (v0.3.156): jump the camera to the last town-under-attack event.
  // The registry is first-match and this boot-time binding precedes
  // ReplayHotkeys' dynamic one, so it arbitrates like Esc: in replay mode
  // Space stays the replay play/pause toggle.
  hotkeyRegistry.register({ key: ' ' }, () => {
    if (replayController.mode === 'replay') {
      if (replayController.isPlaying()) replayController.pause();
      else replayController.play();
      return;
    }
    const hit = getLastHomeAttackPosition();
    if (hit) view.centerCameraOnWorldPosition(hit.x + 0.5, hit.y + 0.5);
  });
}
