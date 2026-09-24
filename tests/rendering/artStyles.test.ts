// The art-style roster (spec §14.5). Every constant in it was chosen against
// a measured frame (see `artStyles.ts` for the provenance), so what is worth
// gating is that the measured values survive: Moebius's four DEPARTURES from
// the library preset, and the DE style's grade. Silently inheriting the preset
// again, or losing the tone curve, would undo a measurement with no test
// noticing.
import { describe, expect, it } from 'vitest';
import { MOEBIUS_RESOLVE_PRESET } from 'voxel/three';

import {
  ART_STYLES,
  artStyleById,
  DEFAULT_ART_STYLE_ID,
  isArtStyleId,
  MOEBIUS_RESOLVE,
  nextArtStyleId,
} from '../../src/rendering/artStyles';

describe('the art-style roster', () => {
  it('ships Moebius and the DE style, with the DE style the default', () => {
    // Decision D1 of the de-look plan: the default flipped to the DE style when
    // its textured terrain landed (v0.3.232), not before.
    expect(ART_STYLES.map((style) => style.id)).toEqual(['moebius', 'de']);
    expect(DEFAULT_ART_STYLE_ID).toBe('de');
    expect(new Set(ART_STYLES.map((style) => style.label)).size).toBe(ART_STYLES.length);
  });

  it('draws Moebius on the voxel terrain and the DE style on its own textured ground', () => {
    // The de-look plan's step 2: the Natural style replaces the voxel chunks; Moebius keeps them.
    expect(artStyleById('moebius').ground).toBe('voxel');
    expect(artStyleById('de').ground).toBe('textured');
  });

  it('cycles through every style and wraps', () => {
    expect(nextArtStyleId('moebius')).toBe('de');
    expect(nextArtStyleId('de')).toBe('moebius');
  });

  it('names the shipped styles when asked for one it does not ship', () => {
    // `painted` was stored by builds before v0.3.196.
    expect(isArtStyleId('painted')).toBe(false);
    expect(() => artStyleById('painted')).toThrow(/"painted".*moebius, de/);
  });

  it('leaves unexplored ground out of every style', () => {
    // Unexplored ground is black in every style: it is a fog-of-war rule, not
    // a look, so no style may carry a field that could get it wrong.
    for (const style of ART_STYLES) {
      expect(Object.keys(style).some((key) => /unexplored/i.test(key)), style.id).toBe(false);
      expect(style.exploredGround, style.id).toBeGreaterThan(0);
      expect(style.exploredGround, style.id).toBeLessThan(1);
    }
  });
});

describe('the Moebius art style', () => {
  const moebius = artStyleById('moebius');

  it('draws through the tuned resolve and nothing else', () => {
    expect(moebius.resolve).toBe(MOEBIUS_RESOLVE);
    // Tone mapping would never reach its pixels anyway (Three tone-maps only
    // draws to the screen, and Moebius draws through the pass's targets), but
    // 'none' at exposure 1 is what keeps its frame exactly as it was.
    expect(moebius.toneMapping).toBe('none');
    expect(moebius.exposure).toBe(1);
    expect(moebius.exploredGround).toBeCloseTo(0.32, 10);
  });

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

describe('the DE art style', () => {
  const de = artStyleById('de');

  it('draws with no resolve pass: no contours, no tone bands', () => {
    // Null rather than a pass configured to do nothing, so the frame costs
    // one render and no offscreen targets.
    expect(de.resolve).toBeNull();
  });

  it('lifts the unstyled frame with the ACES filmic curve at its measured exposure', () => {
    // Experiment E2: ACES at 1.5 gave L=126.1, saturation 0.516 on the default
    // view's lit mask, where AgX washed out and Khronos Neutral went dark.
    expect(de.toneMapping).toBe('aces-filmic');
    expect(de.exposure).toBeCloseTo(1.5, 10);
  });

  it('dims explored ground to about half on screen, which takes a higher multiplier than Moebius', () => {
    // Measured: 0.6 draws explored grass at 0.506 of visible grass through
    // ACES, where 0.5 drew 0.383; Moebius's 0.32 reaches 0.491 only through
    // its resolve's gain and bands.
    expect(de.exploredGround).toBeCloseTo(0.6, 10);
    expect(de.exploredGround).toBeGreaterThan(artStyleById('moebius').exploredGround);
  });
});
