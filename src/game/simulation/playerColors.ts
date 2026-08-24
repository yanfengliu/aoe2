// Player colours for more than two players.
//
// The spec's in-scope list is "AI opponents" and "optional AI allies", so a
// skirmish is not a 1v1 — and every tint in this build was a PAIR, `human` and
// `enemy`, which meant owners 2, 3 and 4 all came out the same shade of pink.
// Two sides you cannot tell apart is worse than not having them.
//
// The art stays where it is. Each unit and building keeps its own pair, which
// is what carries its material identity (a scout is brassy, a villager cream),
// and the OWNER applies a hue rotation on top. Owner 1 and owner 2 rotate by
// zero, so every existing colour — and every screenshot and characterization
// hash taken of them — is unchanged; owners 3 and up are the new work.
//
// The hues follow AoE2's own player order as closely as pale tints allow: blue,
// red, green, yellow, cyan, purple, grey, orange. Rotating the ENEMY tint (a
// warm red) by these amounts lands each owner near the right family while
// keeping the lightness the voxel materials were authored for.

/** How many players a skirmish can hold — AoE2's own limit. */
export const MAX_PLAYERS = 8;

/** Degrees of hue rotation applied to the enemy tint, by owner. */
const OWNER_HUE_ROTATION: Readonly<Record<number, number>> = {
  1: 0, // Untouched: owner 1 uses its own `human` tint.
  2: 0, // Untouched: the established enemy red.
  3: 105, // Toward green.
  4: 55, // Toward yellow.
  5: 160, // Toward cyan.
  6: 250, // Toward purple.
  7: 0, // Grey comes from desaturation rather than hue, below.
  8: 25, // Toward orange.
};

/** The owners whose colour is a DESATURATION rather than a rotation. */
const GREY_OWNERS = new Set<number>([7]);

function toRgb(tint: number): [number, number, number] {
  return [(tint >>> 16) & 0xff, (tint >>> 8) & 0xff, tint & 0xff];
}

function fromRgb(r: number, g: number, b: number): number {
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  return (clamp(r) << 16) | (clamp(g) << 8) | clamp(b);
}

/**
 * Rotate a colour's hue by `degrees`, preserving its lightness and saturation.
 *
 * The matrix form is used rather than a round trip through HSL because it is
 * branch-free and keeps the result stable for greys (a colour with no
 * saturation rotates to itself, which is what a stone or a plank should do).
 */
export function rotateHue(tint: number, degrees: number): number {
  if (degrees === 0) return tint;
  const [r, g, b] = toRgb(tint);
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Luminance-preserving hue rotation (the standard YIQ-style matrix).
  const lr = 0.213;
  const lg = 0.715;
  const lb = 0.072;
  const rr = lr + cos * (1 - lr) - sin * lr;
  const rg = lg - cos * lg - sin * lg;
  const rb = lb - cos * lb + sin * (1 - lb);
  const gr = lr - cos * lr + sin * 0.143;
  const gg = lg + cos * (1 - lg) + sin * 0.14;
  const gb = lb - cos * lb - sin * 0.283;
  const br = lr - cos * lr - sin * (1 - lr);
  const bg = lg - cos * lg + sin * lg;
  const bb = lb + cos * (1 - lb) + sin * lb;
  return fromRgb(
    r * rr + g * rg + b * rb,
    r * gr + g * gg + b * gb,
    r * br + g * bg + b * bb,
  );
}

/** Drain a colour of its hue, keeping its brightness — owner 7's grey. */
export function desaturate(tint: number): number {
  const [r, g, b] = toRgb(tint);
  const grey = r * 0.299 + g * 0.587 + b * 0.114;
  return fromRgb(grey, grey, grey);
}

/**
 * The tint this OWNER paints a thing whose art gives `human` and `enemy`
 * shades. Owner 1 takes the human shade and owner 2 the enemy shade exactly as
 * before; every later owner takes the enemy shade under its own hue.
 *
 * Owners beyond MAX_PLAYERS wrap rather than collapsing into one colour, so a
 * scenario with more starts than AoE2 allows is still readable.
 */
export function ownerTint(palette: { human: number; enemy: number }, owner: number): number {
  // Slot FIRST, so a ninth player wraps onto the first player's colour rather
  // than falling through to the plain enemy shade — which would collapse it
  // onto the second player's, the exact problem this module exists to fix.
  const slot = ((owner - 1) % MAX_PLAYERS) + 1;
  if (slot === 1) return palette.human;
  if (slot === 2) return palette.enemy;
  if (GREY_OWNERS.has(slot)) return desaturate(palette.enemy);
  return rotateHue(palette.enemy, OWNER_HUE_ROTATION[slot] ?? 0);
}
