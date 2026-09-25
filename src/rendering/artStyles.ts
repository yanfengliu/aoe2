// The art styles the player can switch between, and the tuning each applies.
//
// Two ship (spec §14.5). `moebius` is voxel's stylized resolve pass tuned for
// this game: ink contours over flat tone bands. `de` (the menu's "Natural") is
// the way toward Age of Empires II: Definitive Edition's look: no resolve pass,
// a filmic tone curve, and its own textured ground. Moebius is the DEFAULT.
// The DE style was the default in v0.3.233 (the de-look plan's decision D1)
// and went back one menu row in v0.3.234: its ground doubled the frame time on
// SwiftShader, the CPU rasteriser CI draws with (CI's live frame median 116.6 ms
// in Moebius against 233.3 ms). It becomes the default again once that ground
// costs no more there than the voxel ground. The owner withdrew the unstyled
// "Painted" look on 2026-09-03, and step 1's DE frame was that same unstyled
// render with a better grade, so the default waited until the style looked its
// own.
//
// A style is a player setting: it lives in `artStylePreference.ts`, never in
// world state, saves or replays. Adding a style is adding an entry to
// `ART_STYLES`; the menu row, the preference and the renderer all read it.
//
// What a style does NOT choose is how unexplored ground looks. That ground is
// black in every style, because anything drawn there tells the player what
// they have not scouted (defect register, 2026-09-23). It is a fog-of-war rule,
// so it is a constant beside the terrain colour pipeline and not a field here
// that a style could get wrong.

import { MOEBIUS_RESOLVE_PRESET, type StylizedResolveOptions } from 'voxel/three';

export type ArtStyleId = 'moebius' | 'de';

/** How the frame's colour is mapped to the screen. Moebius stays at 'none':
 *  its scene draws into the resolve pass's offscreen targets, which are never
 *  tone-mapped, and the pass's own final draw applies no curve either. */
export type ArtStyleToneMapping = 'none' | 'aces-filmic';

/** What draws the ground. `voxel`: one flat-coloured voxel per cell, the voxel runtime's terrain chunks.
 *  `textured`: AoE's own ground mesh (`voxel/aoeDeGround.ts`), with painted surfaces, soft blends between
 *  kinds and soft fog edges, drawn in place of the chunks (the de-look plan's step 2). */
export type ArtStyleGround = 'voxel' | 'textured';

export interface ArtStyle {
  readonly id: ArtStyleId;
  /** What the menu row shows. */
  readonly label: string;
  /** One line on what the style does. */
  readonly description: string;
  /** How the frame is resolved; null renders straight to the canvas. */
  readonly resolve: StylizedResolveOptions | null;
  readonly toneMapping: ArtStyleToneMapping;
  /** The renderer's tone-mapping exposure. */
  readonly exposure: number;
  /** Brightness multiplier on ground the player has explored but cannot see
   *  now. Visible ground is 1. Unexplored ground is black in every style. */
  readonly exploredGround: number;
  /** What draws the ground. */
  readonly ground: ArtStyleGround;
}

/**
 * The Moebius tuning, measured against this game's frames rather than
 * inherited.
 *
 * Provenance for every departure from `MOEBIUS_RESOLVE_PRESET`, measured on
 * the default view (`aoe2-prototype`, 800x600) as mean colour over the world
 * canvas. The Painted baseline (the frame with no pass) is R=86.9 G=94.3
 * B=58.1, L=90.1.
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
 * these against fresh frames; `scripts/captureMapScreenshot.mjs` captures
 * (`STYLE=moebius`) and `scripts/diffMapScreenshots.mjs` compares.
 */
const MOEBIUS: StylizedResolveOptions = {
  ...MOEBIUS_RESOLVE_PRESET,
  normalEdgeScale: 0,
  depthEdgeScale: 1.2,
  saturation: 1.4,
  brightness: 1.12,
};

/** The tuned Moebius resolve, as handed to the voxel runtime. */
export const MOEBIUS_RESOLVE: StylizedResolveOptions = MOEBIUS;

