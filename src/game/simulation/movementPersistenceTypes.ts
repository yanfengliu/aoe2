export interface UnitMovementPersistence {
  // Banked fractional movement entitlement in hundredths of a fine unit (the
  // movementTechEffects carry accumulator). Written only while a unit moves at
  // a speed percent other than 100; older saves and unmodified units read 0.
  moveCarryHundredths?: number;
  // Last traffic-arbitrated leg plus provenance. The intent key and tick keep
  // a remembered direction from surviving a task change or long idle period.
  trafficDirectionX?: number;
  trafficDirectionY?: number;
  trafficIntentKey?: string;
  trafficAttemptTick?: number;
}
