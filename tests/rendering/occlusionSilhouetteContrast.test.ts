// The behind-building cue must be legible against the buildings it is drawn on.
//
// This is the test that was missing, and its absence is why a bad colour
// survived three iterations of the feature. The showcase fixture spawned only
// owner-1 villagers, so every capture ever taken of the cue was the FRIENDLY
// blue — while the question the cue exists to answer is "are those mine?",
// which makes the NOT-yours colour the half that matters most. It was a warm
// coral, and coral shares a hue family with every roof in the building palette.
//
// Scored as the SMALLEST RGB distance to any material colour, because a cue is
// only as legible as its worst background: coral managed 76 (against thatch)
// where the friendly blue manages 97 (against steel). Magenta reaches 137.
//
// The bar is on the PROPERTY, not the hex. A hex pin is a change-detector that
// says nothing about whether a new colour is any good.

import { describe, expect, it } from 'vitest';

import {
  OCCLUSION_SILHOUETTE_TINT_ENEMY,
  OCCLUSION_SILHOUETTE_TINT_OWN,
} from '../../src/rendering/voxel/aoeVoxelOcclusionSilhouettes';
import { VOXEL_COLORS } from '../../src/rendering/voxel/aoeVoxelRecipeTypes';

const rgb = (hex: number): [number, number, number] => [
  (hex >> 16) & 255, (hex >> 8) & 255, hex & 255,
];
const distance = (a: [number, number, number], b: [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The colours a behind-building cue is actually drawn OVER.
 *
 *  Buildings only, and the scoping is load-bearing rather than convenient. The
 *  cue fires when a unit is covered by a building's projected silhouette, so
 *  water, foliage and soil are never behind it — and scoring against the whole
 *  palette gives a misleading answer: the friendly blue sits 67 from
 *  `waterGlint`, which no silhouette is ever painted on. Getting this wrong in
 *  the other direction is what let coral through, so it is named explicitly
 *  here rather than inferred. */
const BUILDING_MATERIALS = [
  'plaster', 'plasterLight', 'stone', 'stoneLight', 'stoneDark',
  'timber', 'timberDark', 'roofTile', 'roofTileDark', 'thatch',
  'steel', 'steelDark', 'gold', 'window', 'cloth', 'leather',
] as const;

/** The nearest building colour to `tint`, and how far away it is. */
function worstBackground(tint: number): { name: string; distance: number } {
  let name = '';
  let worst = Number.POSITIVE_INFINITY;
  for (const key of BUILDING_MATERIALS) {
    const value = (VOXEL_COLORS as Record<string, number>)[key];
    if (typeof value !== 'number') continue;
    const d = distance(rgb(tint), rgb(value));
    if (d < worst) { worst = d; name = key; }
  }
  return { name, distance: worst };
}

// Coral scored 76 and was unusable; the friendly blue scores 97 and is fine.
// 90 sits between them, so this fails on the colour that shipped for three
// versions and passes on both current ones.
const MINIMUM_BACKGROUND_DISTANCE = 90;

describe('the behind-building cue is legible on the buildings it is drawn on', () => {
  it('keeps the ENEMY colour clear of every material colour', () => {
    // The half that carries the answer, and the half that had no test.
    const worst = worstBackground(OCCLUSION_SILHOUETTE_TINT_ENEMY);
    expect(
      worst.distance,
      `enemy cue is only ${Math.round(worst.distance)} from ${worst.name} — it will vanish on it`,
    ).toBeGreaterThan(MINIMUM_BACKGROUND_DISTANCE);
  });

  it('keeps the OWN colour clear too', () => {
    const worst = worstBackground(OCCLUSION_SILHOUETTE_TINT_OWN);
    expect(
      worst.distance,
      `own cue is only ${Math.round(worst.distance)} from ${worst.name}`,
    ).toBeGreaterThan(MINIMUM_BACKGROUND_DISTANCE);
  });

  it('keeps the two ownership colours far apart from each other', () => {
    // Legible individually is not enough: the cue answers "are those MINE?",
    // so the two must never be mistakable for one another.
    const apart = distance(rgb(OCCLUSION_SILHOUETTE_TINT_OWN), rgb(OCCLUSION_SILHOUETTE_TINT_ENEMY));
    expect(apart, `the two ownership cues are only ${Math.round(apart)} apart`)
      .toBeGreaterThan(150);
  });
});