/**
 * The DE grade, measured on the default view (`aoe2-prototype`, fog on, zoom
 * 1.2, 1920x1080) over the 236,681 pixels lit in the Moebius frame inside
 * 800x420 at (600, 100): the de-look plan's appendix method. Moebius there
 * measures L=113.0, saturation 0.610.
 *
 * Without the pass the frame is dull: L=98.6, saturation 0.475 (the Painted
 * frame, the plan's experiment E1). The daylight rig cannot change after the
 * runtime is built, so the lift comes from the tone curve instead. Experiment
 * E2 compared three curves: AgX at exposure 1.3 washed out (saturation 0.391);
 * Khronos Neutral at 1.1 went dark and deep green (L=90.6, saturation 0.701);
 * ACES filmic at 1.5 read as a sunlit, natural frame (L=126.1, saturation
 * 0.516) and matched what a brighter sun gave, so exposure alone does the work.
 *
 * The shipped style measures L=127.3, saturation 0.513 on that mask (and
 * L=125.1 on the building showcase, 138.6 on the unit showcase, with no pixel
 * clipped to 255). It is 1.2 above E2 because the fog fix of 2026-09-23 stopped
 * darkening the cells at the edge of vision; Moebius rose from L=113.0,
 * saturation 0.610 to L=114.5, saturation 0.611 on the same mask for the same
 * reason.
 *
 * Those figures are the style before its own ground. With the textured ground
 * (v0.3.232) the same mask measures L=111.6, saturation 0.560: the mask reaches
 * the rim of vision, which the soft fog edge darkens. Inside the explored area
 * the frame measures L=126.4, saturation 0.523, against 132.2 and 0.489 on the
 * voxel ground.
 */
const DE_EXPOSURE = 1.5;

/**
 * Explored-but-unseen ground in the DE style: Definitive Edition dims it to
 * about half brightness. ACES crushes the dark end, so the multiplier is not
 * the on-screen ratio. Measured on the default map after the human's units
 * walked to (26, 14) for 900 ticks, as the median luma at the centres of grass
 * cells off any fog edge (21 explored, 127 visible), explored over visible:
 * 0.5 gave 0.383, 0.58 gave 0.481, 0.6 gave 0.506, 0.62 gave 0.539 and 0.7
 * gave 0.643. Moebius's 0.32 gives 0.491 through its own gain and bands, so at
 * 0.6 the two styles dim explored ground alike.
 */
const DE_EXPLORED_GROUND = 0.6;

export const ART_STYLES: readonly ArtStyle[] = [
  {
    id: 'moebius',
    label: 'Moebius',
    description: 'Ink contours over flat colour.',
    resolve: MOEBIUS_RESOLVE,
    toneMapping: 'none',
    exposure: 1,
    // Unchanged since the voxel renderer shipped. The resolve's 1.12 gain
    // lifts it, so it reads as dimmed ground rather than as black.
    exploredGround: 0.32,
    ground: 'voxel',
  },
  {
    id: 'de',
    label: 'Natural',
    description: 'Natural light and colour, no outlines.',
    resolve: null,
    toneMapping: 'aces-filmic',
    exposure: DE_EXPOSURE,
    exploredGround: DE_EXPLORED_GROUND,
    ground: 'textured',
  },
];

/** Moebius, until the DE style's ground costs no more than the voxel ground on
 *  SwiftShader (the de-look plan, decision D1; the flip in v0.3.233 went back in
 *  v0.3.234). This one constant is the whole flip, and a player's stored choice
 *  still wins over it. */
export const DEFAULT_ART_STYLE_ID: ArtStyleId = 'moebius';

export function isArtStyleId(value: unknown): value is ArtStyleId {
  return typeof value === 'string' && ART_STYLES.some((style) => style.id === value);
}

export function artStyleById(id: string): ArtStyle {
  const style = ART_STYLES.find((candidate) => candidate.id === id);
  if (!style) {
    throw new Error(
      `Unknown art style "${id}". The styles this build ships are: `
      + `${ART_STYLES.map((candidate) => candidate.id).join(', ')}.`,
    );
  }
  return style;
}

/** The style after this one, wrapping — what the menu row's click does. */
export function nextArtStyleId(id: ArtStyleId): ArtStyleId {
  const index = ART_STYLES.findIndex((style) => style.id === id);
  const next = ART_STYLES[(index + 1) % ART_STYLES.length];
  if (!next) throw new Error('ART_STYLES is empty, so there is no style to switch to.');
  return next.id;
}
