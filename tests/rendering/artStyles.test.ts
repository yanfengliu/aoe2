// The Moebius tuning is the only art style, and every constant in it was
// chosen against a measured frame (see `artStyles.ts` for the provenance).
// What is worth gating is that the four DEPARTURES from the library preset
// survive — each one was a measurement, and silently inheriting the preset
// again would undo it without any test noticing.
import { describe, expect, it } from 'vitest';
import { MOEBIUS_RESOLVE_PRESET } from 'voxel/three';

import { MOEBIUS_RESOLVE } from '../../src/rendering/artStyles';

describe('the Moebius art style', () => {
  it('keeps every tuned departure from the library preset', () => {
    // `normalEdgeScale: 0` — voxel geometry has no creases to ink: every face
    // junction is exactly 90 degrees, so any scale at or above 1 inks them all
    // equally and only adds density (the preset's 2.4 cost 23% of the frame's
    // brightness).
    expect(MOEBIUS_RESOLVE.normalEdgeScale).toBe(0);
    // Full ink at a depth step of about 0.8 world units, so a unit against the
    // ground behind it draws and sub-voxel relief does not. The library's 4
    // speckled the grass.
    expect(MOEBIUS_RESOLVE.depthEdgeScale).toBeCloseTo(1.2, 10);
    // Contours alone left the frame as muted as the lit original; this pair is
    // what makes it read as drawn.
    expect(MOEBIUS_RESOLVE.saturation).toBeCloseTo(1.4, 10);
    expect(MOEBIUS_RESOLVE.brightness).toBeCloseTo(1.12, 10);
  });

  it('inherits the rest of the preset rather than restating it', () => {
    // Bands and ink strength are deliberately the library's. Restating them
    // here would freeze this repo against an upstream improvement without
    // anyone deciding to.
    expect(MOEBIUS_RESOLVE.inkStrength).toBe(MOEBIUS_RESOLVE_PRESET.inkStrength);
    expect(MOEBIUS_RESOLVE.bands).toEqual(MOEBIUS_RESOLVE_PRESET.bands);
  });
});
