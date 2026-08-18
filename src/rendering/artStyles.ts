// The art styles the player can switch between, and the tuning each one
// applies to voxel's stylized resolve pass.
//
// `moebius` is a preset over that pass; `painted` is the *absence* of the pass
// rather than a neutral configuration of it, so choosing it costs nothing — no
// second scene render, no fullscreen resolve, no offscreen targets.
//
// Adding a style is adding an entry here. The menu row, the persisted
// preference and the renderer all read this list, so none of them needs
// touching.

import { MOEBIUS_RESOLVE_PRESET, type StylizedResolveOptions } from 'voxel/three';

export type ArtStyleId = 'painted' | 'moebius';

export interface ArtStyle {
  readonly id: ArtStyleId;
  /** What the menu row shows. */
  readonly label: string;
  /** One line on what the style does, used as the row's tooltip. */
  readonly description: string;
  /** How the frame is resolved; null renders straight to the canvas. */
  readonly resolve: StylizedResolveOptions | null;
}

/**
 * The Moebius tuning, measured against this game's frames rather than
 * inherited.
 *
 * Provenance for every departure from `MOEBIUS_RESOLVE_PRESET`, measured on
 * the default view (`aoe2-prototype`, 800x600) as mean colour over the world
 * canvas. The Painted baseline is R=86.9 G=94.3 B=58.1, L=90.1.
 *
 * `normalEdgeScale: 0` — the preset's 2.4 cost 23% of the frame's brightness
 * (L=69.8) and turned the trees and rocks into grey mush. A normal break is a
 * crease inside one form, which is what draws a roof ridge against its wall in
 * smooth geometry. Voxel geometry has no such thing: *every* face junction is
 * exactly 90 degrees, so the turn between neighbouring normals is exactly 1.0
 * at every cube edge and any scale at or above 1 inks all of them equally. The
 * source cannot discriminate here, so it only adds density. 0.25 was tried as
 * a faint under-drawing and read as haze over the blocks rather than as line
 * (L=88.4). Silhouettes carry the whole look, and they carry it well.
 *
 * `depthEdgeScale: 1.2` — full ink at a depth step of about 0.8 world units,
 * so a unit against the ground behind it and a terrain height step both draw,
 * while sub-voxel relief does not. The library default of 4 inks anything down
 * to a quarter unit, which speckled the grass. 2.4 thickens the villagers and
 * grass tufts into blobs (L=82.1).
 *
 * `saturation: 1.4`, `brightness: 1.12` — flattening tone does nothing to
 * chroma, so with contours alone the frame stayed as muted as the lit original
 * and merely lost its gradients (L=86.8, below the Painted baseline). This
 * pair is what makes it read as drawn: L=96.9 when tuned, above Painted
 * despite the ink it adds. 1.55/1.15 warms the dirt patches toward orange, and
 * 1.8/1.22 goes fully acid — greens neon, blue crushed from B=58 to B=40. 1.4
 * lifts the frame while the dirt stays earthy.
 *
 * The shipped frame measures **L=100.8**, not the 96.9 these values were tuned
 * against. The difference is not a retune: review found the pass was blending
 * its ink in the linear working space against a display-encoded frame, drawing
 * `#2b3a45` at roughly `#0a0e12`. With the encode corrected the ink is finally
 * the colour it was authored as, so the same numbers produce a slightly
 * lighter frame. Re-inspected at 3x on the Town Center: contours are still
 * one crisp pixel, so `inkStrength` was left at the preset's 0.85 rather than
 * raised to chase the old, accidentally darker line.
 *
 * Bands are the preset's. Banding alone *brightens* slightly (L=93.8), so it
 * is not what any of the original darkening was.
 *
 * The terrain writes depth everywhere it is drawn, so the background lane —
 * pixels where nothing wrote depth — is only the sky behind the map edge. It
 * is left at the scene's own bands deliberately: there is no gradient there
 * worth banding separately, and splitting the lane would invent a boundary the
 * picture does not have.
 *
 * If the palette, the daylight rig, or the camera's depth planes move, retake
 * these against fresh frames; `scripts/captureMapScreenshot.mjs` captures and
 * `scripts/diffMapScreenshots.mjs` compares.
 */
const MOEBIUS: StylizedResolveOptions = {
  ...MOEBIUS_RESOLVE_PRESET,
  normalEdgeScale: 0,
  depthEdgeScale: 1.2,
  saturation: 1.4,
  brightness: 1.12,
};

export const ART_STYLES: readonly ArtStyle[] = [
  {
    id: 'moebius',
    label: 'Moebius',
    description: 'Ink contours over flat colour.',
    resolve: MOEBIUS,
  },
  {
    id: 'painted',
    label: 'Painted',
    description: 'Plain voxel shading, no outlines.',
    resolve: null,
  },
];

export const DEFAULT_ART_STYLE_ID: ArtStyleId = 'moebius';

export function isArtStyleId(value: unknown): value is ArtStyleId {
  return typeof value === 'string' && ART_STYLES.some((style) => style.id === value);
}

export function artStyleById(id: string): ArtStyle {
  const style = ART_STYLES.find((candidate) => candidate.id === id);

  if (!style) {
    throw new Error(
      `Unknown art style "${id}". Available: ${ART_STYLES.map((s) => s.id).join(', ')}.`,
    );
  }

  return style;
}

/** The style after this one, wrapping — what the menu row's click does. */
export function nextArtStyleId(id: ArtStyleId): ArtStyleId {
  const index = ART_STYLES.findIndex((style) => style.id === id);
  const next = ART_STYLES[(index + 1) % ART_STYLES.length];

  if (!next) throw new Error('ART_STYLES is empty; there is no style to advance to.');

  return next.id;
}
