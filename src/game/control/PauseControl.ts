// Spec 2 (annotation-ui v0.1.5) AO-3: PauseControl primitive.
// Drives the bridge's manual-pause flag via setPaused(boolean).
//
// Idempotent: pause()/resume() are no-ops if already in the requested state.
// Tracks pause state locally so isPaused() doesn't have to round-trip
// through the bridge.
//
// The bridgeRef closure indirection lets PauseControl survive a bridge swap
// (FU5 save/load): on each call we re-resolve the live bridge cell, so a
// PauseControl constructed before the swap continues to drive the new bridge
// after the swap without re-wiring.

import type { SimulationBridge } from '../simulation/createSimulationBridge';

export interface PauseControl {
  pause(): void;
  resume(): void;
  isPaused(): boolean;
}

export function createPauseControl(bridgeRef: () => SimulationBridge): PauseControl {
  let paused = false;
  return {
    pause() {
      if (paused) return;
      paused = true;
      bridgeRef().setPaused(true);
    },
    resume() {
      if (!paused) return;
      paused = false;
      bridgeRef().setPaused(false);
    },
    isPaused() {
      return paused;
    },
  };
}
