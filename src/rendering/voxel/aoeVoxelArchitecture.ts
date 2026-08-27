// Per-architecture roof palettes (v0.3.105): the two canonical roof slots —
// the civilian THATCH and the military TILE — re-coloured per building set,
// so a Saracen town wears pale clay where a Briton town wears straw and a
// Chinese town wears glazed dark tile. Owner colour still blends ON TOP of
// these (steppedRoof's mixTint), so an architecture is a material family,
// not a player colour. Western European is the identity: the pre-v0.3.105
// palette, and the default when a view carries no architecture (units,
// legacy saves, replays without civs).

import type { ArchitectureStyle } from '../../game/simulation/architectureStyles';
import { VOXEL_COLORS } from './aoeVoxelRecipeTypes';

interface RoofPalette {
  readonly thatch: number;
  readonly tile: number;
  readonly tileDark: number;
  readonly wall: number;
  readonly wallLight: number;
}

const ROOF_PALETTES: Readonly<Record<ArchitectureStyle, RoofPalette>> = {
  'western-european': { thatch: VOXEL_COLORS.thatch, tile: VOXEL_COLORS.roofTile, tileDark: VOXEL_COLORS.roofTileDark, wall: VOXEL_COLORS.plaster, wallLight: VOXEL_COLORS.plasterLight },
  'central-european': { thatch: 0x8f7a55, tile: 0x6e4f3a, tileDark: 0x4d3728, wall: 0xcbb28a, wallLight: 0xe0cda2 },
  'middle-eastern': { thatch: 0xd8c391, tile: 0xb98d4e, tileDark: 0x826236, wall: 0xe9ddc2, wallLight: 0xf5eedb },
  'east-asian': { thatch: 0x5d7a72, tile: 0x3f5a56, tileDark: 0x2c3f3c, wall: 0xcfc9b6, wallLight: 0xe1dccb },
  mediterranean: { thatch: 0xcf8a55, tile: 0xa9502e, tileDark: 0x763820, wall: 0xe3d2ac, wallLight: 0xf0e4c4 },
  mesoamerican: { thatch: 0xb59a62, tile: 0x8c6b46, tileDark: 0x624b31, wall: 0xccc09e, wallLight: 0xdcd3b4 },
};

/** Re-key one of the three canonical roof colours (thatch, tile, and the
 *  dark tile used for ridges and caps) into the given set; any OTHER colour
 *  (stone, timber, pottery) passes through untouched, so a castle is a
 *  castle in every architecture. */
export function architectureRoofTint(
  architecture: ArchitectureStyle | undefined,
  tint: number,
): number {
  if (!architecture || architecture === 'western-european') return tint;
  const palette = ROOF_PALETTES[architecture];
  if (tint === VOXEL_COLORS.thatch) return palette.thatch;
  if (tint === VOXEL_COLORS.roofTile) return palette.tile;
  if (tint === VOXEL_COLORS.roofTileDark) return palette.tileDark;
  return tint;
}

/** Re-key the two canonical WALL colours (plaster and its light course) into
 *  the given set — whitewash for a middle-eastern town, honeyed infill for a
 *  central-european one. Consulted centrally by the building part adder, so
 *  every wall face and plaster-toned prop follows its set; stone and timber
 *  stay universal (a castle is a castle). */
export function architectureWallTint(
  architecture: ArchitectureStyle | undefined,
  tint: number,
): number {
  if (!architecture || architecture === 'western-european') return tint;
  const palette = ROOF_PALETTES[architecture];
  if (tint === VOXEL_COLORS.plaster) return palette.wall;
  if (tint === VOXEL_COLORS.plasterLight) return palette.wallLight;
  return tint;
}

// Per-set roof SILHOUETTES (v0.3.111): the sets differ in shape, not only in
// material — the alpine sets pitch steeply, the desert sets sit low and flat,
// the east-asian sets tier into a pagoda, the mesoamerican sets step like a
// temple. Geometry stays INSIDE the recipe’s own footprint fractions (insets
// only shrink), so selection rings, health bars, and hit regions are
// untouched; roof accents anchor on the returned top, so they ride along.
export interface RoofGeometry {
  /** Multiplies the per-layer height (steepness). */
  readonly heightScale: number;
  /** Multiplies the per-layer inset (how fast the roof narrows). */
  readonly insetScale: number;
  /** Added to the call site’s layer count (clamped to at least 2). */
  readonly layerDelta: number;
}

