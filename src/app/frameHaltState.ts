// A frame that throws must never end the game silently. `AoeVoxelGameView`'s
// animation-frame callback used to put its own `requestAnimationFrame` call
// LAST, so any throw above it — from `bridge.step()`, the camera, or the
// renderer — stopped the loop from ever being rescheduled. The clock stopped,
// the units stopped, and the HUD (which runs its own animation frame) kept
// drawing a live-looking match with nothing on screen to say otherwise; the
// only way out was reloading the page (defect register 2026-09-06).
//
// This holds the "the frame threw" decision so the view itself stays small.
// The rule it encodes: the FIRST failure halts the simulation but keeps the
// loop alive, because an exception raised inside a tick may have left world
// state inconsistent and continuing to step it would be worse than stopping —
// while a still-scheduled loop keeps the camera and the renderer answering, so
// the player can look at the frozen match and read the notice over it. A
// SECOND failure means the draw path is broken too, so there is nothing left
// to keep the loop alive for: it stops deliberately.

export interface FrameHalt {
  /** One line naming what threw, shown to the player. */
  readonly message: string;
  /** The thrown value, for the console and for tests. */
  readonly error: unknown;
}

export type FrameFailureVerdict = 'halt' | 'stop';

export interface FrameHaltState {
  /** The halt, or null while the frame loop is healthy. */
  current(): FrameHalt | null;
  /** Record a thrown frame. 'halt' on the first (keep drawing, stop stepping);
   *  'stop' on any later one (the draw path is failing — end the loop). */
  record(error: unknown): FrameFailureVerdict;
  /** Called immediately with the halt if one has already happened, so a
   *  listener that subscribes late still learns about it. */
  subscribe(listener: (halt: FrameHalt) => void): () => void;
}

export function describeFrameError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.trim().length > 0 ? error.message : error.name;
  }
  return String(error);
}

export function createFrameHaltState(): FrameHaltState {
  let halt: FrameHalt | null = null;
  const listeners = new Set<(halt: FrameHalt) => void>();

  return {
    current: () => halt,
    record(error: unknown): FrameFailureVerdict {
      if (halt) {
        console.error('[aoe2] the halted frame loop threw again; stopping it', error);
        return 'stop';
      }
      halt = { message: describeFrameError(error), error };
      console.error('[aoe2] a simulation frame threw; the match is stopped', error);
      for (const listener of [...listeners]) {
        try {
          listener(halt);
        } catch (listenerError) {
          console.error('[aoe2] a frame-halt listener threw', listenerError);
        }
      }
      return 'halt';
    },
    subscribe(listener: (halt: FrameHalt) => void): () => void {
      if (halt) listener(halt);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
