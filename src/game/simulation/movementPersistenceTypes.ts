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
}
