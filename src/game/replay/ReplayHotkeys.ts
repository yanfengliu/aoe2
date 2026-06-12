import type { HotkeyRegistry } from '../control/HotkeyRegistry';
import type { ReplayController } from './ReplayController';
import {
  replayCanAdvanceFrom,
  replayCanReachTick,
  replayTimelineUpperBound,
  type TimelinePanel,
} from './TimelinePanel';

export interface ReplayHotkeys {
  dispose(): void;
}

export interface ReplayHotkeysConfig {
  readonly hotkeys: HotkeyRegistry;
  readonly controller: ReplayController;
  readonly panel: Pick<TimelinePanel, 'toggleVisibility' | 'isVisible' | 'refresh'>;
}

export function registerReplayHotkeys(config: ReplayHotkeysConfig): ReplayHotkeys {
  const { hotkeys, controller, panel } = config;
  const activeUnregister: Array<() => void> = [];

  const unregisterActive = (): void => {
    for (let index = activeUnregister.length - 1; index >= 0; index -= 1) {
      activeUnregister[index]();
    }
    activeUnregister.length = 0;
  };

  const registerActive = (): void => {
    if (activeUnregister.length > 0) return;
    activeUnregister.push(hotkeys.register({ key: ' ' }, () => {
      if (controller.isPlaying()) {
        controller.pause();
      } else if (controller.bundle && replayCanAdvanceFrom(controller.bundle, controller.currentTick)) {
        controller.play();
      }
      panel.refresh();
    }));
    activeUnregister.push(hotkeys.register({ key: 'ArrowRight' }, () => {
      if (!controller.bundle || !replayCanAdvanceFrom(controller.bundle, controller.currentTick)) return;
      controller.stepForward();
    }));
    activeUnregister.push(hotkeys.register({ key: 'ArrowLeft' }, () => {
      if (!controller.bundle || !replayCanReachTick(controller.bundle, controller.currentTick - 1)) return;
      controller.stepBackward();
    }));
    activeUnregister.push(hotkeys.register({ key: 'Home' }, () => {
      const metadata = controller.bundleMetadata;
      if (!metadata) return;
      controller.scrubTo(metadata.startTick);
    }));
    activeUnregister.push(hotkeys.register({ key: 'End' }, () => {
      const metadata = controller.bundleMetadata;
      const bundle = controller.bundle;
      if (!metadata || !bundle) return;
      const targetTick = replayTimelineUpperBound(metadata);
      if (!replayCanReachTick(bundle, targetTick)) return;
      controller.scrubTo(targetTick);
    }));
    activeUnregister.push(hotkeys.register({ key: 'Escape' }, controller.exitReplay));
    activeUnregister.push(hotkeys.register({ key: 't', alt: true }, () => {
      panel.toggleVisibility();
    }));
    // replay-fog-owner: cycle the rendered fog perspective.
    activeUnregister.push(hotkeys.register({ key: 'f', alt: true }, () => {
      controller.cycleFogOwner();
      panel.refresh();
    }));
  };

  const syncMode = (): void => {
    if (controller.mode === 'replay') {
      registerActive();
    } else {
      unregisterActive();
    }
  };

  const unregisterModeListener = controller.onModeChange(syncMode);
  syncMode();

  return {
    dispose(): void {
      unregisterModeListener();
      unregisterActive();
    },
  };
}