const ROOF_GEOMETRY: Readonly<Record<ArchitectureStyle, RoofGeometry>> = {
  'western-european': { heightScale: 1, insetScale: 1, layerDelta: 0 },
  'central-european': { heightScale: 1.25, insetScale: 1.35, layerDelta: 0 },
  'middle-eastern': { heightScale: 0.7, insetScale: 0.8, layerDelta: -1 },
  'east-asian': { heightScale: 0.95, insetScale: 1.7, layerDelta: 1 },
  mediterranean: { heightScale: 0.8, insetScale: 1.1, layerDelta: 0 },
  mesoamerican: { heightScale: 1.3, insetScale: 1.15, layerDelta: 1 },
};

export function architectureRoofGeometry(
  architecture: ArchitectureStyle | undefined,
): RoofGeometry {
  return ROOF_GEOMETRY[architecture ?? 'western-european'];
}

/** One door-box description: [suffix, tint, xF, bottom, zF, wF, h, dF]. */
export type DoorBox = readonly [string, number, number, number, number, number, number, number];

/** Per-set DOOR FORMS (v0.3.143): the base leaf plus the set's adornment
 *  boxes — a stepped arch head for the middle east, a timber frame for
 *  central europe, a broad thin lintel for east asia, a pale stone surround
 *  for the mediterranean, a trapezoid step for mesoamerica; the west keeps
 *  the plain leaf. Pure data (the recipe's own `add` emits it), every box
 *  hugging the door so footprints, picking, and health bars are untouched. */
export function architectureDoorBoxes(
  architecture: ArchitectureStyle | undefined,
  xF: number, bottom: number, zF: number, wF: number, h: number, dF: number,
): DoorBox[] {
  const C = VOXEL_COLORS;
  const boxes: DoorBox[] = [['door', C.timberDark, xF, bottom, zF, wF, h, dF]];
  const set = architecture ?? 'western-european';
  if (set === 'middle-eastern') {
    boxes.push(['door-arch', C.timberDark, xF, bottom + h, zF, wF * 0.55, h * 0.16, dF]);
    boxes.push(['door-jamb-l', C.stoneLight, xF - wF * 0.68, bottom, zF, wF * 0.2, h * 1.1, dF]);
    boxes.push(['door-jamb-r', C.stoneLight, xF + wF * 0.68, bottom, zF, wF * 0.2, h * 1.1, dF]);
  } else if (set === 'central-european') {
    boxes.push(['door-frame-l', C.timber, xF - wF * 0.62, bottom, zF, wF * 0.16, h * 1.18, dF]);
    boxes.push(['door-frame-r', C.timber, xF + wF * 0.62, bottom, zF, wF * 0.16, h * 1.18, dF]);
    boxes.push(['door-lintel', C.timber, xF, bottom + h * 1.12, zF, wF * 1.5, h * 0.1, dF]);
  } else if (set === 'east-asian') {
    boxes.push(['door-lintel', C.timberDark, xF, bottom + h * 1.02, zF, wF * 1.8, h * 0.08, dF]);
    boxes.push(['door-sill', C.timber, xF, bottom, zF, wF * 1.4, h * 0.06, dF]);
  } else if (set === 'mediterranean') {
    boxes.push(['door-head', C.stoneLight, xF, bottom + h, zF, wF * 1.15, h * 0.14, dF]);
    boxes.push(['door-jamb-l', C.stoneLight, xF - wF * 0.66, bottom, zF, wF * 0.18, h * 1.02, dF]);
    boxes.push(['door-jamb-r', C.stoneLight, xF + wF * 0.66, bottom, zF, wF * 0.18, h * 1.02, dF]);
  } else if (set === 'mesoamerican') {
    boxes.push(['door-base', C.timberDark, xF, bottom, zF, wF * 1.45, h * 0.3, dF]);
    boxes.push(['door-head-step', C.stoneLight, xF, bottom + h, zF, wF * 1.3, h * 0.12, dF]);
  }
  return boxes;
}
