export const MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS = 250;

export function boundedVisibleSimulationDelta(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS, elapsedMs);
}

/** A frame's simulation delta (spec §4.5): its elapsed time, bounded, times
 *  the game speed. The speed sets how far a frame steps the match, never what
 *  a tick does, so every speed plays the same match. */
export function frameSimulationDelta(elapsedMs: number, speedMultiplier: number): number {
  return boundedVisibleSimulationDelta(elapsedMs) * speedMultiplier;
}
