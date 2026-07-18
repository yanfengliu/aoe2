// Shared scalar math for the voxel presentation layer.
//
// `clamp01` and `smoothstep` were each defined byte-for-byte identically in
// five and four voxel modules respectively (and `smoothstep` always calls
// `clamp01` first). Collapsed here so the pose/animation/sampling files share
// one definition instead of drifting. Kept local to `rendering/voxel/` — the
// only consumers — rather than reaching into the simulation bridge's helpers.

/** Clamp to the unit interval [0, 1]. */
export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Hermite ease (3t² − 2t³) over a unit-clamped input. */
export function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}
