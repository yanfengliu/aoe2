export interface UnitMovementPersistence {
  // Banked fractional movement entitlement in hundredths of a fine unit (the
  // movementTechEffects carry accumulator). Since the §12.4.2 clock
  // (v0.3.160) the fractional base makes EVERY mover bank; older saves and
  // units that have never moved read 0.
  moveCarryHundredths?: number;
  // Last traffic-arbitrated leg plus provenance. The intent key and tick keep
  // a remembered direction from surviving a task change or long idle period.
  trafficDirectionX?: number;
  trafficDirectionY?: number;
  trafficIntentKey?: string;
  trafficAttemptTick?: number;
  // The starvation clock: the tick this unit last CHANGED CELL or last RESUMED
  // asking to move after a gap, with the cell it was in — so the clock counts
  // continuous contested waiting and nothing else (movementTrafficElection's
  // `trafficProgressClock` is the one rule for reading and stamping it).
  //
  // Progress, not permission. An earlier version recorded the last tick the
  // unit was ADMITTED, and it detected nothing: the arbiter is consulted about
  // once per unit per tick (~44 consults per tick across the ~44 units then
  // moving — an earlier note here mislabelled that total as per-unit), and an
  // admitted tick credits 0.32 fine units against a 4-fine-unit cell, so a
  // villager frozen solid that still collected the occasional admission
  // (measured: 12 in 40 ticks, under one cell of movement) reset its clock
  // every time. Crossing one cell needs ~12.5 CONSECUTIVE admissions, so
  // sporadic ones buy no movement. Absent (old saves, never arbitrated) reads
  // as "moving".
  trafficProgressTick?: number;
  trafficProgressCellX?: number;
  trafficProgressCellY?: number;
}
