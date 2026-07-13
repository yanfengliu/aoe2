export const MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS = 250;

export function boundedVisibleSimulationDelta(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(MAX_VISIBLE_SIMULATION_FRAME_DELTA_MS, elapsedMs);
}
