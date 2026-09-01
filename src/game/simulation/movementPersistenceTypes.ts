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
  // Last tick this unit actually CHANGED CELL, with the cell it changed to.
  //
  // Progress, not permission. An earlier version of this recorded the last
  // tick the unit was ADMITTED, and it detected nothing: the arbiter is
  // consulted ~44 times per unit per tick, so a villager frozen solid still
  // collects the occasional admission (measured: 12 in 40 ticks for a unit
  // that did not move at all) and its clock never aged. Crossing one cell
  // needs ~3.2 CONSECUTIVE admissions at 0.32 tiles/tick, so sporadic ones
  // buy no movement. Absent (old saves, never arbitrated) reads as "moving".
  trafficProgressTick?: number;
  trafficProgressCellX?: number;
  trafficProgressCellY?: number;
}
