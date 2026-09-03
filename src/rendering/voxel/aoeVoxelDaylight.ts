// The daylight rig, in one place: the renderer hands these numbers to the
// voxel runtime's hemisphere fill + directional sun, and the cast shadows the
// recipes draw are projected from the same sun. Keeping both readers on one
// constant is what stops a moved sun from lighting one side of a building
// while its shadow still falls the other way.

export interface SunOffset {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const AOE_DAYLIGHT = {
  skyColor: 0xcfe7f1,
  groundColor: 0x4a3826,
  fillIntensity: 1.45,
  sunColor: 0xffdfa3,
  sunIntensity: 2.65,
  /** World-space sun position relative to the view centre: high, and behind
   *  the scene relative to the fixed +x,+z camera, so tops are sunlit. */
  sunOffset: { x: -22, y: 36, z: -18 },
} as const;

/** Where a point one world unit above a ground point lands on the ground
 *  when the sun's parallel rays carry it there: away from the sun, by
 *  `x`/`z` per unit of height. */
export interface ShadowProjection {
  readonly x: number;
  readonly z: number;
}

export function shadowProjectionFor(sunOffset: SunOffset): ShadowProjection {
  if (!Number.isFinite(sunOffset.y) || sunOffset.y <= 0) {
    throw new RangeError(
      `sunOffset.y must be a positive finite height for the sun to cast ground shadows; got ${String(sunOffset.y)}.`,
    );
  }
  if (!Number.isFinite(sunOffset.x) || !Number.isFinite(sunOffset.z)) {
    throw new RangeError('sunOffset.x and sunOffset.z must be finite.');
  }
  return { x: -sunOffset.x / sunOffset.y, z: -sunOffset.z / sunOffset.y };
}

export const SHADOW_PROJECTION: ShadowProjection = shadowProjectionFor(AOE_DAYLIGHT.sunOffset);
