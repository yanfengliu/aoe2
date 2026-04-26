// Shared shapes for Wonder/Relic countdown state. Side maps owned by
// createWorld; consumed by the Wonder/Relic countdown systems and by the
// match-end resolver so the "first to complete" rule lives in one place.

export interface WonderCountdownEntry {
  remainingTicks: number;
  totalTicks: number;
  // FU7: records the `world.tick` at which the countdown hit zero.
  // Null while still in flight. Read by the combined Wonder/Relic winner
  // resolver so the "first to complete" rule is explicit rather than
  // implicit system-registration order.
  lastCompletedTick: number | null;
}

export interface RelicCountdownEntry {
  remainingTicks: number;
  totalTicks: number;
  // FU7: see WonderCountdownEntry.lastCompletedTick.
  lastCompletedTick: number | null;
}
