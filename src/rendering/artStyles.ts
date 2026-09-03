// The art style, and the tuning it applies to voxel's stylized resolve pass.
//
// There is ONE. A second style ("Painted", the absence of the pass) shipped
// alongside it and was withdrawn on owner direction 2026-09-03 — "I only want
// the moebius art style, remove the other style" — and the machinery that
// existed only because there were two went with it: the menu's cycle row, the
// persisted preference, and the capture script's STYLE override. A one-entry
// roster behind a button that cycles to itself is worse than no button.
//
// What stays is this file, because it is where every constant records the
// frame measurement it was chosen against. That provenance is the reason not
// to inline these numbers at the call site.

import { MOEBIUS_RESOLVE_PRESET, type StylizedResolveOptions } from 'voxel/three';

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

/** How the frame is resolved. The renderer hands this straight to the voxel
 *  runtime; there is no other option to choose between. */
export const MOEBIUS_RESOLVE: StylizedResolveOptions = MOEBIUS;
