import { WorldTickFailureError } from 'civ-engine';

import type { EngineHaltDetails } from '../types';

export type { EngineHaltDetails };

export interface TickHaltState {
  halted: EngineHaltDetails | null;
}

export function createTickHaltState(): TickHaltState {
  return { halted: null };
}

// Wraps a single world.step() call. Returns true if the tick ran cleanly,
// false if the engine threw WorldTickFailureError or the bridge is already
// halted from a prior failure. We intentionally do NOT call world.recover():
// fail-fast is the engine's contract for a reason — a tick failure indicates
// a logic bug and recovering would mask it. The bridge stops ticking and
// surfaces the failure via HudState so the failure becomes visible instead of
// silently degrading future ticks.
export function tryTick(worldStep: () => void, haltState: TickHaltState): boolean {
  if (haltState.halted) {
    return false;
  }
  try {
    worldStep();
    return true;
  } catch (err) {
    if (err instanceof WorldTickFailureError) {
      const failure = err.failure;
      const message = failure.error?.message ?? failure.message;
      haltState.halted = {
        tick: failure.tick,
        phase: failure.phase,
        code: failure.code,
        systemName: failure.systemName,
        message,
      };
      console.error(
        `[civ-engine] tick failure at tick ${failure.tick} ` +
          `(phase=${failure.phase}, code=${failure.code}, ` +
          `system=${failure.systemName ?? 'n/a'}): ${message}`,
      );
      return false;
    }
    throw err;
  }
}
