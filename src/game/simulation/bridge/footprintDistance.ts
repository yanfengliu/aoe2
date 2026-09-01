/**
 * Manhattan distance from a point to the NEAREST CELL of a building, rather
 * than to its origin corner.
 *
 * `findNearestDropOffBuilding` measured to the origin, which for a 4x4 Town
 * Centre is up to three tiles wrong and wrong by a DIFFERENT amount depending
 * on which side you approach from. That is what let two adjacent cells
 * disagree about which drop-off was nearest. Measured on `seed-7`: a carrier
 * holding ten wood paced between (49,21) and (50,21) forever, because from
 * (49,21) the Town Centre's origin (48,24) reads as 4 and the Lumber Camp's
 * (52,22) as 4, while from (50,21) they read 5 and 3 — yet the Town Centre's
 * nearest real cell is (50,24), a distance of 3 from BOTH. The disagreement is
 * an artefact of measuring to a corner the unit never walks to.
 */
export function manhattanDistanceToFootprint(
  origin: { x: number; y: number },
  buildingOrigin: { x: number; y: number },
  footprint: { width: number; height: number },
): number {
  // Clamp the point into the footprint rectangle on each axis; the clamped
  // point IS the nearest cell, and the distance to it is the axis sum.
  const nearestX = Math.min(Math.max(origin.x, buildingOrigin.x), buildingOrigin.x + footprint.width - 1);
  const nearestY = Math.min(Math.max(origin.y, buildingOrigin.y), buildingOrigin.y + footprint.height - 1);
  return Math.abs(origin.x - nearestX) + Math.abs(origin.y - nearestY);
}
